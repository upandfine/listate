'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { blockedHosts, links, templates, users } from '@/db/schema';
import {
  createTrackingLink,
  fetchOg,
  normalizeAndCheckSlug,
  TrackingLinkError,
  validateTrackingUrl,
} from '@/lib/createTrackingLink';
import { normalizeHost } from '@/lib/host';
import { deleteImage, writeImage } from '@/lib/imageStorage';
import {
  resolveTemplateUrl,
  type ResolveResult,
} from '@/lib/resolveTemplateUrl';
import { normalizeTags, tagsToString } from '@/lib/tags';
import { ttlToExpiresAt } from '@/lib/ttl';

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

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateLink(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'Link-ID fehlt.' };

    const db = getDb();
    const link = db.select().from(links).where(eq(links.id, id)).get();
    if (!link) return { ok: false, error: 'Link nicht gefunden.' };

    const isAdmin = user.role === 'admin';
    if (link.userId !== user.id && !isAdmin) {
      return { ok: false, error: 'Keine Berechtigung.' };
    }

    const newUrlInput = String(formData.get('url') ?? '').trim();
    // Edit-Form zeigt "https://" als Präfix-Label, im Input steht aber nur
    // der Host. Wenn kein Schema mitkommt, ergänzen wir es serverseitig –
    // sonst schlägt jede Speicherung mit „Nur https-URLs sind erlaubt." fehl.
    const newUrlRaw = newUrlInput
      ? /^https?:\/\//i.test(newUrlInput)
        ? newUrlInput
        : `https://${newUrlInput}`
      : '';
    const slugInput = String(formData.get('slug') ?? '').trim();
    const tagsInput = String(formData.get('tags') ?? '');
    const ttlInput = formData.get('ttl');
    const ttlClear = formData.get('ttlClear') === 'on';

    // Slug-Validierung (kann TrackingLinkError werfen → fangen wir gleich)
    const slug = normalizeAndCheckSlug(slugInput, id);

    // Tags
    const tags = normalizeTags(tagsInput);

    // TTL: 'ttl' Wert (Preset) oder ttlClear (auf null setzen) oder unverändert lassen.
    let expiresAt: string | null | undefined = undefined;
    if (ttlClear) {
      expiresAt = null;
    } else if (typeof ttlInput === 'string' && ttlInput) {
      expiresAt = ttlToExpiresAt(ttlInput);
    }

    // URL und OG
    let originalUrl = link.originalUrl;
    let ogTitle = link.ogTitle;
    let ogDescription = link.ogDescription;
    let ogImage = link.ogImage;
    let ogSiteName = link.ogSiteName;

    if (newUrlRaw && newUrlRaw !== link.originalUrl) {
      const validated = await validateTrackingUrl(newUrlRaw);
      originalUrl = validated.url;
      const og = await fetchOg(validated.url);
      ogTitle = og.title;
      ogDescription = og.description;
      ogImage = og.image;
      ogSiteName = og.siteName;
    }

    db.update(links)
      .set({
        originalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        ogSiteName,
        slug,
        tags: tagsToString(tags),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      })
      .where(eq(links.id, id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${id}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof TrackingLinkError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error) {
      console.error('[updateLink] unexpected error:', err);
      return {
        ok: false,
        error: 'Speichern fehlgeschlagen – Details siehe Server-Log.',
      };
    }
    return { ok: false, error: 'Unbekannter Fehler.' };
  }
}

