/**
 * In-Memory-SQLite-Helper fuer Integration-Tests.
 *
 * Jeder Aufruf von `createTestDb()` liefert eine frische, isolierte
 * SQLite-Instanz im RAM mit dem produktiven Schema (links, clicks,
 * users, templates, blocked_hosts) plus den drei Indexen, die das
 * App-Bootstrap setzt.
 *
 * Bewusst NICHT die echte `getDb()`-Funktion aus `db/index.ts` —
 * die laedt eine Datei vom Filesystem (`DB_PATH`) und persistiert
 * zwischen Tests. Hier wollen wir maximale Isolation pro Test.
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';

export type TestDb = BetterSQLite3Database<typeof schema>;

export interface TestDbHandle {
  db: TestDb;
  sqlite: Database.Database;
  /** Verbindung explizit schliessen — wird nach jedem Test aufgerufen. */
  close(): void;
}

/**
 * Minimal-Schema-Setup — spiegelt `db/index.ts::bootstrap()` wider,
 * ohne Filesystem-Touch und ohne WAL (im RAM unnoetig).
 *
 * Wenn das Produktiv-Schema sich aendert, muss dieser Helper
 * mitziehen. Ein Migrations-Test (Backlog Feature E Schritt 4)
 * waere die saubere Klammer dafuer; bis dahin: bewusst manuell.
 */
function bootstrapTestSchema(sqlite: Database.Database) {
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE user (
      id            TEXT PRIMARY KEY,
      name          TEXT,
      email         TEXT UNIQUE,
      emailVerified INTEGER,
      image         TEXT,
      role          TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE links (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      original_url   TEXT NOT NULL,
      og_title       TEXT,
      og_description TEXT,
      og_image       TEXT,
      og_site_name   TEXT,
      click_count    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at     TEXT,
      slug           TEXT UNIQUE,
      tags           TEXT
    );

    CREATE TABLE clicks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id     TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      clicked_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX idx_links_slug_unique ON links(slug) WHERE slug IS NOT NULL;
    CREATE INDEX idx_clicks_link_id ON clicks(link_id);
    CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);

    CREATE TABLE templates (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      original_url TEXT NOT NULL,
      description  TEXT,
      url_pattern  TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_by   TEXT REFERENCES user(id) ON DELETE SET NULL
    );

    CREATE TABLE blocked_hosts (
      host       TEXT PRIMARY KEY,
      reason     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES user(id) ON DELETE SET NULL
    );
  `);
}

export function createTestDb(): TestDbHandle {
  const sqlite = new Database(':memory:');
  bootstrapTestSchema(sqlite);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

// ---------------------------------------------------------------------------
// Seed-Helper
// ---------------------------------------------------------------------------

export interface SeedUserInput {
  id?: string;
  email?: string;
  name?: string;
  role?: 'user' | 'admin';
}

export function seedUser(
  sqlite: Database.Database,
  input: SeedUserInput = {}
): string {
  const id = input.id ?? `user_${Math.random().toString(36).slice(2, 10)}`;
  sqlite
    .prepare(
      `INSERT INTO user (id, email, name, role) VALUES (?, ?, ?, ?)`
    )
    .run(
      id,
      input.email ?? `${id}@example.test`,
      input.name ?? 'Test User',
      input.role ?? 'user'
    );
  return id;
}

export interface SeedLinkInput {
  id?: string;
  userId: string;
  originalUrl?: string;
  slug?: string | null;
  tags?: string | null;
  expiresAt?: string | null;
  clickCount?: number;
}

export function seedLink(
  sqlite: Database.Database,
  input: SeedLinkInput
): string {
  const id = input.id ?? `lnk_${Math.random().toString(36).slice(2, 8)}`;
  sqlite
    .prepare(
      `INSERT INTO links
        (id, user_id, original_url, click_count, expires_at, slug, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.userId,
      input.originalUrl ?? 'https://example.test/page',
      input.clickCount ?? 0,
      input.expiresAt ?? null,
      input.slug ?? null,
      input.tags ?? null
    );
  return id;
}

/**
 * Schreibt N Klicks fuer einen Link mit explizit gesetzten Zeitstempeln.
 * Format wie in der Produktion: 'YYYY-MM-DD HH:MM:SS' (UTC).
 */
export function seedClicks(
  sqlite: Database.Database,
  linkId: string,
  timestamps: string[]
): void {
  const stmt = sqlite.prepare(
    `INSERT INTO clicks (link_id, clicked_at) VALUES (?, ?)`
  );
  for (const ts of timestamps) {
    stmt.run(linkId, ts);
  }
}
