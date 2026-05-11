'use client';

import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

/**
 * Button mit Modal: zeigt QR-Code als SVG, bietet PNG-Download.
 */
export function QrButton({
  value,
  className,
  filename = 'tracking-qr.png',
}: {
  value: string;
  className?: string;
  filename?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [pngUrl, setPngUrl] = useState<string>('');

  async function open() {
    if (!svg) {
      // SVG ohne explizite width/height generieren – wir lassen das SVG
      // den Container füllen (siehe wrapping div). Der Renderer setzt
      // sonst feste Pixelmaße, die aus dem Modal herausragen.
      const rawSvg = await QRCode.toString(value, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        color: { dark: '#1d284d', light: '#ffffff' },
      });
      // width/height auf der <svg>-Wurzel entfernen, damit CSS greift.
      // Beide Attribute separat strippen – Reihenfolge variiert je
      // qrcode-Version, ein kombinierter Regex ist zu fragil.
      const generatedSvg = rawSvg
        .replace(/\swidth="[^"]*"/, '')
        .replace(/\sheight="[^"]*"/, '');
      // PNG mit höherer Auflösung für saubere Drucke.
      const generatedPng = await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: { dark: '#1d284d', light: '#ffffff' },
        width: 720,
      });
      setSvg(generatedSvg);
      setPngUrl(generatedPng);
    }
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  // Reset wenn sich der Wert ändert (z. B. neuer Link).
  // Cascading-Render ist hier bewusst: lieber ein Doppel-Render als
  // ein nicht-getriggertes Reset. Alternative waere ein Key-Pattern
  // im Parent, was strukturelle Aenderung waere.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSvg('');
    setPngUrl('');
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`QR-Code für ${value}`}
        className={
          className ??
          'inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50'
        }
      >
        <QrIcon />
        QR
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onCancel={(e) => e.preventDefault()}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl backdrop:bg-black/40"
      >
        <div className="space-y-4 p-6">
          <header className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">
              QR-Code
            </h2>
            <p className="break-all font-mono text-xs text-neutral-500">
              {value}
            </p>
          </header>

          <div className="flex justify-center rounded-md border border-neutral-200 bg-white p-3">
            {svg && (
              <div
                className="h-56 w-56 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2">
            {pngUrl && (
              <a
                href={pngUrl}
                download={filename}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                PNG herunterladen
              </a>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Schließen
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

function QrIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="4" height="4" />
      <rect x="10" y="2" width="4" height="4" />
      <rect x="2" y="10" width="4" height="4" />
      <path
        d="M10 10 H11 V11 H10 Z M13 10 H14 V11 H13 Z M10 13 H11 V14 H10 Z M13 13 H14 V14 H13 Z M11.5 11.5 H12.5 V12.5 H11.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
