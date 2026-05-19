import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Presentational Button-Primitive. Bewusst ohne 'use client': enthaelt
 * keine Hooks, kann in Server- wie Client-Components gerendert werden.
 *
 * Varianten kapseln die bisher mehrfach inline wiederholten Tailwind-
 * Klassen-Strings. `className` wird ANGEHAENGT (nicht ersetzt), damit
 * Aufrufer punktuell ergaenzen koennen (z. B. disabled-Layout).
 */
export type ButtonVariant =
  | 'secondary' // Copy/Share/QR — neutraler Outline-Button in Toolbars
  | 'toolbar' // Bearbeiten/Vorschau — dezenter Toolbar-Button (brand-Hover)
  | 'toolbarDanger' // Loeschen — Toolbar-Button mit rotem Hover
  | 'primary' // Haupt-CTA (Erzeugen, Speichern)
  | 'danger' // destruktive Bestaetigung
  | 'ghost'; // Abbrechen / sekundaere Dialog-Aktion

const VARIANTS: Record<ButtonVariant, string> = {
  secondary:
    'inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50',
  toolbar:
    'rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:border-brand hover:bg-brand/5 hover:text-brand',
  toolbarDanger:
    'rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700',
  primary:
    'rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark',
  ghost:
    'rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  children: ReactNode;
}

export function Button({
  variant,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const cls = className ? `${VARIANTS[variant]} ${className}` : VARIANTS[variant];
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
