'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';

interface ConfirmButtonProps {
  /** Server-Action, die nach Bestätigung ausgeführt wird. */
  formAction: (formData: FormData) => void | Promise<void>;
  /** Versteckte Form-Felder (z. B. ID-Übergabe). */
  hiddenFields?: Record<string, string>;
  /** Inhalt des Auslöser-Buttons (Icon + Text o. Ä.). */
  buttonLabel: ReactNode;
  /** Tailwind-Klassen für den Auslöser-Button. */
  buttonClassName?: string;
  /** Aria-Label, falls Button nur ein Icon enthält. */
  buttonAriaLabel?: string;
  /** Titel im Modal. */
  title: string;
  /** Erklärtext / Subline im Modal. */
  message: ReactNode;
  /** Beschriftung des Bestätigungs-Buttons. */
  confirmLabel: string;
  /** Bei `true` wird der Bestätigungs-Button rot dargestellt. */
  danger?: boolean;
}

/**
 * Auslöser-Button + natives <dialog>-Modal mit Bestätigung.
 * Die Server-Action erhält ein vorab gefülltes FormData; das Modal
 * rendert ggf. zusätzliche Form-Felder (z. B. eine Checkbox) inline.
 */
export function ConfirmButton({
  formAction,
  hiddenFields,
  buttonLabel,
  buttonClassName,
  buttonAriaLabel,
  title,
  message,
  confirmLabel,
  danger,
}: ConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      close();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={buttonAriaLabel}
        className={
          buttonClassName ??
          'rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50'
        }
      >
        {buttonLabel}
      </button>

      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        onCancel={(e) => e.preventDefault()}
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-[fadeIn_120ms_ease-out]"
      >
        <form action={formAction} className="space-y-5 p-6">
          {hiddenFields &&
            Object.entries(hiddenFields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}

          <header className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            <div className="text-sm leading-relaxed text-neutral-600">
              {message}
            </div>
          </header>

          <footer className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={
                danger
                  ? 'rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark'
                  : 'rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark'
              }
            >
              {confirmLabel}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
