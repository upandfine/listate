'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { blockedHosts, links } from '@/db/schema';
import { requireAdmin } from '@/lib/actionHelpers';
import { logAuditEvent } from '@/lib/auditLog';
import {
  actionOk,
  executeOrRedirect,
  parseFormData,
  toActionFail,
  ValidationError,
  type ActionResult,
} from '@/lib/actionResult';
import { blockHostSchema, unblockHostSchema } from '@/lib/actionSchemas';
import { normalizeHost } from '@/lib/host';

// ---------------------------------------------------------------------------
// blockHost
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
        logAuditEvent({
          userId: user.id,
          action: 'link.bulk_deleted',
          targetId: host,
          metadata: { count: idsToDelete.length, trigger: 'block_host' },
        });
      }
    }

    logAuditEvent({
      userId: user.id,
      action: 'host.blocked',
      targetId: host,
      metadata: { reason, alsoDeleted: input.alsoDelete },
    });

    revalidatePath('/admin/blocked');
    revalidatePath('/dashboard');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'blockHost');
  }
}

export async function blockHostFormAction(formData: FormData): Promise<void> {
  executeOrRedirect(await blockHost(formData), 'blockHost');
}

// ---------------------------------------------------------------------------
// unblockHost
// ---------------------------------------------------------------------------

export async function unblockHost(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, unblockHostSchema);
    const user = await requireAdmin();

    getDb()
      .delete(blockedHosts)
      .where(eq(blockedHosts.host, input.host))
      .run();
    logAuditEvent({
      userId: user.id,
      action: 'host.unblocked',
      targetId: input.host,
    });
    revalidatePath('/admin/blocked');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'unblockHost');
  }
}

export async function unblockHostFormAction(
  formData: FormData
): Promise<void> {
  executeOrRedirect(await unblockHost(formData), 'unblockHost');
}
