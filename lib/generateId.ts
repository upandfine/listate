import db from './db';

const CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateId(length = 6): string {
  const exists = db.prepare('SELECT id FROM links WHERE id = ?');
  for (let attempt = 0; attempt < 5; attempt++) {
    let id = '';
    for (let i = 0; i < length; i++) {
      id += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    if (!exists.get(id)) return id;
  }
  throw new Error('ID-Generierung fehlgeschlagen');
}
