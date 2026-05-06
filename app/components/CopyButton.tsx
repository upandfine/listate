'use client';

import { useState } from 'react';

export function CopyButton({
  value,
  className,
  label = 'Kopieren',
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fehlgeschlagen (z. B. unsicherer Kontext) – still ignorieren.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Kopiert' : `${label} ${value}`}
      className={
        className ??
        'inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50'
      }
    >
      {copied ? (
        <CheckIcon />
      ) : (
        <ClipboardIcon />
      )}
      {copied ? 'Kopiert' : label}
    </button>
  );
}

function ClipboardIcon() {
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
      <rect x="4" y="3" width="8" height="11" rx="1.5" />
      <path d="M6 3 V2.25 a0.75 0.75 0 0 1 0.75 -0.75 h2.5 a0.75 0.75 0 0 1 0.75 0.75 V3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-accent"
    >
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  );
}
