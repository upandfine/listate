'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { links, users } from '@/db/schema';
import { requireUser } from '@/lib/actionHelpers';
import {
  actionRedirect,
  executeOrRedirect,
  toActionFail,
  type ActionResult,
} from '@/lib/actionResult';
import { deleteImage } from '@/lib/imageStorage';

// ---------------------------------------------------------------------------
// deleteAccount — DSGVO Art. 17.
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

    return actionRedirect('/login');
  } catch (err) {
    return toActionFail(err, 'deleteAccount');
  }
}

export async function deleteAccountFormAction(): Promise<void> {
  executeOrRedirect(await deleteAccount(), 'deleteAccount');
}
