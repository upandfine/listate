'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { updateLink } from '@/app/actions/links';
import { TTL_LABELS, TTL_PRESETS, type TtlPreset } from '@/lib/ttl';

interface EditLinkButtonProps {
  linkId: string;
  defaultUrl: string;
  defaultSlug: string | null;
  defaultTags: string;
  hasExpiry: boolean;
}

export function EditLinkButton({
  linkId,
  defaultUrl,
  defaultSlug,
  defaultTags,
  hasExpiry,
}: EditLinkButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState(defaultUrl.replace(/^https:\/\//i, ''));
  const [slug, setSlug] = useState(defaultSlug ?? '');
  const [tags, setTags] = useState(defaultTags);
  const [ttl, setTtl] = useState<'' | TtlPreset>('');
  const [ttlClear, setTtlClear] = useState(false);
  // Fehler werden im Dialog inline angezeigt: ein <dialog> liegt in der
  // Browser-Top-Layer, normale Toasts (sonner) bleiben darunter unsichtbar.
  const [error, setError] = useState<string | null>(null);

  function open() {
    // Werte beim Öffnen frisch übernehmen (für den Fall, dass Server-State
    // aktualisiert wurde).
    setHost(defaultUrl.replace(/^https:\/\//i, ''));
    setSlug(defaultSlug ?? '');
    setTags(defaultTags);
    setTtl('');
    setTtlClear(false);
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function backdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Link bearbeiten"
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:border-brand hover:bg-brand/5 hover:text-brand"
      >
        <span className="flex items-center gap-1">
          <PencilIcon />
          Bearbeiten
        </span>
      </button>

      {/* Backdrop-Click: a11y-Lint disable, ESC laeuft via onCancel. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        onClick={backdropClick}
        onCancel={(e) => e.preventDefault()}
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl backdrop:bg-black/40"
      >
        <form
          action={async (formData) => {
            setError(null);
            const result = await updateLink(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success('Link aktualisiert');
            close();
          }}
          className="space-y-4 p-6"
        >
          <input type="hidden" name="id" value={linkId} />

          <header className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">
              Link bearbeiten
            </h2>
            <p className="text-xs text-neutral-600">
              Ändert die Original-URL, Slug, Tags und Ablaufdatum. Bisherige
              Klick-Statistiken bleiben am Link erhalten.
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

          <div className="space-y-1">
            <label
              htmlFor={`edit-url-${linkId}`}
              className="block text-xs font-medium text-neutral-700"
            >
              Original-URL
            </label>
            <div className="flex">
              <span className="inline-flex select-none items-center rounded-l-md border border-r-0 border-neutral-300 bg-neutral-100 px-3 font-mono text-sm text-neutral-500">
                https://
              </span>
              <input
                id={`edit-url-${linkId}`}
                name="url"
                type="text"
                value={host}
                onChange={(e) =>
                  setHost(e.target.value.replace(/^\s*https?:\/\//i, ''))
                }
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (/^\s*https?:\/\//i.test(pasted)) {
                    e.preventDefault();
                    setHost(pasted.replace(/^\s*https?:\/\//i, ''));
                  }
                }}
                className="flex-1 rounded-r-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Bei geänderter URL wird die OG-Vorschau frisch geladen.
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`edit-slug-${linkId}`}
              className="block text-xs font-medium text-neutral-700"
            >
              Slug
            </label>
            <div className="flex items-center gap-1 font-mono text-xs">
              <span className="text-neutral-500">listate.de/t/</span>
              <input
                id={`edit-slug-${linkId}`}
                name="slug"
                type="text"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      .replace(/[^a-z0-9_-]/g, '')
                  )
                }
                placeholder="(zufällige Kurz-ID)"
                maxLength={64}
                className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Leer lassen, um den Slug zu entfernen (Tracking-URL bleibt
              über die Kurz-ID erreichbar).
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`edit-tags-${linkId}`}
              className="block text-xs font-medium text-neutral-700"
            >
              Tags
            </label>
            <input
              id={`edit-tags-${linkId}`}
              name="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="newsletter, predigt, mai-2026"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`edit-ttl-${linkId}`}
              className="block text-xs font-medium text-neutral-700"
            >
              Ablauf
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id={`edit-ttl-${linkId}`}
                name="ttl"
                value={ttl}
                onChange={(e) => {
                  setTtl(e.target.value as '' | TtlPreset);
                  if (e.target.value) setTtlClear(false);
                }}
                disabled={ttlClear}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
              >
                <option value="">
                  {hasExpiry ? '— unverändert lassen —' : 'Kein Ablauf'}
                </option>
                {TTL_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    Ab heute: {TTL_LABELS[p]}
                  </option>
                ))}
              </select>

              {hasExpiry && (
                <label className="flex items-center gap-1.5 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    name="ttlClear"
                    checked={ttlClear}
                    onChange={(e) => {
                      setTtlClear(e.target.checked);
                      if (e.target.checked) setTtl('');
                    }}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-brand focus:ring-brand"
                  />
                  Ablauf entfernen
                </label>
              )}
            </div>
          </div>

          <footer className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
            >
              Speichern
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

function PencilIcon() {
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
      <path d="M11 2 L14 5 L5 14 L2 14 L2 11 Z" />
      <path d="M9 4 L12 7" />
    </svg>
  );
}
