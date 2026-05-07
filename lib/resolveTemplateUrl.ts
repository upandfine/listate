/**
 * Lädt eine Übersichtsseite, extrahiert alle Link-Ziele und sucht den
 * ersten, der dem Pattern (Regex) entspricht. Verwendet wird der so
 * ermittelte URL als finale Tracking-Ziel-URL.
 */

const USER_AGENT =
  'Mozilla/5.0 (compatible; ListateBot/1.0; +https://listate.de/) AppleWebKit/537.36';

const HREF_REGEX = /href\s*=\s*"([^"]+)"|href\s*=\s*'([^']+)'/gi;

export interface ResolveResult {
  ok: boolean;
  resolved?: string;
  candidates: string[];
  error?: string;
}

/**
 * Holt das HTML der Quelle, sammelt alle absoluten Link-URLs (relative
 * werden gegen die Quell-URL aufgelöst), dedupliziert in Reihenfolge und
 * sucht den ersten Treffer, der zum übergebenen Regex passt.
 */
export async function resolveTemplateUrl(
  sourceUrl: string,
  pattern: string
): Promise<ResolveResult> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (err) {
    return {
      ok: false,
      candidates: [],
      error: `Pattern ist kein gültiger Regex: ${
        err instanceof Error ? err.message : 'Fehler'
      }`,
    };
  }

  let html: string;
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        ok: false,
        candidates: [],
        error: `Quellseite antwortete mit HTTP ${res.status}.`,
      };
    }
    html = await res.text();
  } catch (err) {
    return {
      ok: false,
      candidates: [],
      error: `Quellseite konnte nicht geladen werden: ${
        err instanceof Error ? err.message : 'Unbekannter Fehler'
      }`,
    };
  }

  const base = (() => {
    try {
      return new URL(sourceUrl);
    } catch {
      return null;
    }
  })();

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const match of html.matchAll(HREF_REGEX)) {
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) continue;

    let absolute: string;
    try {
      absolute = base ? new URL(raw, base).toString() : raw;
    } catch {
      continue;
    }
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    candidates.push(absolute);
  }

  const hit = candidates.find((u) => regex.test(u));
  if (!hit) {
    return {
      ok: false,
      candidates: candidates.slice(0, 10),
      error: 'Kein Link auf der Quellseite passt zum Pattern.',
    };
  }

  return { ok: true, resolved: hit, candidates: candidates.slice(0, 10) };
}
