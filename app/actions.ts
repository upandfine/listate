'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { blockedHosts, links, templates, users } from '@/db/schema';
import {
  createTrackingLink,
  TrackingLinkError,
} from '@/lib/createTrackingLink';
import { normalizeHost } from '@/lib/host';
import {
  resolveTemplateUrl,
  type ResolveResult,
} from '@/lib/resolveTemplateUrl';

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

export async function deleteAccount() {
  const user = await requireUser();
  // Cascade-Delete: alle Links + accounts + sessions des Users werden
  // durch ON DELETE CASCADE in den FK-Constraints automatisch entfernt.
  getDb().delete(users).where(eq(users.id, user.id)).run();
  // signOut löscht das JWT-Cookie und redirected.
  const { signOut } = await import('@/auth');
  await signOut({ redirectTo: '/login' });
}

export async function createTemplate(formData: FormData) {
  const user = await requireAdmin();

  const label = String(formData.get('label') ?? '').trim();
  const rawUrl = String(formData.get('url') ?? '').trim();
  const description =
    String(formData.get('description') ?? '').trim() || null;
  const urlPattern =
    String(formData.get('urlPattern') ?? '').trim() || null;

  if (!label) throw new Error('Bezeichnung fehlt.');
  if (!/^https:\/\//i.test(rawUrl)) {
    throw new Error('URL muss mit https:// beginnen.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL ist ungültig.');
  }

  if (urlPattern) {
    try {
      new RegExp(urlPattern);
    } catch (err) {
      throw new Error(
        `Pattern ist kein gültiger Regex: ${
          err instanceof Error ? err.message : 'Fehler'
        }`
      );
    }
  }

  getDb()
    .insert(templates)
    .values({
      label,
      originalUrl: parsed.toString(),
      description,
      urlPattern,
      createdBy: user.id,
    })
    .run();

  revalidatePath('/admin/templates');
  revalidatePath('/templates');
}

export async function testTemplatePattern(input: {
  url: string;
  pattern: string;
}): Promise<ResolveResult> {
  await requireAdmin();
  const url = input.url.trim();
  const pattern = input.pattern.trim();

  if (!url || !/^https:\/\//i.test(url)) {
    return {
      ok: false,
      candidates: [],
      error: 'Quell-URL muss mit https:// beginnen.',
    };
  }
  if (!pattern) {
    return {
      ok: false,
      candidates: [],
      error: 'Bitte ein Pattern angeben.',
    };
  }

  return await resolveTemplateUrl(url, pattern);
}

export async function deleteTemplate(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  getDb().delete(templates).where(eq(templates.id, id)).run();
  revalidatePath('/admin/templates');
  revalidatePath('/templates');
}

export async function useTemplate(formData: FormData) {
  const user = await requireUser();
  const templateId = String(formData.get('templateId') ?? '');
  if (!templateId) throw new Error('Template-ID fehlt.');

  const template = getDb()
    .select()
    .from(templates)
    .where(eq(templates.id, templateId))
    .get();
  if (!template) throw new Error('Vorlage nicht gefunden.');

  // Wenn ein url_pattern hinterlegt ist, wird die Quell-URL geladen,
  // alle href-Werte extrahiert und der erste Match als Ziel-URL verwendet.
  let targetUrl = template.originalUrl;
  if (template.urlPattern) {
    const result = await resolveTemplateUrl(
      template.originalUrl,
      template.urlPattern
    );
    if (!result.ok || !result.resolved) {
      throw new Error(
        result.error ??
          'Quellseite enthielt keinen Link, der zum Pattern passt.'
      );
    }
    targetUrl = result.resolved;
  }

  let created;
  try {
    created = await createTrackingLink({
      rawUrl: targetUrl,
      userId: user.id,
      expiresAt: null,
    });
  } catch (err) {
    if (err instanceof TrackingLinkError) {
      throw new Error(err.message);
    }
    throw err;
  }

  revalidatePath('/dashboard');
  revalidatePath('/templates');
  // Redirect zur /templates mit just-created-Marker, damit Erfolgs-Card oben erscheint.
  redirect(`/templates?created=${created.id}`);
}
