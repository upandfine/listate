/**
 * Pagination-Helper.
 *
 * Trennt die reine Rechen-Logik (parse / clamp / offset) vom restlichen
 * Server-Component-Code, damit sie isoliert getestet werden kann.
 */

export interface PaginationResult {
  /** Aktuell angezeigte Seite (1-basiert, immer >= 1). */
  page: number;
  /** Gesamtzahl Seiten (immer >= 1, auch bei total = 0). */
  totalPages: number;
  /** Offset fuer die DB-Query (0-basiert). */
  offset: number;
}

/**
 * Liest und normalisiert den `page`-Query-Parameter.
 *
 * - undefined / leerer String / NaN / Zahl <= 0 → 1
 * - "abc" → 1
 * - "  3  " → 3
 * - "3.7" → 3 (parseInt schneidet)
 */
export function parsePageParam(input: string | undefined): number {
  if (!input) return 1;
  const parsed = parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/**
 * Berechnet die finale Seiten-Position fuer einen gegebenen Total-Count.
 *
 * - Bei `total === 0` ist `totalPages = 1` (kein „Seite 0 von 0"-Edge-Case).
 * - `requestedPage` wird oben durch `totalPages` geclamped.
 * - `offset` ist immer `(page - 1) * pageSize`.
 *
 * @param total Anzahl der Datensaetze nach Filterung
 * @param requestedPage Aus der URL geparsed; bereits unten >= 1 garantiert,
 *                      darf hier aber auch beliebig hoch sein.
 * @param pageSize Datensaetze pro Seite (positive Ganzzahl)
 */
export function paginate(
  total: number,
  requestedPage: number,
  pageSize: number
): PaginationResult {
  if (pageSize <= 0 || !Number.isFinite(pageSize)) {
    throw new RangeError('pageSize muss eine positive Ganzzahl sein.');
  }
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const safeRequested = Math.max(1, Math.floor(requestedPage));
  const page = Math.min(safeRequested, totalPages);
  const offset = (page - 1) * pageSize;
  return { page, totalPages, offset };
}
