/**
 * Integration-Tests fuer /api/health.
 * Health prueft nur ob die DB-Ping antwortet — kein Auth, kein State.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDbHandle } from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  shouldFail: false as boolean,
}));

vi.mock('@/db', () => ({
  getDb: () => {
    if (mocks.shouldFail) throw new Error('db down');
    return mocks.currentDb;
  },
}));

import { GET } from '@/app/api/health/route';

let h: TestDbHandle;

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.shouldFail = false;
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
});

describe('GET /api/health', () => {
  it('200 mit status=ok bei erreichbarer DB', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(typeof body.latencyMs).toBe('number');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('503 wenn DB-Ping ein unerwartetes Result liefert', async () => {
    // Wir patchen getDb so, dass .get() ein falsches Ergebnis liefert.
    mocks.currentDb = {
      get: () => ({ ok: 0 }),
    };

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.reason).toContain('unexpected');
  });

  it('503 mit Fehler-Message bei Exception', async () => {
    mocks.shouldFail = true;

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.reason).toContain('db down');
  });
});
