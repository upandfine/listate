'use server';

/**
 * Server-Actions fuer die Webhook-Konfiguration im Settings-Bereich.
 *
 * Feature A: pro User optional ein POST-Endpoint, der bei jedem
 * Non-Crawler-Klick informiert wird. Siehe `lib/webhook.ts` fuer
 * den Dispatcher.
 *
 * Sicherheits-Konventionen:
 * - Secret wird beim ersten Setzen einer URL automatisch generiert,
 *   sodass die Signatur ohne extra Schritt funktioniert.
 * - regenerateWebhookSecret() rotiert nur das Secret, nicht die URL.
 * - clearWebhook() loescht URL + Secret atomar.
 * - testWebhook() sendet einen Sample-Payload an die hinterlegte URL
 *   und liefert Status + Response-Snippet zurueck, damit der User
 *   sieht, ob Empfaenger erreichbar ist.
 */
import { randomBytes, createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/actionHelpers';
import { logAuditEvent } from '@/lib/auditLog';
import {
  actionFail,
  actionOk,
  actionOkData,
  executeOrRedirect,
  parseFormData,
  toActionFail,
  type ActionResult,
} from '@/lib/actionResult';
import { updateWebhookSchema } from '@/lib/actionSchemas';
import { logger } from '@/lib/logger';

/** 32 Bytes → 64 Hex-Chars; reicht fuer HMAC-SHA256. */
function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

// ---------------------------------------------------------------------------
// updateWebhook — URL setzen oder aktualisieren. Generiert beim ersten
// Setzen automatisch ein Secret.
// ---------------------------------------------------------------------------

export async function updateWebhook(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { url } = parseFormData(formData, updateWebhookSchema);
    const user = await requireUser();
    const db = getDb();

    const current = db
      .select({ secret: users.webhookSecret })
      .from(users)
      .where(eq(users.id, user.id))
      .get();

    const secret = current?.secret ?? generateSecret();

    db.update(users)
      .set({ webhookUrl: url, webhookSecret: secret })
      .where(eq(users.id, user.id))
      .run();

    logAuditEvent({
      userId: user.id,
      action: 'webhook.configured',
      targetId: user.id,
      // KEINE URL ins Audit-Log (PII-light: Empfaenger-Endpoint, koennte
      // ueber Token in der URL sensible Info enthalten). Nur dass es
      // konfiguriert wurde.
      metadata: { hostKnown: true },
    });

    revalidatePath('/settings');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'updateWebhook');
  }
}

export async function updateWebhookFormAction(
  formData: FormData
): Promise<void> {
  executeOrRedirect(await updateWebhook(formData), 'updateWebhook');
}

// ---------------------------------------------------------------------------
// regenerateWebhookSecret — rotiert nur das Secret, laesst URL stehen.
// ---------------------------------------------------------------------------

export async function regenerateWebhookSecret(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const db = getDb();

    const current = db
      .select({ url: users.webhookUrl })
      .from(users)
      .where(eq(users.id, user.id))
      .get();

    if (!current?.url) {
      return actionFail('Kein Webhook konfiguriert.');
    }

    db.update(users)
      .set({ webhookSecret: generateSecret() })
      .where(eq(users.id, user.id))
      .run();

    logAuditEvent({
      userId: user.id,
      action: 'webhook.secret_rotated',
      targetId: user.id,
    });

    revalidatePath('/settings');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'regenerateWebhookSecret');
  }
}

export async function regenerateWebhookSecretFormAction(): Promise<void> {
  executeOrRedirect(
    await regenerateWebhookSecret(),
    'regenerateWebhookSecret'
  );
}

// ---------------------------------------------------------------------------
// clearWebhook — URL + Secret loeschen.
// ---------------------------------------------------------------------------

export async function clearWebhook(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const db = getDb();

    db.update(users)
      .set({ webhookUrl: null, webhookSecret: null })
      .where(eq(users.id, user.id))
      .run();

    logAuditEvent({
      userId: user.id,
      action: 'webhook.cleared',
      targetId: user.id,
    });

    revalidatePath('/settings');
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'clearWebhook');
  }
}

export async function clearWebhookFormAction(): Promise<void> {
  executeOrRedirect(await clearWebhook(), 'clearWebhook');
}

// ---------------------------------------------------------------------------
// testWebhook — sendet einen Sample-Payload an die hinterlegte URL,
// damit der User sehen kann, ob der Empfaenger erreichbar ist und der
// Signatur-Check durchgeht.
// ---------------------------------------------------------------------------

export interface TestWebhookOk {
  /** HTTP-Status der Empfaenger-Antwort. */
  status: number;
  /** Wie lange hat der Request gedauert (ms). */
  durationMs: number;
}

export async function testWebhook(): Promise<ActionResult<TestWebhookOk>> {
  try {
    const user = await requireUser();
    const db = getDb();

    const row = db
      .select({
        url: users.webhookUrl,
        secret: users.webhookSecret,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .get();

    if (!row?.url) {
      return actionFail('Kein Webhook konfiguriert.');
    }

    const payload = {
      linkId: 'test-' + randomBytes(4).toString('hex'),
      slug: null,
      originalUrl: 'https://example.test/test',
      clickedAt: new Date().toISOString(),
      country: null,
      userAgent: null,
      test: true,
    };
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ListateWebhook/1.0 (test)',
    };
    if (row.secret) {
      const sig = createHmac('sha256', row.secret).update(body).digest('hex');
      headers['X-Listate-Signature'] = `sha256=${sig}`;
    }

    const t0 = Date.now();
    try {
      const res = await fetch(row.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      });
      const durationMs = Date.now() - t0;
      logger.info(
        { module: 'webhook', userId: user.id, status: res.status, durationMs },
        'testWebhook fertig'
      );
      return actionOkData({ status: res.status, durationMs });
    } catch (err) {
      const reason =
        err instanceof Error && err.name === 'TimeoutError'
          ? 'Timeout (5 s)'
          : 'Netzwerkfehler';
      return actionFail(`Empfaenger nicht erreichbar: ${reason}.`);
    }
  } catch (err) {
    return toActionFail(err, 'testWebhook');
  }
}
