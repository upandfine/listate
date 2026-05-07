/**
 * Sparkline-Daten für die letzten N Tage je Link.
 * Liefert ein Array mit täglichen Klick-Zählern in chronologischer
 * Reihenfolge (ältester zuerst), gefüllt mit 0 für Tage ohne Klicks.
 */

import { and, gte, sql } from 'drizzle-orm';
import { clicks } from '@/db/schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export interface DailyCount {
  /** Datum als 'YYYY-MM-DD' (UTC). */
  day: string;
  count: number;
}

/**
 * Aggregiert Klicks für eine Liste von Link-IDs in den letzten N Tagen
 * (inklusive heute). Liefert Map<linkId, DailyCount[]>.
 *
 * Eine einzelne SQL-Abfrage über alle Links statt N Queries.
 */
export function getClickHistory(
  db: BetterSQLite3Database<Record<string, unknown>>,
  linkIds: string[],
  days = 14
): Map<string, DailyCount[]> {
  const result = new Map<string, DailyCount[]>();
  if (linkIds.length === 0) return result;

  // Tage rückwärts ab heute (UTC) als Spalten initialisieren.
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  // Initial-Map: jeder Link bekommt alle Tage mit count=0
  for (const id of linkIds) {
    result.set(
      id,
      dayKeys.map((day) => ({ day, count: 0 }))
    );
  }

  // Frühestes Datum, das wir noch berücksichtigen
  const since = dayKeys[0] + ' 00:00:00';

  const rows = db
    .select({
      linkId: clicks.linkId,
      day: sql<string>`substr(${clicks.clickedAt}, 1, 10)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(
      and(
        sql`${clicks.linkId} IN (${sql.join(
          linkIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        gte(clicks.clickedAt, since)
      )
    )
    .groupBy(clicks.linkId, sql`substr(${clicks.clickedAt}, 1, 10)`)
    .all() as { linkId: string; day: string; count: number }[];

  for (const row of rows) {
    const series = result.get(row.linkId);
    if (!series) continue;
    const slot = series.find((s) => s.day === row.day);
    if (slot) slot.count = row.count;
  }

  return result;
}
