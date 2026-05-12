'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { blockedHosts, links, templates, users } from '@/db/schema';
import {
  actionFail,
  actionOk,
  actionOkData,
  actionRedirect,
  AuthError,
  parseFormData,
  PermissionError,
  toActionFail,
  ValidationError,
  type ActionResult,
} from '@/lib/actionResult';
import {
  blockHostSchema,
  createTemplateSchema,
  deleteLinkSchema,
  deleteTemplateSchema,
  linkIdOnlySchema,
  testTemplatePatternSchema,
  unblockHostSchema,
  updateLinkOverridesSchema,
  updateLinkSchema,
  useTemplateSchema,
} from '@/lib/actionSchemas';
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

// ---------------------------------------------------------------------------
// Auth-Helper
// ---------------------------------------------------------------------------

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError();
  return session.user;
}

async function requireAdmin() {
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
async function requireOwnedLink(id: string) {
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

function sanitizeOverride(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// ---------------------------------------------------------------------------
// updateLink — Original-URL, Slug, Tags, Ablauf
// ---------------------------------------------------------------------------

export async function updateLink(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, updateLinkSchema);
    const { user, link } = await requireOwnedLink(input.id);

    // Edit-Form zeigt "https://" als Präfix-Label, im Input steht aber nur
    // der Host. Wenn kein Schema mitkommt, ergänzen wir es serverseitig.
    const newUrlInput = input.url.trim();
    const newUrlRaw = newUrlInput
      ? /^https?:\/\//i.test(newUrlInput)
        ? newUrlInput
        : `https://${newUrlInput}`
      : '';

    // Slug-Validierung (kann TrackingLinkError werfen)
    const slug = normalizeAndCheckSlug(input.slug, link.id);

    const tags = normalizeTags(input.tags);

    // TTL: 'ttl' Wert (Preset) ODER ttlClear (auf null) ODER unverändert.
    let expiresAt: string | null | undefined = undefined;
    if (input.ttlClear) {
      expiresAt = null;
    } else if (input.ttl) {
      expiresAt = ttlToExpiresAt(input.ttl);
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

    getDb()
      .update(links)
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
      .where(eq(links.id, link.id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${link.id}`);
    // Unused-var-Warnung umgehen: user ist hier nicht direkt verwendet,
    // aber requireOwnedLink hat die Auth-Pruefung schon gemacht.
    void user;
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'updateLink');
  }
}

// ---------------------------------------------------------------------------
// deleteLink
// ---------------------------------------------------------------------------

export async function deleteLink(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, deleteLinkSchema);
    const { link } = await requireOwnedLink(input.id);

    getDb().delete(links).where(eq(links.id, link.id)).run();
    if (link.customImagePath) deleteImage(link.customImagePath);
    revalidatePath('/dashboard');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'deleteLink');
  }
}

// ---------------------------------------------------------------------------
// blockHost / unblockHost
// ---------------------------------------------------------------------------

export async function blockHost(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, blockHostSchema);
    const user = await requireAdmin();

    const host = normalizeHost(input.host);
    if (!host || !host.includes('.')) {
      throw new ValidationError('Bitte einen gültigen Host angeben.');
    }
    const reason = input.reason.trim() === '' ? null : input.reason.trim();

    const db = getDb();
    db.insert(blockedHosts)
      .values({ host, reason, createdBy: user.id })
      .onConflictDoUpdate({
        target: blockedHosts.host,
        set: { reason, createdBy: user.id },
      })
      .run();

    if (input.alsoDelete) {
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
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'blockHost');
  }
}

export async function unblockHost(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, unblockHostSchema);
    await requireAdmin();

    getDb()
      .delete(blockedHosts)
      .where(eq(blockedHosts.host, input.host))
      .run();
    revalidatePath('/admin/blocked');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'unblockHost');
  }
}

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

export async function deleteAccount(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const db = getDb();

    const orphans = db
      .select({ path: links.customImagePath })
      .from(links)
      .where(eq(links.userId, user.id))
      .all()
      .map((r) => r.path)
      .filter((p): p is string => Boolean(p));

    db.delete(users).where(eq(users.id, user.id)).run();
    for (const p of orphans) deleteImage(p);

    // signOut wird hier NICHT aufgerufen — das ist Verantwortung des
    // Aufrufers (UI), der nach dem ok-Result die Logout-Action triggert
    // ODER ein Redirect macht. Damit bleibt deleteAccount testbar.
    return actionRedirect('/login');
  } catch (err) {
    return toActionFail(err, 'deleteAccount');
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function createTemplate(
  formData: FormData
): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, createTemplateSchema);
    const user = await requireAdmin();

    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      throw new ValidationError('URL ist ungültig.');
    }

    if (input.urlPattern) {
      try {
        new RegExp(input.urlPattern);
      } catch (err) {
        throw new ValidationError(
          `Pattern ist kein gültiger Regex: ${
            err instanceof Error ? err.message : 'Fehler'
          }`
        );
      }
    }

    getDb()
      .insert(templates)
      .values({
        label: input.label,
        originalUrl: parsed.toString(),
        description: input.description.trim() || null,
        urlPattern: input.urlPattern.trim() || null,
        createdBy: user.id,
      })
      .run();

    revalidatePath('/admin/templates');
    revalidatePath('/templates');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'createTemplate');
  }
}

export async function deleteTemplate(
  formData: FormData
): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, deleteTemplateSchema);
    await requireAdmin();

    getDb().delete(templates).where(eq(templates.id, input.id)).run();
    revalidatePath('/admin/templates');
    revalidatePath('/templates');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'deleteTemplate');
  }
}

/**
 * Server-Side-Test fuer den url_pattern-Resolver. Wird vom Admin-UI
 * direkt mit einem Object aufgerufen (nicht FormData), daher Validation
 * via Zod auf dem Input-Object.
 */
export async function testTemplatePattern(input: {
  url: string;
  pattern: string;
}): Promise<ResolveResult> {
  await requireAdmin();
  const parsed = testTemplatePatternSchema.safeParse({
    url: input.url.trim(),
    pattern: input.pattern.trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      candidates: [],
      error: parsed.error.issues[0]?.message ?? 'Eingabe ungültig.',
    };
  }
  return await resolveTemplateUrl(parsed.data.url, parsed.data.pattern);
}

export async function useTemplate(
  formData: FormData
): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, useTemplateSchema);
    const user = await requireUser();

    const template = getDb()
      .select()
      .from(templates)
      .where(eq(templates.id, input.templateId))
      .get();
    if (!template) throw new ValidationError('Vorlage nicht gefunden.');

    let targetUrl = template.originalUrl;
    if (template.urlPattern) {
      const result = await resolveTemplateUrl(
        template.originalUrl,
        template.urlPattern
      );
      if (!result.ok || !result.resolved) {
        throw new ValidationError(
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
        throw new ValidationError(err.message);
      }
      throw err;
    }

    revalidatePath('/dashboard');
    revalidatePath('/templates');
    return actionRedirect(`/templates?created=${created.id}`);
  } catch (err) {
    return toActionFail(err, 'useTemplate');
  }
}

// ---------------------------------------------------------------------------
// OG-Override-Actions
// ---------------------------------------------------------------------------

export async function updateLinkOverrides(
  formData: FormData
): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, updateLinkOverridesSchema);
    const { link } = await requireOwnedLink(input.id);

    getDb()
      .update(links)
      .set({
        customTitle: sanitizeOverride(input.customTitle),
        customDescription: sanitizeOverride(input.customDescription),
        customSiteName: sanitizeOverride(input.customSiteName),
        imageHidden: input.imageHidden ? 1 : 0,
      })
      .where(eq(links.id, link.id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${link.id}`);
    revalidatePath(`/t/${link.id}`);
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'updateLinkOverrides');
  }
}

export async function uploadLinkImage(
  formData: FormData
): Promise<ActionResult> {
  try {
    // ID separat validieren — File ist nicht im Zod-Schema.
    const id = String(formData.get('id') ?? '');
    const { link } = await requireOwnedLink(id);

    const file = formData.get('image');
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError('Keine Datei hochgeladen.');
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
    return actionOkData({ filename: result.filename });
  } catch (err) {
    // writeImage wirft Plain-Error mit Validierungs-Message
    // ("Format nicht erkannt." etc.). Lass die direkt durch.
    if (
      err instanceof Error &&
      !(err instanceof AuthError) &&
      !(err instanceof PermissionError) &&
      !(err instanceof ValidationError)
    ) {
      // writeImage's Error-Messages sind benutzerfreundlich (Validation-
      // Texte aus lib/imageStorage), nicht generisch wegmappen.
      if (
        err.message.startsWith('Format nicht erkannt') ||
        err.message.startsWith('Datei ist groesser') ||
        err.message.startsWith('Datei ist leer')
      ) {
        return actionFail(err.message);
      }
    }
    return toActionFail(err, 'uploadLinkImage');
  }
}

export async function clearLinkImageOverride(
  formData: FormData
): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, linkIdOnlySchema);
    const { link } = await requireOwnedLink(input.id);

    if (link.customImagePath) deleteImage(link.customImagePath);

    getDb()
      .update(links)
      .set({ customImagePath: null })
      .where(eq(links.id, link.id))
      .run();

    revalidatePath('/dashboard');
    revalidatePath(`/links/${link.id}`);
    revalidatePath(`/t/${link.id}`);
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'clearLinkImageOverride');
  }
}

