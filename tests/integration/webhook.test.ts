/**
 * Integration-Tests fuer lib/webhook::dispatchClickWebhook.
 *
 * Pures Helper-Modul — wir testen gegen In-Memory-DB und mit
 * injiziertem HttpClient + injizierter Sleep-Funktion (damit Retry
 * nicht 2 s blockiert).
 */
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '@/lib/http';
import { dispatchClickWebhook, signPayload } from '@/lib/webhook';
import { logger } from '@/lib/logger';
import {
  createTestDb,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

let h: TestDbHandle;
const noSleep = async () => {};

/** Erzeugt ein typisiertes HttpClient-Mock — typing kommt aus lib/http. */
function makeHttp(impl?: HttpClient) {
  return vi.fn<HttpClient>(
    impl ?? (async () => new Response(null, { status: 200 }))
  );
}

beforeEach(() => {
  h = createTestDb();
});

afterEach(() => {
  h.close();
  vi.restoreAllMocks();
});

describe('dispatchClickWebhook — Vorbedingungen', () => {
  it('no-op, wenn der User keine webhook_url hinterlegt hat', async () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId, originalUrl: 'https://example.test/x' });
    const http = makeHttp();

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test/x' },
      clickedAt: new Date('2026-01-01T12:00:00Z'),
      countryCode: 'DE',
      userAgent: 'Mozilla/5.0',
      http,
      sleep: noSleep,
    });

    expect(http).not.toHaveBeenCalled();
  });

  it('no-op, wenn der User nicht (mehr) existiert', async () => {
    const http = makeHttp();
    await dispatchClickWebhook({
      db: h.db,
      userId: 'ghost',
      link: { id: 'l1', slug: null, originalUrl: 'https://example.test/x' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });
    expect(http).not.toHaveBeenCalled();
  });
});

describe('dispatchClickWebhook — Payload', () => {
  it('POSTet JSON mit allen Feldern + ISO-Timestamp an die hinterlegte URL', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
      webhookSecret: 's3cret',
    });
    const linkId = seedLink(h.sqlite, {
      userId,
      slug: 'mein-slug',
      originalUrl: 'https://example.test/article/42',
    });
    const http = makeHttp();

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: {
        id: linkId,
        slug: 'mein-slug',
        originalUrl: 'https://example.test/article/42',
      },
      clickedAt: new Date('2026-05-13T08:30:15.000Z'),
      countryCode: 'DE',
      userAgent: 'Mozilla/5.0 (Macintosh)',
      http,
      sleep: noSleep,
    });

    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0];
    expect(url).toBe('https://hooks.example.test/in');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'User-Agent': 'ListateWebhook/1.0',
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      linkId,
      slug: 'mein-slug',
      originalUrl: 'https://example.test/article/42',
      clickedAt: '2026-05-13T08:30:15.000Z',
      country: 'DE',
      userAgent: 'Mozilla/5.0 (Macintosh)',
    });
  });

  it('country=null und userAgent=null werden als JSON-null serialisiert', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp();

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test/page' },
      clickedAt: new Date('2026-01-02T03:04:05.000Z'),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    const body = JSON.parse(http.mock.calls[0][1]!.body as string);
    expect(body.country).toBeNull();
    expect(body.userAgent).toBeNull();
    expect(body.slug).toBeNull();
  });
});

describe('dispatchClickWebhook — Signatur', () => {
  it('setzt X-Listate-Signature mit HMAC-SHA256 ueber den Body, wenn Secret gesetzt', async () => {
    const secret = 'topsecret';
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
      webhookSecret: secret,
    });
    const linkId = seedLink(h.sqlite, { userId });

    let captured: { body: string; signature: string } | null = null;
    const http = makeHttp(async (_url, init) => {
      captured = {
        body: init!.body as string,
        signature: (init!.headers as Record<string, string>)[
          'X-Listate-Signature'
        ],
      };
      return new Response(null, { status: 200 });
    });

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date('2026-05-13T08:00:00.000Z'),
      countryCode: 'DE',
      userAgent: null,
      http,
      sleep: noSleep,
    });

    expect(captured).not.toBeNull();
    const expected =
      'sha256=' +
      createHmac('sha256', secret).update(captured!.body).digest('hex');
    expect(captured!.signature).toBe(expected);
  });

  it('setzt KEINEN Signatur-Header, wenn webhook_secret = null', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
      webhookSecret: null,
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp();

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    const headers = http.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers['X-Listate-Signature']).toBeUndefined();
  });

  it('signPayload ist reproduzierbar (gleiche Inputs → gleicher Hex)', () => {
    const a = signPayload('{"x":1}', 'secret');
    const b = signPayload('{"x":1}', 'secret');
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
});

describe('dispatchClickWebhook — Retry-Verhalten', () => {
  it('5xx → Retry, danach Erfolg = OK ohne Error-Log', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    expect(http).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('zweimal 5xx → kein Throw, aber Error-Log mit reason=http_500', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp(async () => new Response(null, { status: 500 }));
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    expect(http).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [ctx] = errorSpy.mock.calls[0];
    expect(ctx).toMatchObject({ module: 'webhook', reason: 'http_500' });
  });

  it('4xx → kein Retry, nur warn-Log', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp(async () => new Response(null, { status: 404 }));
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    expect(http).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Netzwerk-Error → Retry, danach Erfolg', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    expect(http).toHaveBeenCalledTimes(2);
  });

  it('TimeoutError wird als timeout behandelt und retried', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const timeoutErr = new Error('aborted');
    timeoutErr.name = 'TimeoutError';
    const http = makeHttp()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep: noSleep,
    });

    expect(http).toHaveBeenCalledTimes(2);
  });

  it('wartet zwischen den beiden Versuchen via injizierter sleep-Funktion', async () => {
    const userId = seedUser(h.sqlite, {
      webhookUrl: 'https://hooks.example.test/in',
    });
    const linkId = seedLink(h.sqlite, { userId });
    const http = makeHttp()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const sleep = vi.fn(async () => {});

    await dispatchClickWebhook({
      db: h.db,
      userId,
      link: { id: linkId, slug: null, originalUrl: 'https://example.test' },
      clickedAt: new Date(),
      countryCode: null,
      userAgent: null,
      http,
      sleep,
    });

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
