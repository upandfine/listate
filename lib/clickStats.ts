/**
 * Aggregations-Helper für Klick-Statistiken pro Link.
 * Alle Aggregationen laufen über die `clicks`-Tabelle in einer einzigen
 * Drizzle-Query und nutzen die DB-seitige Datums-/Stunden-Aufteilung.
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { clicks } from '@/db/schema';

export interface DailyClick {
  /** ISO-Datum 'YYYY-MM-DD' (UTC). */
  day: string;
  count: number;
}

/** Tages-Reihe (UTC-Tage) für N Tage zurück inkl. heute. */
export function getDailyClicks(
  db: BetterSQLite3Database<Record<string, unknown>>,
  linkId: string,
  days: number
): DailyClick[] {
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const since = dayKeys[0] + ' 00:00:00';

  const rows = db
    .select({
      day: sql<string>`substr(${clicks.clickedAt}, 1, 10)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(and(eq(clicks.linkId, linkId), gte(clicks.clickedAt, since)))
    .groupBy(sql`substr(${clicks.clickedAt}, 1, 10)`)
    .all() as { day: string; count: number }[];

  const map = new Map(rows.map((r) => [r.day, r.count]));
  return dayKeys.map((day) => ({ day, count: map.get(day) ?? 0 }));
}

/**
 * 7×24-Heatmap: Klicks pro Wochentag (0=So … 6=Sa) und Stunde (0–23).
 * Nutzt SQLite's `strftime` direkt – kein Re-Hashing in JS nötig.
 */
export function getHeatmap(
  db: BetterSQLite3Database<Record<string, unknown>>,
  linkId: string,
  days = 90
): number[][] {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString().slice(0, 19).replace('T', ' ');

  const rows = db
    .select({
      // strftime('%w', ...) -> 0..6 (Sonntag = 0)
      dow: sql<string>`strftime('%w', ${clicks.clickedAt})`,
      hour: sql<string>`strftime('%H', ${clicks.clickedAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(and(eq(clicks.linkId, linkId), gte(clicks.clickedAt, sinceIso)))
    .groupBy(
      sql`strftime('%w', ${clicks.clickedAt})`,
      sql`strftime('%H', ${clicks.clickedAt})`
    )
    .all() as { dow: string; hour: string; count: number }[];

  // Initial-Grid mit Nullen
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  for (const row of rows) {
    const d = parseInt(row.dow, 10);
    const h = parseInt(row.hour, 10);
    if (d >= 0 && d < 7 && h >= 0 && h < 24) {
      grid[d][h] = row.count;
    }
  }
  return grid;
}

/** Letzte N Klicks chronologisch absteigend. */
export function getRecentClicks(
  db: BetterSQLite3Database<Record<string, unknown>>,
  linkId: string,
  n = 30
): string[] {
  const rows = db
    .select({ clickedAt: clicks.clickedAt })
    .from(clicks)
    .where(eq(clicks.linkId, linkId))
    .orderBy(sql`${clicks.clickedAt} DESC`)
    .limit(n)
    .all() as { clickedAt: string }[];
  return rows.map((r) => r.clickedAt);
}

export interface CountryBreakdownEntry {
  /** ISO 3166-1 alpha-2 oder `null` (Lookup nicht moeglich). */
  country: string | null;
  count: number;
}

/**
 * Top-Laender-Aufstellung fuer einen Link, sortiert nach Klick-Anzahl
 * absteigend. Klicks ohne Country-Code (Loopback / unbekannte Range)
 * werden separat als `country = null` aggregiert.
 */
export function getCountryBreakdown(
  db: BetterSQLite3Database<Record<string, unknown>>,
  linkId: string,
  days = 90
): CountryBreakdownEntry[] {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString().slice(0, 19).replace('T', ' ');

  const rows = db
    .select({
      country: clicks.countryCode,
      count: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(and(eq(clicks.linkId, linkId), gte(clicks.clickedAt, sinceIso)))
    .groupBy(clicks.countryCode)
    .orderBy(sql`COUNT(*) DESC`)
    .all() as { country: string | null; count: number }[];

  return rows.map((r) => ({ country: r.country, count: r.count }));
}
