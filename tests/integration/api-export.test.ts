/**
 * Integration-Tests fuer /api/export (DSGVO Art. 20).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedClicks,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  session: null as
    | null
    | {
        user: { id: string; email?: string; role?: 'user' | 'admin' } | null;
      },
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => mocks.session),
}));

import { GET } from '@/app/api/export/route';
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

describe('GET /api/export', () => {
  it('401 ohne Session', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('liefert JSON-Download mit Filename-Header', async () => {
    const me = seedUser(h.sqlite, { email: 'me@test' });
    mocks.session = { user: { id: me, email: 'me@test', role: 'user' } };

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="listate-export-\d{4}-\d{2}-\d{2}\.json"/
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('enthaelt user-Block + leere Listen-Liste, wenn keine Daten', async () => {
    const me = seedUser(h.sqlite, { email: 'me@test' });
    mocks.session = { user: { id: me, email: 'me@test', role: 'user' } };

    const body = await (await GET()).json();

    expect(body.user).toEqual({
      id: me,
      email: 'me@test',
      role: 'user',
    });
    expect(body.links).toEqual([]);
    expect(typeof body.exportedAt).toBe('string');
  });

  it('liefert nur eigene Links mit zugehoerigen Klicks', async () => {
    const me = seedUser(h.sqlite, { id: 'me', email: 'me@test' });
    const other = seedUser(h.sqlite, { id: 'other' });

    const myLink = seedLink(h.sqlite, {
      id: 'mine',
      userId: me,
      tags: 'a,b',
    });
    seedLink(h.sqlite, { id: 'theirs', userId: other });
    seedClicks(h.sqlite, myLink, [
      '2026-05-08 10:00:00',
      '2026-05-08 11:00:00',
    ]);

    mocks.session = { user: { id: me, email: 'me@test', role: 'user' } };

    const body = await (await GET()).json();

    expect(body.links).toHaveLength(1);
    expect(body.links[0].id).toBe('mine');
    expect(body.links[0].tags).toEqual(['a', 'b']);
    expect(body.links[0].clicks).toEqual([
      '2026-05-08 10:00:00',
      '2026-05-08 11:00:00',
    ]);
  });
});
