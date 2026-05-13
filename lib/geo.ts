/**
 * Geo-Lookup-Helper fuer DSGVO-konformes Klick-Tracking.
 *
 * Liefert ausschliesslich den 2-Letter-ISO-Country-Code zu einer IP.
 * Die IP selbst wird nirgends persistiert oder geloggt — sie verlaesst
 * diesen Modul nie. Nur der Country-Code (oder null) geht weiter.
 *
 * Datenquelle: `geoip-lite` (lokale GeoLite2-Snapshot-Daten, ~6 MB).
 * Update via `npm install geoip-lite` neu — Land-Granularitaet ist
 * unkritisch in der Aktualitaet.
 */
import geoip from 'geoip-lite';

/**
 * Loopback und unspezifische Adressen, die `geoip` nicht ausliefert
 * (Dev-Setup, Health-Checks). Werden direkt zu `null` gemappt, damit
 * geoip-lite gar nicht erst befragt wird.
 */
const NON_PUBLIC_IPS = new Set(['127.0.0.1', '::1', '0.0.0.0', '::']);

/**
 * Befragt die lokale GeoIP-Datenbank und liefert den 2-Letter-ISO-
 * Country-Code (`'DE'`, `'CH'`, …) oder `null`, wenn keine Zuordnung
 * moeglich ist (Loopback, neue/unbekannte Range, ungueltige Eingabe).
 *
 * Wirft nicht — alle Fehler werden zu `null` gemappt, damit der Caller
 * niemals durch einen Geo-Lookup blockiert wird.
 */
export function lookupCountry(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const cleaned = normalizeIp(ip);
  if (!cleaned) return null;
  if (NON_PUBLIC_IPS.has(cleaned)) return null;

  try {
    const hit = geoip.lookup(cleaned);
    return hit?.country ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalisiert eine IP-Eingabe:
 *   - trim
 *   - IPv4-mapped-IPv6 (`::ffff:1.2.3.4`) -> `1.2.3.4`
 *   - leerer String -> null
 */
function normalizeIp(ip: string): string | null {
  const trimmed = ip.trim();
  if (!trimmed) return null;
  const mapped = trimmed.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) return mapped[1];
  return trimmed;
}

/**
 * Extrahiert die Client-IP aus den Request-Headern. Reihenfolge:
 *   1. `x-forwarded-for` — erste IP im Komma-getrennten Chain.
 *      Sliplane setzt diesen Header, ebenso die meisten Reverse-Proxies.
 *   2. `x-real-ip` — Fallback fuer einfachere Proxy-Setups.
 *
 * Loopback-Adressen werden zu `null`, damit Dev/Health-Checks keinen
 * Country-Eintrag bekommen.
 */
export function extractClientIp(headers: Headers): string | null {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) {
      const normalized = normalizeIp(first);
      if (normalized && !NON_PUBLIC_IPS.has(normalized)) return normalized;
    }
  }

  const real = headers.get('x-real-ip');
  if (real) {
    const normalized = normalizeIp(real);
    if (normalized && !NON_PUBLIC_IPS.has(normalized)) return normalized;
  }

  return null;
}
