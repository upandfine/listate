/**
 * Webhook-Dispatcher (Feature A).
 *
 * Pro User kann eine Webhook-URL hinterlegt werden. Bei jedem
 * Non-Crawler-Klick ruft `dispatchClickWebhook` diese URL asynchron auf
 * (fire-and-forget, Aufrufer wartet nicht). Damit wird /t/[id] weder
 * langsamer noch faellt es aus, wenn der Empfaenger schweigt.
 *
 * Sicherheits-Eigenschaften:
 * - HMAC-SHA256-Signatur ueber den exakten JSON-Body, ablegbar in
 *   `X-Listate-Signature: sha256=<hex>`. Secret pro User; bei
 *   `webhookSecret = null` wird kein Signatur-Header gesetzt.
 * - Timeout 5 s pro Versuch (AbortSignal.timeout).
 * - 1× Retry nach 2 s bei 5xx ODER Netz-/Timeout-Fehler. 4xx-Antworten
 *   werden NICHT wiederholt — fehlerhafte URL/Auth muss der User fixen.
 *
 * Privacy:
 * - Es geht KEINE IP raus. country ist der bereits abgeleitete ISO-Code.
 * - userAgent ist optional und wird durchgereicht, weil der Empfaenger
 *   ihn ohnehin auf Klick-Ebene wissen darf.
 *
 * Aufruf-Kontext:
 *   void dispatchClickWebhook({ ... }).catch(...);
 * Der `.catch` ist defensiv — alle erwarteten Fehler werden bereits in
 * der Funktion geloggt; der `catch` faengt nur den theoretischen Fall
 * eines synchron geworfenen Programmierfehlers.
 */
import { eq } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { users, type Link } from '@/db/schema';
import { defaultHttpClient, type HttpClient } from './http';
import { logger } from './logger';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@/db/schema';

type DB = BetterSQLite3Database<typeof schema>;

export interface ClickWebhookPayload {
  /** Tracking-Link-ID (`links.id`). */
  linkId: string;
  /** Wunsch-Slug, falls vorhanden, sonst null. */
  slug: string | null;
  /** Original-URL des Links (Ziel der Weiterleitung). */
  originalUrl: string;
  /** Klick-Zeitstempel im ISO-8601-UTC-Format. */
  clickedAt: string;
  /** ISO 3166-1 alpha-2 oder null. */
  country: string | null;
  /** User-Agent des Klickers (raw). null wenn Header fehlte. */
  userAgent: string | null;
}

export interface DispatchClickWebhookInput {
  db: DB;
  userId: string;
  link: Pick<Link, 'id' | 'slug' | 'originalUrl'>;
  clickedAt: Date;
  countryCode: string | null;
  userAgent: string | null;
  /** Optional fuer Tests; sonst global fetch. */
  http?: HttpClient;
  /** Zeitquelle fuer Retry-Delay (testbar). Default setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

/** Timeout pro HTTP-Versuch in ms. */
const REQUEST_TIMEOUT_MS = 5000;
/** Delay zwischen den zwei Versuchen in ms. */
const RETRY_DELAY_MS = 2000;

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

/**
 * Baut den Payload und sendet ihn an den User-Webhook. Macht nichts,
 * wenn der User keine `webhook_url` hinterlegt hat.
 */
export async function dispatchClickWebhook(
  input: DispatchClickWebhookInput
): Promise<void> {
  const {
    db,
    userId,
    link,
    clickedAt,
    countryCode,
    userAgent,
    http = defaultHttpClient,
    sleep = defaultSleep,
  } = input;

  const user = db
    .select({
      webhookUrl: users.webhookUrl,
      webhookSecret: users.webhookSecret,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user?.webhookUrl) return;

  const payload: ClickWebhookPayload = {
    linkId: link.id,
    slug: link.slug ?? null,
    originalUrl: link.originalUrl,
    clickedAt: clickedAt.toISOString(),
    country: countryCode,
    userAgent,
  };
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ListateWebhook/1.0',
  };
  if (user.webhookSecret) {
    headers['X-Listate-Signature'] = signPayload(body, user.webhookSecret);
  }

  await sendWithRetry(http, user.webhookUrl, body, headers, sleep, {
    linkId: link.id,
    userId,
  });
}

/** Berechnet `sha256=<hex>` ueber den Payload. */
export function signPayload(body: string, secret: string): string {
  const hex = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hex}`;
}

interface LogContext {
  linkId: string;
  userId: string;
}

async function sendWithRetry(
  http: HttpClient,
  url: string,
  body: string,
  headers: Record<string, string>,
  sleep: (ms: number) => Promise<void>,
  ctx: LogContext
): Promise<void> {
  const first = await trySend(http, url, body, headers);
  if (first.kind === 'ok') return;

  if (first.kind === 'client-error') {
    // 4xx: Empfaenger hat den Request bewusst abgelehnt — Retry waere
    // sinnlos. Nur strukturiert loggen, damit der Maintainer sieht,
    // dass etwas konfiguriert werden muss.
    logger.warn(
      { module: 'webhook', ...ctx, status: first.status },
      'Webhook 4xx — kein Retry'
    );
    return;
  }

  await sleep(RETRY_DELAY_MS);
  const second = await trySend(http, url, body, headers);
  if (second.kind === 'ok') return;

  logger.error(
    {
      module: 'webhook',
      ...ctx,
      attempt: 'second',
      reason:
        second.kind === 'client-error' || second.kind === 'server-error'
          ? `http_${second.status}`
          : second.kind,
    },
    'Webhook nach Retry weiter fehlgeschlagen'
  );
}

type SendResult =
  | { kind: 'ok' }
  | { kind: 'client-error'; status: number }
  | { kind: 'server-error'; status: number }
  | { kind: 'network-error' }
  | { kind: 'timeout' };

async function trySend(
  http: HttpClient,
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<SendResult> {
  try {
    const res = await http(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { kind: 'ok' };
    if (res.status >= 500) return { kind: 'server-error', status: res.status };
    return { kind: 'client-error', status: res.status };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { kind: 'timeout' };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { kind: 'timeout' };
    }
    return { kind: 'network-error' };
  }
}