export async function deleteLink(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const db = getDb();
  const link = db
    .select({
      id: links.id,
      userId: links.userId,
      customImagePath: links.customImagePath,
    })
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
  // Override-Bild mit aufraeumen, falls vorhanden.
  if (link.customImagePath) deleteImage(link.customImagePath);
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
  const db = getDb();
  // Zuerst die Override-Bilder dieses Users einsammeln, BEVOR wir
  // cascadend loeschen — danach gibts die Zeilen nicht mehr.
  const orphans = db
    .select({ path: links.customImagePath })
    .from(links)
    .where(eq(links.userId, user.id))
    .all()
    .map((r) => r.path)
    .filter((p): p is string => Boolean(p));

  // Cascade-Delete: alle Links + accounts + sessions des Users werden
  // durch ON DELETE CASCADE in den FK-Constraints automatisch entfernt.
  db.delete(users).where(eq(users.id, user.id)).run();
  for (const p of orphans) deleteImage(p);

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

// ---------------------------------------------------------------------------
// OG-Override-Actions: Text-Felder + Bild-Upload.
// ---------------------------------------------------------------------------

/**
 * Liefert den DB-Link inkl. Berechtigung-Check.
 * Wirft TrackingLinkError 403 bei fehlender Berechtigung, 404 bei
 * nicht-existentem Link.
 */
async function requireOwnedLink(id: string) {
  const user = await requireUser();
  if (!id) throw new TrackingLinkError('Link-ID fehlt.', 400);
  const link = getDb().select().from(links).where(eq(links.id, id)).get();
  if (!link) throw new TrackingLinkError('Link nicht gefunden.', 400);
  const isAdmin = user.role === 'admin';
  if (link.userId !== user.id && !isAdmin) {
    throw new TrackingLinkError('Keine Berechtigung.', 403);
  }
  return { user, link };
}

/**
 * Setzt Text-Overrides (Title/Description/SiteName) und das image_hidden-Flag.
 * Leere Strings werden als NULL gespeichert (= „nutze og_*-Wert").
 */
export async function updateLinkOverrides(
  formData: FormData
): Promise<ActionResult> {
  try {
    const id = String(formData.get('id') ?? '');
    const { link } = await requireOwnedLink(id);

    const customTitle = sanitizeOverride(formData.get('customTitle'));
    const customDescription = sanitizeOverride(
      formData.get('customDescription')
    );
    const customSiteName = sanitizeOverride(formData.get('customSiteName'));
    const imageHidden = formData.get('imageHidden') === 'on' ? 1 : 0;

    getDb()
      .update(links)
      .set({ customTitle, customDescription, customSiteName, imageHidden })
      .where(eq(links.id, link.id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${link.id}`);
    revalidatePath(`/t/${link.id}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof TrackingLinkError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error) {
      console.error('[updateLinkOverrides] unexpected:', err);
      return { ok: false, error: 'Speichern fehlgeschlagen.' };
    }
    return { ok: false, error: 'Unbekannter Fehler.' };
  }
}

function sanitizeOverride(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Setzt das Override-Bild aus einer hochgeladenen Datei. Erwartet ein
 * Feld `image` als File im FormData. Das Bild wird auf Magic-Bytes
 * validiert und unter <DB_DIR>/og-images/<linkId>-<hash>.<ext> abgelegt.
 *
 * Das vorherige Override-Bild dieses Links wird automatisch ueberschrieben
 * (siehe writeImage / previousFilename).
 */
export async function uploadLinkImage(
  formData: FormData
): Promise<ActionResult> {
  try {
    const id = String(formData.get('id') ?? '');
    const { link } = await requireOwnedLink(id);

    const file = formData.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'Keine Datei hochgeladen.' };
    }
    const buf = new Uint8Array(await file.arrayBuffer());

    const result = writeImage({
      linkId: link.id,
      buf,
      previousFilename: link.customImagePath,
    });

    getDb()
      .update(links)
      .set({ customImagePath: result.filename, imageHidden: 0 })
      .where(eq(links.id, link.id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${link.id}`);
    revalidatePath(`/t/${link.id}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof TrackingLinkError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error) {
      console.error('[uploadLinkImage] unexpected:', err);
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Unbekannter Fehler.' };
  }
}

/**
 * Setzt das Override-Bild zurueck (custom_image_path = NULL,
 * Datei wird geloescht). image_hidden bleibt unangetastet, weil
 * das ein separater User-Wille ist.
 */
export async function clearLinkImageOverride(
  formData: FormData
): Promise<ActionResult> {
  try {
    const id = String(formData.get('id') ?? '');
    const { link } = await requireOwnedLink(id);

    if (link.customImagePath) deleteImage(link.customImagePath);

    getDb()
      .update(links)
      .set({ customImagePath: null })
      .where(eq(links.id, link.id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${link.id}`);
    revalidatePath(`/t/${link.id}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof TrackingLinkError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error) {
      console.error('[clearLinkImageOverride] unexpected:', err);
      return { ok: false, error: 'Loeschen fehlgeschlagen.' };
    }
    return { ok: false, error: 'Unbekannter Fehler.' };
  }
}

