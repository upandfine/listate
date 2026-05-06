import Database, { type Database as DBType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), 'data', 'links.db');

let _db: DBType | null = null;

export function getDb(): DBType {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id             TEXT PRIMARY KEY,
      original_url   TEXT NOT NULL,
      og_title       TEXT,
      og_description TEXT,
      og_image       TEXT,
      og_site_name   TEXT,
      click_count    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  _db = db;
  return db;
}

export interface LinkRow {
  id: string;
  original_url: string;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_site_name: string | null;
  click_count: number;
  created_at: string;
}
