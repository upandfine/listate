/**
 * Integration-Tests fuer /api/og-image/remote/[id] (Backlog D7).
 * Proxyt das in der DB gespeicherte externe og_image, mit
 * SSRF-Haertung und 404-Fallback ohne Detail-Leak.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, seedLink, seedUser, type TestDbHandle } from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

import { GET } from '@/app/api/og-image/remote/[id]/route';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
let h: TestDbHandle;

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
  vi.unstubAllGlobals();
});

function call(id: string) {
  return GET(new Request(`https://listate.test/api/og-image/remote/${id}`), {
    params: Promise.resolve({ id }),
  });
}

function seedWithImage(ogImage: string | null): string {
  const userId = seedUser(h.sqlite);
  const id = seedLink(h.sqlite, { id: 'lnkAbc01', userId });
  h.sqlite.prepare('UPDATE links SET og_image = ? WHERE id = ?').run(
    ogImage,
    id
  );
  return id;
}

describe('GET /api/og-image/remote/[id]', () => {
  it('404 bei ungueltiger ID (kein DB-Lookup)', async () => {
    const res = await call('../etc');
    expect(res.status).toBe(404);
  });

  it('404 wenn Link nicht existiert', async () => {
    seedUser(h.sqlite);
    const res = await call('lnkMissing');
    expect(res.status).toBe(404);
  });

  it('404 wenn og_image NULL', async () => {
    const id = seedWithImage(null);
    expect((await call(id)).status).toBe(404);
  });

  it('404 bei internem Host (SSRF-Schutz), ohne fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const id = seedWithImage('https://169.254.169.254/latest/meta-data');
    expect((await call(id)).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('200 mit Bild + Cache-Header bei gueltigem externen Bild', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(PNG, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      )
    );
    const id = seedWithImage('https://cdn.example.com/og.png');
    const res = await call(id);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=86400, stale-while-revalidate=604800'
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it('404 wenn Upstream kein Bild liefert', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );
    const id = seedWithImage('https://cdn.example.com/notimage');
    expect((await call(id)).status).toBe(404);
  });
});
