/**
 * Integration-Tests fuer app/actions/webhook.ts.
 *
 * Vier Actions: updateWebhook, regenerateWebhookSecret, clearWebhook,
 * testWebhook. Mocks orientieren sich an actions.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, seedUser, type TestDbHandle } from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  session: null as
    | null
    | { user: { id: string; role?: 'user' | 'admin' } | null },
  fetchImpl: vi.fn() as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => mocks.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(() => undefined),
}));

import {
  clearWebhook,
  regenerateWebhookSecret,
  testWebhook,
  updateWebhook,
} from '@/app/actions/webhook';

let h: TestDbHandle;
let userId: string;

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  userId = seedUser(h.sqlite);
  mocks.session = { user: { id: userId, role: 'user' } };
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
  mocks.session = null;
  vi.restoreAllMocks();
});

describe('updateWebhook', () => {
  it('verlangt Login', async () => {
    mocks.session = null;
    const res = await updateWebhook(fd({ url: 'https://hooks.example.test/x' }));
    expect(res).toEqual({ ok: false, error: 'Nicht angemeldet.' });
  });

  it('lehnt nicht-https-URL ab', async () => {
    const res = await updateWebhook(fd({ url: 'http://hooks.example.test/x' }));
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toMatch(/https:\/\//);
  });

  it('lehnt leere URL ab', async () => {
    const res = await updateWebhook(fd({ url: '' }));
    expect(res.ok).toBe(false);
  });

  it('lehnt URL > 500 Zeichen ab', async () => {
    const long = 'https://hooks.example.test/' + 'a'.repeat(500);
    const res = await updateWebhook(fd({ url: long }));
    expect(res.ok).toBe(false);
  });

  it('speichert URL und generiert beim ersten Mal ein Secret', async () => {
    const res = await updateWebhook(fd({ url: 'https://hooks.example.test/x' }));
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT webhook_url, webhook_secret FROM user WHERE id = ?`)
      .get(userId) as { webhook_url: string; webhook_secret: string };
    expect(row.webhook_url).toBe('https://hooks.example.test/x');
    expect(row.webhook_secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('aendert die URL, behaelt aber das vorhandene Secret', async () => {
    h.sqlite
      .prepare(
        `UPDATE user SET webhook_url = ?, webhook_secret = ? WHERE id = ?`
      )
      .run('https://hooks.example.test/old', 'existing-secret', userId);

    const res = await updateWebhook(fd({ url: 'https://hooks.example.test/new' }));
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT webhook_url, webhook_secret FROM user WHERE id = ?`)
      .get(userId) as { webhook_url: string; webhook_secret: string };
    expect(row.webhook_url).toBe('https://hooks.example.test/new');
    expect(row.webhook_secret).toBe('existing-secret');
  });

  it('schreibt webhook.configured ins Audit-Log', async () => {
    await updateWebhook(fd({ url: 'https://hooks.example.test/x' }));
    const row = h.sqlite
      .prepare(
        `SELECT action, user_id FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(userId) as { action: string; user_id: string };
    expect(row.action).toBe('webhook.configured');
  });

  it('Audit-Log enthaelt KEINE URL (Endpoint koennte Token-Auth tragen)', async () => {
    await updateWebhook(
      fd({ url: 'https://hooks.example.test/x?token=secret' })
    );
    const row = h.sqlite
      .prepare(
        `SELECT metadata FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(userId) as { metadata: string };
    expect(row.metadata).not.toContain('hooks.example.test');
    expect(row.metadata).not.toContain('token=secret');
  });
});

describe('regenerateWebhookSecret', () => {
  it('verlangt Login', async () => {
    mocks.session = null;
    const res = await regenerateWebhookSecret();
    expect(res).toEqual({ ok: false, error: 'Nicht angemeldet.' });
  });

  it('lehnt ab, wenn keine URL konfiguriert ist', async () => {
    const res = await regenerateWebhookSecret();
    expect(res).toEqual({ ok: false, error: 'Kein Webhook konfiguriert.' });
  });

  it('rotiert das Secret, laesst URL stehen', async () => {
    h.sqlite
      .prepare(
        `UPDATE user SET webhook_url = ?, webhook_secret = ? WHERE id = ?`
      )
      .run('https://hooks.example.test/x', 'old-secret', userId);

    const res = await regenerateWebhookSecret();
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT webhook_url, webhook_secret FROM user WHERE id = ?`)
      .get(userId) as { webhook_url: string; webhook_secret: string };
    expect(row.webhook_url).toBe('https://hooks.example.test/x');
    expect(row.webhook_secret).not.toBe('old-secret');
    expect(row.webhook_secret).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('clearWebhook', () => {
  it('verlangt Login', async () => {
    mocks.session = null;
    const res = await clearWebhook();
    expect(res).toEqual({ ok: false, error: 'Nicht angemeldet.' });
  });

  it('setzt URL und Secret auf NULL', async () => {
    h.sqlite
      .prepare(
        `UPDATE user SET webhook_url = ?, webhook_secret = ? WHERE id = ?`
      )
      .run('https://hooks.example.test/x', 'sssh', userId);

    const res = await clearWebhook();
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT webhook_url, webhook_secret FROM user WHERE id = ?`)
      .get(userId) as {
      webhook_url: string | null;
      webhook_secret: string | null;
    };
    expect(row.webhook_url).toBeNull();
    expect(row.webhook_secret).toBeNull();
  });

  it('idempotent: wenn keine URL gesetzt war, ist es trotzdem ok', async () => {
    const res = await clearWebhook();
    expect(res).toEqual({ ok: true });
  });
});

describe('testWebhook', () => {
  it('verlangt Login', async () => {
    mocks.session = null;
    const res = await testWebhook();
    expect(res).toEqual({ ok: false, error: 'Nicht angemeldet.' });
  });

  it('lehnt ab, wenn keine URL konfiguriert ist', async () => {
    const res = await testWebhook();
    expect(res).toEqual({ ok: false, error: 'Kein Webhook konfiguriert.' });
  });

  it('sendet POST mit Signatur und liefert Status zurueck', async () => {
    h.sqlite
      .prepare(
        `UPDATE user SET webhook_url = ?, webhook_secret = ? WHERE id = ?`
      )
      .run('https://hooks.example.test/x', 'sec', userId);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));

    const res = await testWebhook();
    expect(res.ok).toBe(true);
    if (res.ok && 'data' in res) {
      expect(res.data.status).toBe(200);
      expect(res.data.durationMs).toBeGreaterThanOrEqual(0);
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://hooks.example.test/x');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Listate-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    const body = JSON.parse(init!.body as string);
    expect(body.test).toBe(true);
  });

  it('liefert Fehler-Message bei Netzwerk-Error', async () => {
    h.sqlite
      .prepare(
        `UPDATE user SET webhook_url = ?, webhook_secret = ? WHERE id = ?`
      )
      .run('https://hooks.example.test/x', 'sec', userId);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed')
    );

    const res = await testWebhook();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Netzwerkfehler/);
  });
});
