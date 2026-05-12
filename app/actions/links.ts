'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { links } from '@/db/schema';
import { requireOwnedLink } from '@/lib/actionHelpers';
import {
  actionOk,
  executeOrRedirect,
  parseFormData,
  toActionFail,
  type ActionResult,
} from '@/lib/actionResult';
import {
  deleteLinkSchema,
  updateLinkSchema,
} from '@/lib/actionSchemas';
import { logAuditEvent } from '@/lib/auditLog';
import {
  fetchOg,
  normalizeAndCheckSlug,
  validateTrackingUrl,
} from '@/lib/createTrackingLink';
import { deleteImage } from '@/lib/imageStorage';
import { normalizeTags, tagsToString } from '@/lib/tags';
import { ttlToExpiresAt } from '@/lib/ttl';

// ---------------------------------------------------------------------------
// updateLink — Original-URL, Slug, Tags, Ablauf
// ---------------------------------------------------------------------------

export async function updateLink(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, updateLinkSchema);
    const { link } = await requireOwnedLink(input.id);

    // Edit-Form zeigt "https://" als Präfix-Label, im Input steht aber nur
    // der Host. Wenn kein Schema mitkommt, ergänzen wir es serverseitig.
    const newUrlInput = input.url.trim();
    const newUrlRaw = newUrlInput
      ? /^https?:\/\//i.test(newUrlInput)
        ? newUrlInput
        : `https://${newUrlInput}`
      : '';

    const slug = normalizeAndCheckSlug(input.slug, link.id);
    const tags = normalizeTags(input.tags);

    let expiresAt: string | null | undefined = undefined;
    if (input.ttlClear) {
      expiresAt = null;
    } else if (input.ttl) {
      expiresAt = ttlToExpiresAt(input.ttl);
    }

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
    const { user, link } = await requireOwnedLink(input.id);

    getDb().delete(links).where(eq(links.id, link.id)).run();
    if (link.customImagePath) deleteImage(link.customImagePath);
    logAuditEvent({
      userId: user.id,
      action: 'link.deleted',
      targetId: link.id,
      metadata: { originalUrl: link.originalUrl, owner: link.userId },
    });
    revalidatePath('/dashboard');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'deleteLink');
  }
}

export async function deleteLinkFormAction(formData: FormData): Promise<void> {
  executeOrRedirect(await deleteLink(formData), 'deleteLink');
}
