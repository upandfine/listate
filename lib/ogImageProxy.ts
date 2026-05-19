/**
 * Server-seitiger Proxy fuer externe OG-Vorschau-Bilder.
 *
 * Zweck (Backlog D7): Im Dashboard sieht der Owner Vorschau-Bilder
 * fremder Hosts. Wuerde der Browser die Originalsite direkt laden,
 * leakt das die IP/Timing des Owners an Dritte. Stattdessen holt der
 * Server das Bild und reicht es ueber die eigene Domain durch.
 *
 * SSRF-Haertung: og_image stammt aus den OG-Tags der Zielseite, ist
 * also indirekt angreifer-beeinflussbar (boesartige Seite setzt
 * <meta og:image="http://169.254.169.254/...">). Daher nur https +
 * harte Sperre fuer Loopback/Private/Link-Local/Metadata-Hosts.
 */
import { defaultHttpClient, type HttpClient } from './http';

export const MAX_PROXY_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 6000;

/** IPv4-Literal in privatem/Loopback/Link-Local-Bereich? */
function isBlockedIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // Link-Local / Cloud-Metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/**
 * Parst und prueft eine Bild-URL. Liefert das URL-Objekt zurueck, wenn
 * sie sicher proxybar ist (https, kein interner Host), sonst null.
 */
export function parseProxyableImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '[::1]' ||
    host.startsWith('[') // jegliche IPv6-Literale konservativ blocken
  ) {
    return null;
  }
  if (isBlockedIpv4(host)) return null;

  return url;
}

export type ProxyImageResult =
  | { ok: true; body: Uint8Array; contentType: string }
  | { ok: false };

/**
 * Holt das Bild server-seitig. Fehler (Timeout, Netz, Non-2xx,
 * Nicht-Bild, zu gross) → `{ ok: false }`; der Aufrufer mappt das auf
 * 404, ohne Details zu leaken.
 */
export async function fetchProxiedImage(
  url: URL,
  http: HttpClient = defaultHttpClient
): Promise<ProxyImageResult> {
  let res: Response;
  try {
    res = await http(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });
  } catch {
    return { ok: false };
  }
  if (!res.ok) return { ok: false };

  const contentType = (res.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!contentType.startsWith('image/')) return { ok: false };

  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_PROXY_IMAGE_BYTES) {
    return { ok: false };
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch {
    return { ok: false };
  }
  if (buf.byteLength === 0 || buf.byteLength > MAX_PROXY_IMAGE_BYTES) {
    return { ok: false };
  }

  return { ok: true, body: new Uint8Array(buf), contentType };
}
