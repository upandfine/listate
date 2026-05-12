'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { links } from '@/db/schema';
import {
  requireOwnedLink,
  sanitizeOverride,
} from '@/lib/actionHelpers';
import {
  actionFail,
  actionOk,
  actionOkData,
  AuthError,
  parseFormData,
  PermissionError,
  toActionFail,
  ValidationError,
  type ActionResult,
} from '@/lib/actionResult';
import {
  linkIdOnlySchema,
  updateLinkOverridesSchema,
} from '@/lib/actionSchemas';
import { deleteImage, writeImage } from '@/lib/imageStorage';

// ---------------------------------------------------------------------------
// updateLinkOverrides — Title/Description/SiteName + image_hidden-Flag
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

// ---------------------------------------------------------------------------
// uploadLinkImage
// ---------------------------------------------------------------------------

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
    // writeImage wirft Plain-Error mit benutzerfreundlichen Messages,
    // die wir 1:1 durchreichen wollen.
    if (
      err instanceof Error &&
      !(err instanceof AuthError) &&
      !(err instanceof PermissionError) &&
      !(err instanceof ValidationError) &&
      (err.message.startsWith('Format nicht erkannt') ||
        err.message.startsWith('Datei ist groesser') ||
        err.message.startsWith('Datei ist leer'))
    ) {
      return actionFail(err.message);
    }
    return toActionFail(err, 'uploadLinkImage');
  }
}

// ---------------------------------------------------------------------------
// clearLinkImageOverride
// ---------------------------------------------------------------------------

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
