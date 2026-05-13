/**
 * Integration-Tests fuer lib/auditLog + die Audit-Eintraege in den
 * Server-Actions.
 *
 * Gegen In-Memory-DB. Mocks identisch zu actions.test.ts, plus
 * Reset des Rate-Limit-Counters, damit Tests isoliert sind.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  session: null as
    | null
    | {
        user: {
          id: string;
          email?: string;
          role?: 'user' | 'admin';
        } | null;
      },
  resolveResult: null as
    | null
    | { ok: boolean; resolved?: string; candidates: string[]; error?: string },
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => mocks.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('open-graph-scraper', () => ({
  default: vi.fn(async () => ({ result: {}, error: true })),
}));

vi.mock('@/lib/adultFilter', () => ({
  isAdultHost: vi.fn(() => false),
  adultHostCount: vi.fn(() => 0),
}));

vi.mock('@/lib/resolveTemplateUrl', () => ({
  resolveTemplateUrl: vi.fn(async () => mocks.resolveResult),
}));

import { deleteAccount } from '@/app/actions/account';
import { blockHost, unblockHost } from '@/app/actions/admin';
import { deleteLink } from '@/app/actions/links';
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
} from '@/app/actions/templates';
import { logAuditEvent } from '@/lib/auditLog';
import { logger } from '@/lib/logger';
import { _resetRateLimitForTests } from '@/lib/rateLimit';

let h: TestDbHandle;

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

interface AuditRow {
  id: number;
  user_id: string | null;
  action: string;
  target_id: string | null;
  metadata: string | null;
  created_at: string;
}

function readAuditLog(): AuditRow[] {
  return h.sqlite
    .prepare(`SELECT * FROM audit_log ORDER BY id ASC`)
    .all() as AuditRow[];
}

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.session = null;
  mocks.resolveResult = null;
  vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', '');
  _resetRateLimitForTests();
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// logAuditEvent direkt
// ---------------------------------------------------------------------------

describe('logAuditEvent', () => {
  it('schreibt einen Eintrag mit allen Feldern', () => {
    logAuditEvent({
      userId: 'u1',
      action: 'link.deleted',
      targetId: 'lnk1',
      metadata: { foo: 'bar' },
    });

    const rows = readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('u1');
    expect(rows[0].action).toBe('link.deleted');
    expect(rows[0].target_id).toBe('lnk1');
    expect(JSON.parse(rows[0].metadata!)).toEqual({ foo: 'bar' });
  });

  it('userId=null wird gespeichert (z.B. account.deleted)', () => {
    logAuditEvent({
      userId: null,
      action: 'account.deleted',
      targetId: 'user-x',
    });

    const rows = readAuditLog();
    expect(rows[0].user_id).toBeNull();
    expect(rows[0].action).toBe('account.deleted');
  });

  it('crasht NICHT bei DB-Fehler (defensiv)', () => {
    // Bewusst eine kaputte DB-Sicht setzen.
    mocks.currentDb = {
      insert: () => {
        throw new Error('db gone');
      },
    };
    const errSpy = vi.spyOn(logger, 'error').mockImplementation((() => {}) as never);

    expect(() =>
      logAuditEvent({ userId: 'u1', action: 'link.deleted' })
    ).not.toThrow();
    expect(errSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'auditLog',
        auditAction: 'link.deleted',
        err: expect.any(Error),
      }),
      expect.stringContaining('Audit-Log-Insert')
    );
  });
});

// ---------------------------------------------------------------------------
// Audit-Integration in Server-Actions
// ---------------------------------------------------------------------------

describe('Audit-Eintraege in Server-Actions', () => {
  it('deleteLink schreibt link.deleted-Eintrag', async () => {
    const me = seedUser(h.sqlite, { id: 'me' });
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    await deleteLink(fd({ id: 'lnk' }));

    const rows = readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: me,
      action: 'link.deleted',
      target_id: 'lnk',
    });
    expect(JSON.parse(rows[0].metadata!)).toMatchObject({
      originalUrl: expect.any(String),
      owner: me,
    });
  });

  it('blockHost schreibt host.blocked-Eintrag', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await blockHost(
      fd({ host: 'bad.test', reason: 'phishing', alsoDelete: 'on' })
    );

    const rows = readAuditLog();
    const blockedEntry = rows.find((r) => r.action === 'host.blocked');
    expect(blockedEntry).toBeTruthy();
    expect(blockedEntry?.target_id).toBe('bad.test');
    expect(JSON.parse(blockedEntry!.metadata!)).toMatchObject({
      reason: 'phishing',
      alsoDeleted: true,
    });
  });

  it('blockHost mit alsoDelete: schreibt zusaetzlich link.bulk_deleted', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const u = seedUser(h.sqlite, { id: 'u' });
    seedLink(h.sqlite, {
      id: 'lnk',
      userId: u,
      originalUrl: 'https://bad.test/',
    });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await blockHost(fd({ host: 'bad.test', alsoDelete: 'on' }));

    const rows = readAuditLog();
    const bulk = rows.find((r) => r.action === 'link.bulk_deleted');
    expect(bulk).toBeTruthy();
    expect(JSON.parse(bulk!.metadata!)).toMatchObject({
      count: 1,
      trigger: 'block_host',
    });
  });

  it('unblockHost schreibt host.unblocked-Eintrag', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    h.sqlite
      .prepare(`INSERT INTO blocked_hosts (host) VALUES (?)`)
      .run('bad.test');
    mocks.session = { user: { id: admin, role: 'admin' } };

    await unblockHost(fd({ host: 'bad.test' }));

    const rows = readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: admin,
      action: 'host.unblocked',
      target_id: 'bad.test',
    });
  });

  it('createTemplate schreibt template.created-Eintrag', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await createTemplate(
      fd({ label: 'Test', url: 'https://example.test/foo' })
    );

    const rows = readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('template.created');
    expect(JSON.parse(rows[0].metadata!)).toMatchObject({
      label: 'Test',
      url: 'https://example.test/foo',
    });
  });

  it('deleteTemplate schreibt template.deleted-Eintrag', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    h.sqlite
      .prepare(
        `INSERT INTO templates (id, label, original_url) VALUES (?, ?, ?)`
      )
      .run('t1', 'Test', 'https://x.test');
    mocks.session = { user: { id: admin, role: 'admin' } };

    await deleteTemplate(fd({ id: 't1' }));

    const rows = readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: admin,
      action: 'template.deleted',
      target_id: 't1',
    });
  });

  it('applyTemplate schreibt template.applied-Eintrag', async () => {
    const me = seedUser(h.sqlite, { id: 'me' });
    h.sqlite
      .prepare(
        `INSERT INTO templates (id, label, original_url) VALUES (?, ?, ?)`
      )
      .run('t1', 'Test', 'https://example.test/page');
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await applyTemplate(fd({ templateId: 't1' }));
    expect(res.ok).toBe(true);

    const rows = readAuditLog();
    const entry = rows.find((r) => r.action === 'template.applied');
    expect(entry).toBeTruthy();
    expect(entry?.user_id).toBe(me);
    expect(entry?.target_id).toBe('t1');
    expect(JSON.parse(entry!.metadata!)).toMatchObject({
      createdLinkId: expect.any(String),
      targetUrl: 'https://example.test/page',
    });
  });

  it('deleteAccount schreibt account.deleted-Eintrag mit userId=null', async () => {
    const me = seedUser(h.sqlite, { email: 'gone@test' });
    mocks.session = { user: { id: me, email: 'gone@test', role: 'user' } };

    await deleteAccount();

    // Audit-Eintrag bleibt erhalten, auch nachdem der User weg ist
    // (audit_log hat keinen FK auf user).
    const rows = readAuditLog();
    const entry = rows.find((r) => r.action === 'account.deleted');
    expect(entry).toBeTruthy();
    expect(entry?.user_id).toBeNull();
    expect(entry?.target_id).toBe(me);
    expect(JSON.parse(entry!.metadata!)).toMatchObject({
      email: 'gone@test',
    });
  });
});
