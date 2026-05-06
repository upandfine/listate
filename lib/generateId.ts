import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { links } from '@/db/schema';

const CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateId(length = 6): string {
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    let id = '';
    for (let i = 0; i < length; i++) {
      id += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    const existing = db
      .select({ id: links.id })
      .from(links)
      .where(eq(links.id, id))
      .get();
    if (!existing) return id;
  }
  throw new Error('ID-Generierung fehlgeschlagen');
}