// ---------------------------------------------------------------------------
// Redirect-Bridge: Aufrufer, die ein redirect-Result erwarten, koennen
// dieses Helper am Ende der Action verwenden. Es ruft next/navigation
// auf, wenn das Result einen redirect enthaelt, oder gibt das Result
// zurueck.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Form-Action-Wrapper.
//
// Server-Components, die direkt `<form action={fn}>` nutzen, erwarten
// `Promise<void>`. Unsere Actions geben jetzt ActionResult zurueck. Pro
// betroffener Action wird hier ein dunner Wrapper exportiert, der:
//  - das Result verwirft (Form-Action hat kein UI-State, also kein
//    inline-Display moeglich),
//  - bei redirect-Result `redirect()` aufruft,
//  - bei Fehler nur loggt — der Aufrufer sieht das nicht direkt.
//
// Client-Components mit eigenem State (EditLinkButton,
// PreviewOverrideButton, CreateLinkForm, TemplateForm) rufen die
// originalen ActionResult-Functions auf und behandeln den Fehler im UI.
// ---------------------------------------------------------------------------

async function executeOrRedirect(
  result: ActionResult,
  context: string
): Promise<void> {
  if (result.ok && 'redirect' in result) {
    redirect(result.redirect);
  }
  if (!result.ok) {
    console.error(`[${context}] action returned error:`, result.error);
  }
}

export async function deleteLinkFormAction(formData: FormData): Promise<void> {
  await executeOrRedirect(await deleteLink(formData), 'deleteLink');
}

export async function blockHostFormAction(formData: FormData): Promise<void> {
  await executeOrRedirect(await blockHost(formData), 'blockHost');
}

export async function unblockHostFormAction(
  formData: FormData
): Promise<void> {
  await executeOrRedirect(await unblockHost(formData), 'unblockHost');
}

export async function deleteTemplateFormAction(
  formData: FormData
): Promise<void> {
  await executeOrRedirect(await deleteTemplate(formData), 'deleteTemplate');
}

export async function useTemplateFormAction(
  formData: FormData
): Promise<void> {
  // useTemplate ist eine Server-Action, kein React-Hook. ESLint
  // matched faelschlicherweise auf die `use*`-Namens-Konvention.
  // Sauberere Loesung waere Umbenennung in `applyTemplate` — als
  // BACKLOG-Eintrag fuer die spaetere Action-Umbenennungs-Welle.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  await executeOrRedirect(await useTemplate(formData), 'useTemplate');
}

export async function deleteAccountFormAction(): Promise<void> {
  await executeOrRedirect(await deleteAccount(), 'deleteAccount');
}
