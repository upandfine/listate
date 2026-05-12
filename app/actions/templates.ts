'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { templates } from '@/db/schema';
import { requireAdmin, requireUser } from '@/lib/actionHelpers';
import { logAuditEvent } from '@/lib/auditLog';
import {
  actionOk,
  actionRedirect,
  executeOrRedirect,
  parseFormData,
  toActionFail,
  ValidationError,
  type ActionResult,
} from '@/lib/actionResult';
import {
  createTemplateSchema,
  deleteTemplateSchema,
  testTemplatePatternSchema,
  useTemplateSchema,
} from '@/lib/actionSchemas';
import {
  createTrackingLink,
  TrackingLinkError,
} from '@/lib/createTrackingLink';
import {
  resolveTemplateUrl,
  type ResolveResult,
} from '@/lib/resolveTemplateUrl';

// ---------------------------------------------------------------------------
// createTemplate
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

    logAuditEvent({
      userId: user.id,
      action: 'template.created',
      metadata: { label: input.label, url: parsed.toString() },
    });

    revalidatePath('/admin/templates');
    revalidatePath('/templates');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'createTemplate');
  }
}

// ---------------------------------------------------------------------------
// deleteTemplate
// ---------------------------------------------------------------------------

export async function deleteTemplate(
  formData: FormData
): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, deleteTemplateSchema);
    const user = await requireAdmin();

    getDb().delete(templates).where(eq(templates.id, input.id)).run();
    logAuditEvent({
      userId: user.id,
      action: 'template.deleted',
      targetId: input.id,
    });
    revalidatePath('/admin/templates');
    revalidatePath('/templates');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'deleteTemplate');
  }
}

export async function deleteTemplateFormAction(
  formData: FormData
): Promise<void> {
  executeOrRedirect(await deleteTemplate(formData), 'deleteTemplate');
}

// ---------------------------------------------------------------------------
// testTemplatePattern — wird direkt aus Client-Component aufgerufen,
// daher ResolveResult statt ActionResult.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// applyTemplate — Vorlage anwenden + neuen Tracking-Link erstellen.
// (Vorher useTemplate — Umbenennung wegen ESLint-Hook-Regel-Match.)
// ---------------------------------------------------------------------------

export async function applyTemplate(
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

    logAuditEvent({
      userId: user.id,
      action: 'template.applied',
      targetId: input.templateId,
      metadata: { createdLinkId: created.id, targetUrl },
    });

    revalidatePath('/dashboard');
    revalidatePath('/templates');
    return actionRedirect(`/templates?created=${created.id}`);
  } catch (err) {
    return toActionFail(err, 'applyTemplate');
  }
}

export async function applyTemplateFormAction(
  formData: FormData
): Promise<void> {
  executeOrRedirect(await applyTemplate(formData), 'applyTemplate');
}
