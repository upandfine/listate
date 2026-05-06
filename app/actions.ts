'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { blockedHosts, links } from '@/db/schema';
import { normalizeHost } from '@/lib/host';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Nicht angemeldet.');
  }
  return session.user;
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new Error('Nur Admins.');
  }
  return user;
}

export async function deleteLink(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const db = getDb();
  const link = db
    .select({ id: links.id, userId: links.userId })
    .from(links)
    .where(eq(links.id, id))
    .get();
  if (!link) return;

  const isAdmin = user.role === 'admin';
  const isOwner = link.userId === user.id;
  if (!isAdmin && !isOwner) {
    throw new Error('Keine Berechtigung.');
  }

  db.delete(links).where(eq(links.id, id)).run();
  revalidatePath('/dashboard');
}

export async function blockHost(formData: FormData) {
  const user = await requireAdmin();

  const rawHost = String(formData.get('host') ?? '');
  const reasonRaw = String(formData.get('reason') ?? '').trim();
  const reason = reasonRaw === '' ? null : reasonRaw;
  const alsoDelete = formData.get('alsoDelete') === 'on';

  const host = normalizeHost(rawHost);
  if (!host || !host.includes('.')) {
    throw new Error('Bitte einen gültigen Host angeben.');
  }

  const db = getDb();
  db.insert(blockedHosts)
    .values({ host, reason, createdBy: user.id })
    .onConflictDoUpdate({
      target: blockedHosts.host,
      set: { reason, createdBy: user.id },
    })
    .run();

  if (alsoDelete) {
    const all = db
      .select({ id: links.id, originalUrl: links.originalUrl })
      .from(links)
      .all();
    const idsToDelete: string[] = [];
    for (const l of all) {
      try {
        if (normalizeHost(new URL(l.originalUrl).hostname) === host) {
          idsToDelete.push(l.id);
        }
      } catch {
        // Defekte URL ignorieren
      }
    }
    if (idsToDelete.length > 0) {
      db.delete(links).where(inArray(links.id, idsToDelete)).run();
    }
  }

  revalidatePath('/admin/blocked');
  revalidatePath('/dashboard');
}

export async function unblockHost(formData: FormData) {
  await requireAdmin();
  const host = String(formData.get('host') ?? '');
  if (!host) return;

  getDb().delete(blockedHosts).where(eq(blockedHosts.host, host)).run();
  revalidatePath('/admin/blocked');
}
