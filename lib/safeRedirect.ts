/**
 * Open-Redirect-Schutz für `callbackUrl`-Parameter.
 *
 * Akzeptiert nur:
 *   - relative Pfade (`/dashboard`, `/templates?x=1`)
 *
 * Verweigert:
 *   - protocol-relative URLs (`//evil.com`)
 *   - absolute URLs jeglicher Art (`https://evil.com`, `javascript:…`)
 *   - Backslash-Tricks (`/\evil.com`)
 *   - leere Strings
 */
export function safeRedirectPath(
  input: string | null | undefined,
  fallback = '/'
): string {
  if (!input || typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;

  // Muss mit '/' starten
  if (!trimmed.startsWith('/')) return fallback;

  // Keine protocol-relative URL (//host)
  if (trimmed.startsWith('//')) return fallback;

  // Keine Backslashes (manche Browser interpretieren \ wie /)
  if (trimmed.includes('\\')) return fallback;

  // Kein eingebetteter Schema-Wechsel
  if (/^\/+\w+:/i.test(trimmed)) return fallback;

  // Reguläre Steuerzeichen ablehnen
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return fallback;

  return trimmed;
}
