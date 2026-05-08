'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Error-Boundary für alle Routen unterhalb des Layouts.
 * Wird von Next.js automatisch verwendet, wenn eine Server- oder
 * Client-Component eine Exception wirft.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In Production landet das in den Sliplane-Logs.
    console.error('[error.tsx]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-brand">
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-sm text-neutral-600">
          Die Seite konnte nicht geladen werden. Versuch es bitte gleich
          noch einmal.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-neutral-400">
            Fehler-ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          Erneut versuchen
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
