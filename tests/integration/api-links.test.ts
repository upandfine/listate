/**
 * Integration-Tests fuer /api/links (GET).
 * Deckt: Auth, Owner-Filter, Admin-Override, expired-Filter, tracking_url.
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
    | { user: { id: string; role?: 'user' | 'admin' } | null },
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => mocks.session),
}));

vi.mock('@/lib/baseUrl', () => ({
  getBaseUrl: vi.fn(async () => 'https://listate.test'),
}));

import { GET } from '@/app/api/links/route';
import { _resetRateLimitForTests } from '@/lib/rateLimit';

let h: TestDbHandle;

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.session = null;
  _resetRateLimitForTests();
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
});

function req(query = ''): Request {
  return new Request(`https://listate.test/api/links${query}`);
}

describe('GET /api/links — Auth', () => {
  it('401 ohne Session', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});

describe('GET /api/links — User-Sicht', () => {
  it('liefert nur eigene Links', async () => {
    const me = seedUser(h.sqlite, { id: 'me' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'mine1', userId: me });
    seedLink(h.sqlite, { id: 'mine2', userId: me });
    seedLink(h.sqlite, { id: 'theirs', userId: other });

    mocks.session = { user: { id: me, role: 'user' } };

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    const ids = body.map((l) => l.id).sort();
    expect(ids).toEqual(['mine1', 'mine2']);
  });

  it('blendet abgelaufene Links per Default aus', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, {
      id: 'active',
      userId: me,
      expiresAt: '2999-12-31 23:59:59',
    });
    seedLink(h.sqlite, {
      id: 'expired',
      userId: me,
      expiresAt: '2000-01-01 00:00:00',
    });
    seedLink(h.sqlite, { id: 'noexpiry', userId: me });

    mocks.session = { user: { id: me, role: 'user' } };

    const res = await GET(req());
    const body = (await res.json()) as Array<Record<string, unknown>>;
    const ids = body.map((l) => l.id).sort();
    expect(ids).toEqual(['active', 'noexpiry']);
  });

  it('?expired=1 zeigt auch abgelaufene Links', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, {
      id: 'expired',
      userId: me,
      expiresAt: '2000-01-01 00:00:00',
    });

    mocks.session = { user: { id: me, role: 'user' } };

    const res = await GET(req('?expired=1'));
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.map((l) => l.id)).toContain('expired');
  });

  it('haengt tracking_url an jeden Eintrag an', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'abc123', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await GET(req());
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0].tracking_url).toBe('https://listate.test/t/abc123');
  });
});

describe('GET /api/links — Admin-Sicht', () => {
  it('Admin sieht ohne User-Filter ALLE Links', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const u1 = seedUser(h.sqlite, { id: 'u1' });
    seedLink(h.sqlite, { id: 'l1', userId: u1 });
    seedLink(h.sqlite, { id: 'l2', userId: admin });

    mocks.session = { user: { id: admin, role: 'admin' } };

    const res = await GET(req());
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
  });

  it('Admin mit ?user= sieht NUR die Links dieses Users', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const u1 = seedUser(h.sqlite, { id: 'u1' });
    seedLink(h.sqlite, { id: 'l1', userId: u1 });
    seedLink(h.sqlite, { id: 'l2', userId: admin });

    mocks.session = { user: { id: admin, role: 'admin' } };

    const res = await GET(req('?user=u1'));
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.map((l) => l.id)).toEqual(['l1']);
  });
});
