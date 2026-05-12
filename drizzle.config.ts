import type { Config } from 'drizzle-kit';

/**
 * Drizzle-Kit-Konfiguration fuer versionierte Schema-Migrationen.
 *
 * Strategie (D5, eingefuehrt 2026-05-12):
 * - Bisherige Schema-Aenderungen sind nicht als Drizzle-Migrations
 *   gespeichert, sondern via CREATE TABLE IF NOT EXISTS + ensureColumn
 *   in db/index.ts::bootstrap() versioniert (idempotent).
 * - Drizzle-Migrations starten ab heute mit einem leeren ./drizzle/-
 *   Ordner. Das initiale Schema wird weiterhin via bootstrap()
 *   garantiert; Drizzle-Migrations bauen sich ab 0001 her auf.
 * - In db/index.ts wird nach bootstrap() ein migrate()-Aufruf
 *   ausgefuehrt, der ausstehende Migrations einspielt.
 *
 * Workflow fuer neue Schema-Aenderungen:
 *   1. Aenderung in db/schema.ts machen (z.B. neue Spalte/Tabelle).
 *   2. `npx drizzle-kit generate --name <kurz_beschreibung>`
 *      generiert ./drizzle/0001_<...>.sql.
 *   3. Migration einmal pruefen, committen.
 *   4. Beim naechsten App-Start wird sie automatisch eingespielt.
 *
 * Hinweis: drizzle-kit verwendet die DB-URL nur fuer den introspect-
 * Befehl (nicht fuer `generate`). Wir lassen ihn auf den lokalen
 * Default zeigen.
 */
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/links.db',
  },
} satisfies Config;
