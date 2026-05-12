/**
 * Server-Side-Helper, die von mehreren Action-Modulen geteilt werden.
 *
 * Bewusst KEIN `'use server'` am Top: das hier sind interne Helper,
 * keine Client-aufrufbaren Server-Actions. Aufgerufen werden sie nur
 * von app/actions/* (die selbst 'use server' tragen).
 */
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { links } from '@/db/schema';
import {
  AuthError,
  PermissionError,
  ValidationError,
} from '@/lib/actionResult';

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError();
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new PermissionError('Nur Admins.');
  }
  return user;
}

/**
 * Liefert den DB-Link inkl. Berechtigung-Check.
 * Wirft AuthError/PermissionError/ValidationError je nach Fall.
 */
export async function requireOwnedLink(id: string) {
  const user = await requireUser();
  if (!id) throw new ValidationError('Link-ID fehlt.');
  const link = getDb().select().from(links).where(eq(links.id, id)).get();
  if (!link) throw new ValidationError('Link nicht gefunden.');
  const isAdmin = user.role === 'admin';
  if (link.userId !== user.id && !isAdmin) {
    throw new PermissionError();
  }
  return { user, link };
}

/**
 * '' → null, alles andere getrimmt. Wird fuer Override-Text-Felder
 * benutzt: leerer User-Wert = „nutze Scraper-Wert".
 */
export function sanitizeOverride(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
