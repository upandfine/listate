import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), 'data', 'links.db');

type DB = BetterSQLite3Database<typeof schema>;

let _db: DB | null = null;

function bootstrap(sqlite: Database.Database) {
  // Mehrere parallele Worker (next build, Sliplane) sollen serialisieren statt zu craschen.
  sqlite.pragma('busy_timeout = 5000');

  // WAL nur einmal aktivieren – ist persistent in der DB-Datei.
  const mode = sqlite.pragma('journal_mode', { simple: true }) as string;
  if (mode?.toLowerCase() !== 'wal') {
    try {
      sqlite.pragma('journal_mode = WAL');
    } catch {
      // Anderer Prozess hat WAL gerade gesetzt – ignorieren.
    }
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id            TEXT PRIMARY KEY,
      name          TEXT,
      email         TEXT UNIQUE,
      emailVerified INTEGER,
      image         TEXT,
      role          TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS account (
      userId            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      type              TEXT NOT NULL,
      provider          TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token     TEXT,
      access_token      TEXT,
      expires_at        INTEGER,
      token_type        TEXT,
      scope             TEXT,
      id_token          TEXT,
      session_state     TEXT,
      PRIMARY KEY (provider, providerAccountId)
    );

    CREATE TABLE IF NOT EXISTS session (
      sessionToken TEXT PRIMARY KEY,
      userId       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      expires      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verificationToken (
      identifier TEXT NOT NULL,
      token      TEXT NOT NULL,
      expires    INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE TABLE IF NOT EXISTS links (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      original_url        TEXT NOT NULL,
      og_title            TEXT,
      og_description      TEXT,
      og_image            TEXT,
      og_site_name        TEXT,
      custom_title        TEXT,
      custom_description  TEXT,
      custom_site_name    TEXT,
      custom_image_path   TEXT,
      image_hidden        INTEGER NOT NULL DEFAULT 0,
      click_count         INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at          TEXT,
      slug                TEXT UNIQUE,
      tags                TEXT
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id     TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      clicked_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocked_hosts (
      host       TEXT PRIMARY KEY,
      reason     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT REFERENCES user(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      original_url TEXT NOT NULL,
      description  TEXT,
      url_pattern  TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_by   TEXT REFERENCES user(id) ON DELETE SET NULL
    );
  `);

  // Idempotente Schema-Migrationen für bestehende Datenbanken,
  // bei denen CREATE TABLE IF NOT EXISTS keine neuen Spalten ergänzt.
  ensureColumn(sqlite, 'links', 'expires_at', 'TEXT');
  ensureColumn(sqlite, 'templates', 'url_pattern', 'TEXT');
  ensureColumn(sqlite, 'links', 'slug', 'TEXT');
  ensureColumn(sqlite, 'links', 'tags', 'TEXT');
  // OG-Override-Spalten: title/description/siteName als Text, image als
  // Dateiname (relativ zum og-images-Verzeichnis), image_hidden als Flag.
  ensureColumn(sqlite, 'links', 'custom_title', 'TEXT');
  ensureColumn(sqlite, 'links', 'custom_description', 'TEXT');
  ensureColumn(sqlite, 'links', 'custom_site_name', 'TEXT');
  ensureColumn(sqlite, 'links', 'custom_image_path', 'TEXT');
  ensureColumn(sqlite, 'links', 'image_hidden', 'INTEGER NOT NULL DEFAULT 0');

  // Falls die Tabellen oder Indexe noch fehlen (alte DBs):
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clicks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id     TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      clicked_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_links_slug_unique ON links(slug) WHERE slug IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);
  `);
}

function ensureColumn(
  sqlite: Database.Database,
  table: string,
  column: string,
  type: string
) {
  const cols = sqlite
    .prepare(`PRAGMA table_info('${table}')`)
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

/**
 * Default-Pfad fuer Drizzle-Migrations. In Tests / CI kann ueber
 * `DRIZZLE_MIGRATIONS_FOLDER` ein eigener Pfad gesetzt werden.
 */
const MIGRATIONS_FOLDER =
  process.env.DRIZZLE_MIGRATIONS_FOLDER ??
  path.join(process.cwd(), 'drizzle');

export function getDb(): DB {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(DB_PATH);
  bootstrap(sqlite);
  _db = drizzle(sqlite, { schema });

  // Drizzle-Migrations einspielen, falls vorhanden. Bei leerem
  // Ordner ist das ein no-op. Bei fehlendem Ordner (z.B. im Test-
  // Setup, das die DB komplett selbst aufbaut) auch.
  // _journal.json muss existieren, sonst wirft migrate().
  const journalPath = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
  if (fs.existsSync(journalPath)) {
    migrate(_db, { migrationsFolder: MIGRATIONS_FOLDER });
  }

  return _db;
}
