'use client';

/**
 * Fängt Fehler ab, die im Root-Layout selbst auftreten — also
 * Stellen, wo `error.tsx` nicht mehr greift, weil das umgebende
 * Layout schon kaputt ist. Muss eigene <html>/<body>-Tags rendern.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          color: '#1d284d',
          fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 .75rem' }}>
            Schwerwiegender Fehler
          </h1>
          <p style={{ color: '#525252', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
            Die App konnte nicht initialisiert werden. Bitte lade die Seite neu.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '.7rem',
                color: '#a3a3a3',
                marginBottom: '1.5rem',
              }}
            >
              Fehler-ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#1d284d',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '.5rem 1rem',
              fontSize: '.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Neu laden
          </button>
        </main>
      </body>
    </html>
  );
}
