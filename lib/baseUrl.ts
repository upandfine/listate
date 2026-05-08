import { headers } from 'next/headers';

/**
 * Liefert die Basis-URL der Anwendung.
 *
 * Reihenfolge:
 *   1. ENV `NEXT_PUBLIC_BASE_URL` (in Production gesetzt → schneller Pfad,
 *      kein Header-Lookup nötig).
 *   2. Aus dem Request-Header `host` + `x-forwarded-proto` (Sliplane/Caddy
 *      setzt diesen Header korrekt).
 *   3. Fallback `http://localhost:3000`.
 *
 * Async, weil `headers()` in Next 15+ ein Promise zurückgibt.
 */
export async function getBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  try {
    const h = await headers();
    const host = h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'http';
    if (host) return `${proto}://${host}`;
  } catch {
    // not in a request context
  }

  return 'http://localhost:3000';
}
