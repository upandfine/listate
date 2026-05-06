/**
 * Normalisiert eine Host-Eingabe für Vergleiche in der Blockliste:
 * - lowercase
 * - "www."-Prefix entfernt
 * - akzeptiert sowohl reine Hostnamen ("Example.com") als auch volle URLs
 *   ("https://www.Example.com/foo?bar")
 */
export function normalizeHost(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) return '';

  let host = raw;
  try {
    if (raw.includes('://')) {
      host = new URL(raw).hostname;
    } else if (raw.includes('/')) {
      host = new URL('https://' + raw).hostname;
    }
  } catch {
    // ungültige URL – Eingabe als Hostname behandeln
  }

  return host.replace(/^www\./, '');
}
