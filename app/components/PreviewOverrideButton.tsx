'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { toast } from 'sonner';
import {
  clearLinkImageOverride,
  updateLinkOverrides,
  uploadLinkImage,
} from '@/app/actions/og-overrides';
import type { LinkPreviewInput } from '@/types/link';
import { Button } from './ui/Button';

type FormatKey = 'original' | 'og' | 'square';

interface FormatSpec {
  label: string;
  hint: string;
  /** null = Original-Verhaeltnis behalten, nur skalieren. */
  size: { w: number; h: number } | null;
  /** Maximale Kante bei "Original" — verhindert Multi-MB-Uploads. */
  maxEdge?: number;
}

const FORMATS: Record<FormatKey, FormatSpec> = {
  og: {
    label: 'Open Graph',
    hint: '1200 × 630 — WhatsApp, Facebook, LinkedIn',
    size: { w: 1200, h: 630 },
  },
  square: {
    label: 'Quadratisch',
    hint: '1080 × 1080 — Instagram-Stil',
    size: { w: 1080, h: 1080 },
  },
  original: {
    label: 'Original',
    hint: 'Verhältnis behalten, max. 1920 px Kante',
    size: null,
    maxEdge: 1920,
  },
};

const JPEG_QUALITY = 0.85;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export function PreviewOverrideButton({ link }: { link: LinkPreviewInput }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [title, setTitle] = useState(link.customTitle ?? '');
  const [description, setDescription] = useState(link.customDescription ?? '');
  const [siteName, setSiteName] = useState(link.customSiteName ?? '');
  const [imageHidden, setImageHidden] = useState(link.imageHidden === 1);
  const [format, setFormat] = useState<FormatKey>('og');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedImageEl, setPickedImageEl] = useState<HTMLImageElement | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Aktuelles Vorschau-Bild: wenn der User gerade neues gewählt hat → Canvas;
  // sonst custom-Bild bzw. og_image.
  const currentImageUrl = useMemo(() => {
    if (link.customImagePath) return `/api/og-image/${link.customImagePath}`;
    return link.ogImage;
  }, [link.customImagePath, link.ogImage]);

  // Reset, wenn das Modal geschlossen oder neu geoeffnet wird.
  function open() {
    setTitle(link.customTitle ?? '');
    setDescription(link.customDescription ?? '');
    setSiteName(link.customSiteName ?? '');
    setImageHidden(link.imageHidden === 1);
    setFormat('og');
    setPickedFile(null);
    setPickedImageEl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function backdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) close();
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    setPickedFile(file);
    if (!file) {
      setPickedImageEl(null);
      return;
    }
    // Image-Object aus File laden, fuers Canvas-Rendering.
    const img = new Image();
    img.onload = () => {
      setPickedImageEl(img);
    };
    img.onerror = () => {
      setError('Datei konnte nicht als Bild geladen werden.');
      setPickedImageEl(null);
    };
    img.src = URL.createObjectURL(file);
  }

  // Canvas-Rendering: jedesmal neu zeichnen, wenn pickedImageEl oder format wechseln.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !pickedImageEl) return;
    renderToCanvas(canvas, pickedImageEl, FORMATS[format]);
  }, [pickedImageEl, format]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Doppel-Klick-Guard: zwischen "Klick auf Submit" und "saving=true im
    // naechsten Render" liegt ein React-Tick. Wenn dort ein zweiter
    // Klick reinrutscht, wuerden zwei Uploads parallel laufen — der
    // zweite ohne aktuellen customImagePath, also wuerde der erste
    // Filename zum Orphan. Pruefen wir hier defensiv mit.
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      // 1) Wenn ein neues Bild gewaehlt ist: croppen, hochladen.
      if (pickedFile && pickedImageEl) {
        const canvas = previewCanvasRef.current;
        if (!canvas) throw new Error('Canvas nicht bereit.');
        const blob = await canvasToCompressedBlob(canvas);
        if (blob.size > MAX_OUTPUT_BYTES) {
          throw new Error(
            `Bild ist nach Komprimierung noch ${formatBytes(blob.size)} – versuch ein kleineres Ausgangsbild.`
          );
        }
        const fd = new FormData();
        fd.append('id', link.id);
        fd.append('image', new File([blob], 'preview.jpg', { type: blob.type }));
        const upload = await uploadLinkImage(fd);
        if (!upload.ok) throw new Error(upload.error);
      }

      // 2) Text-Overrides + image_hidden in einem Rutsch speichern.
      const fd = new FormData();
      fd.append('id', link.id);
      fd.append('customTitle', title);
      fd.append('customDescription', description);
      fd.append('customSiteName', siteName);
      if (imageHidden) fd.append('imageHidden', 'on');
      const update = await updateLinkOverrides(fd);
      if (!update.ok) throw new Error(update.error);

      toast.success('Vorschau aktualisiert');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetImage() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('id', link.id);
      const res = await clearLinkImageOverride(fd);
      if (!res.ok) throw new Error(res.error);
      toast.success('Bild auf Original zurückgesetzt');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  const hasCustomImage = Boolean(link.customImagePath);
  const showCanvasPreview = pickedImageEl !== null;

  return (
    <>
      <Button variant="toolbar" onClick={open} aria-label="Vorschau anpassen">
        <span className="flex items-center gap-1">
          <PreviewIcon />
          <span className="hidden sm:inline">Vorschau</span>
        </span>
      </Button>

      {/* Backdrop-Click: a11y-Lint disable, ESC laeuft via onCancel. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        onClick={backdropClick}
        onCancel={(e) => e.preventDefault()}
        className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <header className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">
              Vorschau anpassen
            </h2>
            <p className="text-xs text-neutral-600">
              Bestimmt, was geteilt wird (WhatsApp, LinkedIn, Slack …). Leer
              lassen, um die automatisch ausgelesenen Werte zu behalten.
            </p>
          </header>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent"
            >
              {error}
            </div>
          )}

          {/* --- Text-Overrides --- */}
          <section className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor={`po-title-${link.id}`}
                className="block text-xs font-medium text-neutral-700"
              >
                Titel
              </label>
              <input
                id={`po-title-${link.id}`}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={link.ogTitle ?? '(kein Original-Titel verfügbar)'}
                maxLength={200}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`po-desc-${link.id}`}
                className="block text-xs font-medium text-neutral-700"
              >
                Beschreibung
              </label>
              <textarea
                id={`po-desc-${link.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  link.ogDescription ?? '(keine Original-Beschreibung)'
                }
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`po-site-${link.id}`}
                className="block text-xs font-medium text-neutral-700"
              >
                Site-Name
              </label>
              <input
                id={`po-site-${link.id}`}
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder={link.ogSiteName ?? '(kein Original-Site-Name)'}
                maxLength={100}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </section>

          {/* --- Bild --- */}
          <section className="space-y-3 rounded-md border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-neutral-700">Bild</h3>
              {hasCustomImage && (
                <button
                  type="button"
                  onClick={handleResetImage}
                  disabled={saving}
                  className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline disabled:opacity-50"
                >
                  Auf Original zurücksetzen
                </button>
              )}
            </div>

            {/* Aktuelle Vorschau ODER Canvas mit gewähltem File */}
            <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
              {showCanvasPreview ? (
                <canvas
                  ref={previewCanvasRef}
                  className="block max-h-64 w-full bg-white object-contain"
                />
              ) : currentImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentImageUrl}
                  alt=""
                  className="block max-h-64 w-full object-contain"
                />
              ) : (
                <div className="flex h-32 items-center justify-center text-xs text-neutral-500">
                  Kein Bild gesetzt
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`po-file-${link.id}`}
                className="block text-xs font-medium text-neutral-700"
              >
                Neues Bild
              </label>
              <input
                id={`po-file-${link.id}`}
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onPickFile}
                className="block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-dark"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-700">
                Format
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(FORMATS) as FormatKey[]).map((key) => (
                  <label
                    key={key}
                    className={
                      'cursor-pointer rounded-md border p-2 text-xs ' +
                      (format === key
                        ? 'border-brand bg-brand/5'
                        : 'border-neutral-200 hover:border-neutral-300')
                    }
                  >
                    <input
                      type="radio"
                      name={`format-${link.id}`}
                      value={key}
                      checked={format === key}
                      onChange={() => setFormat(key)}
                      className="sr-only"
                    />
                    <div className="font-medium text-neutral-900">
                      {FORMATS[key].label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-neutral-500">
                      {FORMATS[key].hint}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">
                Bilder werden im Browser auf das gewählte Format zugeschnitten
                und auf JPEG (Qualität 85) komprimiert. Max. 2 MB nach
                Komprimierung.
              </p>
            </div>

            <label className="flex items-start gap-2 pt-1 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={imageHidden}
                onChange={(e) => setImageHidden(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-brand focus:ring-brand"
              />
              <span>
                Bild ausblenden (auch wenn ein Original- oder eigenes Bild
                vorhanden ist). In Social-Vorschauen erscheint dann keine
                Grafik.
              </span>
            </label>
          </section>

          <footer className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={close}
              disabled={saving}
              className="disabled:opacity-50"
            >
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Speichert …' : 'Speichern'}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Canvas-Helper
// ---------------------------------------------------------------------------

function renderToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  spec: FormatSpec
): void {
  if (spec.size) {
    // Fixed-Format: crop nach object-fit:cover-Semantik.
    canvas.width = spec.size.w;
    canvas.height = spec.size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const target = spec.size.w / spec.size.h;
    const source = img.naturalWidth / img.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (source > target) {
      // Quelle ist breiter: links/rechts zuschneiden.
      sw = img.naturalHeight * target;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      // Quelle ist höher: oben/unten zuschneiden.
      sh = img.naturalWidth / target;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return;
  }

  // Original-Verhältnis behalten, nur skalieren wenn nötig.
  const maxEdge = spec.maxEdge ?? 1920;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest > maxEdge) {
    const factor = maxEdge / longest;
    w = Math.round(w * factor);
    h = Math.round(h * factor);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, w, h);
}

function canvasToCompressedBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Bild konnte nicht erzeugt werden.'));
        else resolve(b);
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function PreviewIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="7" r="1.3" />
      <path d="M2 11.5 L6 8 L9 11 L11 9 L14 12" />
    </svg>
  );
}
