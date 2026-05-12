/**
 * Generischer In-Memory-Rate-Limiter mit Sliding-Window.
 *
 * Single-Instance-Deployment (Sliplane): Counter pro Prozess. Bei
 * Multi-Instance-Deploy muesste das auf Redis o.ae. wechseln — fuer
 * jetzt OK.
 *
 * Verwendung:
 *   const limit = checkRateLimit({ key: `links:${userId}`, limit: 300, windowMs: 3_600_000 });
 *   if (!limit.allowed) return 429 with limit.retryAfter
 */

interface Bucket {
  /** Zeitstempel jedes Requests innerhalb des aktuellen Fensters (ms). */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitCheck {
  allowed: boolean;
  /** Wie viele Requests noch im Fenster erlaubt sind. */
  remaining: number;
  /** Sekunden, bis der naechste Request wieder erlaubt ist. Nur wenn allowed=false. */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Eindeutiger Counter-Key (z.B. `links:<userId>` oder `export:<ip>`). */
  key: string;
  /** Maximal erlaubte Requests im Fenster. */
  limit: number;
  /** Fenster-Groesse in Millisekunden. */
  windowMs: number;
  /** Zeitquelle (default: Date.now). Fuer Tests injizierbar. */
  now?: () => number;
}

export function checkRateLimit(opts: RateLimitOptions): RateLimitCheck {
  const now = (opts.now ?? Date.now)();
  const windowStart = now - opts.windowMs;
  const bucket = buckets.get(opts.key) ?? { hits: [] };
  // Alte Eintraege ausserhalb des Fensters verwerfen.
  const recent = bucket.hits.filter((t) => t >= windowStart);

  if (recent.length >= opts.limit) {
    const oldest = recent[0];
    const retryAfter = Math.max(
      0,
      Math.ceil((oldest + opts.windowMs - now) / 1000)
    );
    // Bucket-State auch hier aktualisieren (alte Hits sind verworfen).
    buckets.set(opts.key, { hits: recent });
    return { allowed: false, remaining: 0, retryAfter };
  }

  recent.push(now);
  buckets.set(opts.key, { hits: recent });
  return {
    allowed: true,
    remaining: opts.limit - recent.length,
    retryAfter: 0,
  };
}

/**
 * Test-Helper: alle Counter zuruecksetzen. Wird in den Vitest-Specs
 * via beforeEach aufgerufen, damit Tests isoliert sind.
 */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// Konkrete Limits fuer unsere Endpoints.
//
// Werte sind grosszuegig, sollen normale User nicht stoeren, aber
// missbraeuchliches Scraping (z.B. /api/links im Dauer-Polling) bremsen.
// ---------------------------------------------------------------------------

export const READ_LIMITS = {
  LINKS: { limit: 300, windowMs: 60 * 60 * 1000 }, // 300/h
  EXPORT: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10/h (Export ist teurer)
} as const;
