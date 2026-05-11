/**
 * Integration-Tests fuer /api/create (POST).
 *
 * Mock-Stack:
 * - @/auth.auth liefert eine konfigurierbare Session (anstelle eines
 *   echten next-auth-Lookups).
 * - @/db.getDb zeigt auf eine In-Memory-DB pro Test.
 * - @/lib/baseUrl.getBaseUrl liefert eine fixe Test-URL (Original ruft
 *   next/headers, das ausserhalb eines Request-Kontextes craschen wuerde).
 * - open-graph-scraper + @/lib/adultFilter wie in
 *   createTrackingLink.test.ts.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  session: null as
    | null
    | { user: { id: string; email?: string; role?: 'user' | 'admin' } | null },
  ogsResult: null as null | { result: Record<string, unknown>; error: boolean },
  isAdult: false as boolean,
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

vi.mock('open-graph-scraper', () => ({
  default: vi.fn(async () => mocks.ogsResult ?? { result: {}, error: true }),
}));

vi.mock('@/lib/adultFilter', () => ({
  isAdultHost: vi.fn(() => mocks.isAdult),
  adultHostCount: vi.fn(() => 0),
}));

// Erst nach allen vi.mock-Aufrufen importieren.
import { POST } from '@/app/api/create/route';

let h: TestDbHandle;
let userId: string;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('https://listate.test/api/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.session = null;
  mocks.ogsResult = null;
  mocks.isAdult = false;
  vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', '');
  userId = seedUser(h.sqlite);
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
  vi.unstubAllEnvs();
});

describe('POST /api/create — Auth', () => {
  it('401 ohne Session', async () => {
    mocks.session = null;

    const res = await POST(makeRequest({ url: 'https://example.test' }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Nicht angemeldet');
  });

  it('401 wenn Session ohne user.id', async () => {
    mocks.session = { user: null };

    const res = await POST(makeRequest({ url: 'https://example.test' }));

    expect(res.status).toBe(401);
  });
});

describe('POST /api/create — Request-Body', () => {
  beforeEach(() => {
    mocks.session = { user: { id: userId, role: 'user' } };
  });

  it('400 bei ungueltigem JSON-Body', async () => {
    const res = await POST(makeRequest('this is not json'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Ungültiger Request-Body');
  });

  it('400 wenn url-Feld fehlt (URL-Validation kickt in createTrackingLink)', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it('400 wenn url-Feld nicht-string ist', async () => {
    const res = await POST(makeRequest({ url: 12345 }));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/create — Happy Path', () => {
  beforeEach(() => {
    mocks.session = { user: { id: userId, role: 'user' } };
    mocks.ogsResult = {
      error: false,
      result: { ogTitle: 'Example', ogSiteName: 'Example Inc' },
    };
  });

  it('legt Link an und liefert tracking-URL', async () => {
    const res = await POST(
      makeRequest({
        url: 'https://example.test/foo',
        slug: 'my-link',
        tags: 'a, b',
        ttl: '7d',
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(body.slug).toBe('my-link');
    expect(body.tags).toEqual(['a', 'b']);
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(body.trackingUrl).toBe('https://listate.test/t/my-link');
    expect(body.og.title).toBe('Example');
  });

  it('nutzt id im Tracking-Pfad, wenn kein Slug gesetzt ist', async () => {
    const res = await POST(makeRequest({ url: 'https://example.test' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBeNull();
    expect(body.trackingUrl).toBe(`https://listate.test/t/${body.id}`);
  });

  it('ignoriert unbekannte ttl-Werte (kein expiresAt)', async () => {
    const res = await POST(
      makeRequest({ url: 'https://example.test', ttl: 'forever' })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expiresAt).toBeNull();
  });
});

describe('POST /api/create — Fehler-Status durchreichen', () => {
  beforeEach(() => {
    mocks.session = { user: { id: userId, role: 'user' } };
  });

  it('400 bei http-URL (TrackingLinkError 400 wird durchgereicht)', async () => {
    const res = await POST(
      makeRequest({ url: 'http://example.test' })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('https');
  });

  it('403 bei Adult-Host', async () => {
    mocks.isAdult = true;

    const res = await POST(makeRequest({ url: 'https://example.test' }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('nicht-jugendfreier');
  });

  it('500 bei FK-Violation (nicht-existenter user_id) wird in JSON verpackt', async () => {
    mocks.session = { user: { id: 'ghost-user', role: 'user' } };

    const res = await POST(makeRequest({ url: 'https://example.test' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Speichern fehlgeschlagen');
  });

  it('500 generic bei nicht-TrackingLinkError-Exception (Generic-Fallback)', async () => {
    // Wir setzen die DB so, dass jede Query crasht — das fuehrt zu einem
    // Error, der KEIN TrackingLinkError ist, also greift der zweite
    // catch-Branch in /api/create.
    mocks.currentDb = {
      select: () => {
        throw new Error('boom from db mock');
      },
    };
    mocks.session = { user: { id: userId, role: 'user' } };

    // console.error stummschalten, damit der erwartete Log nicht den Test-
    // Output zumuellt.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeRequest({ url: 'https://example.test' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Unbekannter Fehler');
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
