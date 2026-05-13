/**
 * Integration-Tests fuer /t/[id] — die Crawler-Vorschau.
 * Verifiziert, dass die OG-Meta-Tags im HTML aus dem Override-Layer
 * gespeist werden (custom_* > og_*) und dass das Override-Image
 * absolut mit der Basis-URL ausgegeben wird.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  geoLookup: vi.fn<(ip: string) => { country: string } | null>(),
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('@/lib/baseUrl', () => ({
  getBaseUrl: vi.fn(async () => 'https://listate.test'),
}));

vi.mock('geoip-lite', () => ({
  default: { lookup: mocks.geoLookup },
}));

import { GET } from '@/app/t/[id]/route';

let h: TestDbHandle;
let userId: string;

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.geoLookup.mockReset();
  userId = seedUser(h.sqlite);
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
});

function crawlerReq(id: string): NextRequest {
  return new NextRequest(`https://listate.test/t/${id}`, {
    headers: { 'user-agent': 'WhatsApp/2.23' },
  });
}

async function call(id: string): Promise<{ status: number; html: string }> {
  const res = await GET(crawlerReq(id), {
    params: Promise.resolve({ id }),
  });
  return { status: res.status, html: await res.text() };
}

describe('GET /t/[id] — Override-Layer im HTML', () => {
  it('Scraper-Werte erscheinen als og:* + twitter:*, wenn kein Override gesetzt', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, og_title, og_description, og_image, og_site_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'abc123',
        userId,
        'https://example.test/page',
        'Scraped Title',
        'Scraped Desc',
        'https://cdn.example.test/img.png',
        'Example'
      );

    const { status, html } = await call('abc123');

    expect(status).toBe(200);
    expect(html).toContain('<meta property="og:title" content="Scraped Title"');
    expect(html).toContain(
      '<meta property="og:description" content="Scraped Desc"'
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://cdn.example.test/img.png"'
    );
    expect(html).toContain('<meta property="og:site_name" content="Example"');
    expect(html).toContain(
      '<meta name="twitter:image" content="https://cdn.example.test/img.png"'
    );
  });

  it('Custom-Override-Texte gewinnen ueber Scraper-Werte', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, og_title, og_description, og_image, og_site_name,
                              custom_title, custom_description, custom_site_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'override',
        userId,
        'https://example.test/page',
        'Scraped',
        'Scraped Desc',
        'https://cdn.example.test/img.png',
        'Example',
        'Mein Titel',
        'Meine Beschreibung',
        'Meine Site'
      );

    const { html } = await call('override');

    expect(html).toContain('<meta property="og:title" content="Mein Titel"');
    expect(html).toContain(
      '<meta property="og:description" content="Meine Beschreibung"'
    );
    expect(html).toContain(
      '<meta property="og:site_name" content="Meine Site"'
    );
  });

  it('custom_image_path wird als absolute URL ausgegeben (BaseUrl + /api/og-image/)', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, og_image, custom_image_path)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'custimg',
        userId,
        'https://example.test/page',
        'https://cdn.example.test/scraped.png',
        'custimg-1a2b3c4d.jpg'
      );

    const { html } = await call('custimg');

    expect(html).toContain(
      '<meta property="og:image" content="https://listate.test/api/og-image/custimg-1a2b3c4d.jpg"'
    );
    expect(html).toContain(
      '<meta name="twitter:image" content="https://listate.test/api/og-image/custimg-1a2b3c4d.jpg"'
    );
    // Scraper-URL wird NICHT mehr ausgegeben.
    expect(html).not.toContain('https://cdn.example.test/scraped.png');
  });

  it('image_hidden = 1 → KEIN og:image / twitter:image im HTML', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, og_image, image_hidden)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'noimg',
        userId,
        'https://example.test/page',
        'https://cdn.example.test/scraped.png',
        1
      );

    const { html } = await call('noimg');

    expect(html).not.toContain('og:image');
    expect(html).not.toContain('twitter:image');
    // Andere OG-Tags bleiben.
    expect(html).toContain('og:type');
  });

  it('externe og_image-URL ohne Override bleibt unveraendert (nicht durch BaseUrl praefixiert)', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, og_image)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        'ext',
        userId,
        'https://example.test',
        'https://cdn.example.test/scraped.png'
      );

    const { html } = await call('ext');

    expect(html).toContain(
      '<meta property="og:image" content="https://cdn.example.test/scraped.png"'
    );
    // KEIN listate.test-Prefix.
    expect(html).not.toContain(
      'listate.test/https://cdn.example.test'
    );
  });

  it('Titel-Fallback im <title>: custom > og > originalUrl', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, custom_title)
         VALUES (?, ?, ?, ?)`
      )
      .run('t1', userId, 'https://example.test', 'Mein Titel');

    const { html } = await call('t1');
    expect(html).toContain('<title>Mein Titel</title>');
  });

  it('HTML-Escaping: " in custom_title wird zu &quot;', async () => {
    h.sqlite
      .prepare(
        `INSERT INTO links (id, user_id, original_url, custom_title)
         VALUES (?, ?, ?, ?)`
      )
      .run('esc', userId, 'https://example.test', 'Er sagte "hi" zu mir');

    const { html } = await call('esc');

    expect(html).toContain(
      '<meta property="og:title" content="Er sagte &quot;hi&quot; zu mir"'
    );
    // Im <title>-Body wird &quot; nicht zwingend genutzt, aber < und > sind escaped:
    expect(html).toContain(
      '<title>Er sagte "hi" zu mir</title>'
    );
  });
});

describe('GET /t/[id] — Bestandsverhalten unveraendert', () => {
  it('404 fuer unbekannte ID/Slug', async () => {
    const { status } = await call('does-not-exist');
    expect(status).toBe(404);
  });

  it('Crawler ausgenommen vom Click-Counter (war-vor-uns)', async () => {
    seedLink(h.sqlite, { id: 'cnt', userId, originalUrl: 'https://example.test' });
    await call('cnt');
    const row = h.sqlite
      .prepare(`SELECT click_count FROM links WHERE id = ?`)
      .get('cnt') as { click_count: number };
    expect(row.click_count).toBe(0);
  });

  it('Non-Crawler erhoeht click_count und schreibt clicks-Eintrag', async () => {
    seedLink(h.sqlite, { id: 'usr', userId, originalUrl: 'https://example.test' });

    const res = await GET(
      new NextRequest('https://listate.test/t/usr', {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120',
        },
      }),
      { params: Promise.resolve({ id: 'usr' }) }
    );

    expect(res.status).toBe(200);

    const link = h.sqlite
      .prepare(`SELECT click_count FROM links WHERE id = ?`)
      .get('usr') as { click_count: number };
    expect(link.click_count).toBe(1);

    const clickRow = h.sqlite
      .prepare(`SELECT COUNT(*) as n FROM clicks WHERE link_id = ?`)
      .get('usr') as { n: number };
    expect(clickRow.n).toBe(1);
  });

  it('schreibt country_code aus Geo-Lookup, wenn x-forwarded-for gesetzt ist', async () => {
    seedLink(h.sqlite, { id: 'geo', userId, originalUrl: 'https://example.test' });
    mocks.geoLookup.mockReturnValue({ country: 'DE' });

    await GET(
      new NextRequest('https://listate.test/t/geo', {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120',
          'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        },
      }),
      { params: Promise.resolve({ id: 'geo' }) }
    );

    expect(mocks.geoLookup).toHaveBeenCalledWith('203.0.113.7');
    const click = h.sqlite
      .prepare(
        `SELECT country_code FROM clicks WHERE link_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get('geo') as { country_code: string | null };
    expect(click.country_code).toBe('DE');
  });

  it('country_code = NULL bei Loopback-IP (Dev-Setup)', async () => {
    seedLink(h.sqlite, { id: 'loop', userId, originalUrl: 'https://example.test' });

    await GET(
      new NextRequest('https://listate.test/t/loop', {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120',
          'x-forwarded-for': '127.0.0.1',
        },
      }),
      { params: Promise.resolve({ id: 'loop' }) }
    );

    expect(mocks.geoLookup).not.toHaveBeenCalled();
    const click = h.sqlite
      .prepare(
        `SELECT country_code FROM clicks WHERE link_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get('loop') as { country_code: string | null };
    expect(click.country_code).toBeNull();
  });

  it('country_code = NULL, wenn kein Header gesetzt ist', async () => {
    seedLink(h.sqlite, { id: 'noip', userId, originalUrl: 'https://example.test' });

    await GET(
      new NextRequest('https://listate.test/t/noip', {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120',
        },
      }),
      { params: Promise.resolve({ id: 'noip' }) }
    );

    const click = h.sqlite
      .prepare(
        `SELECT country_code FROM clicks WHERE link_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get('noip') as { country_code: string | null };
    expect(click.country_code).toBeNull();
  });

  it('Crawler-Request schreibt KEINEN clicks-Eintrag (kein Geo-Lookup)', async () => {
    seedLink(h.sqlite, { id: 'crwl', userId, originalUrl: 'https://example.test' });
    mocks.geoLookup.mockReturnValue({ country: 'DE' });

    await call('crwl'); // crawlerReq() setzt WhatsApp-UA

    expect(mocks.geoLookup).not.toHaveBeenCalled();
    const cnt = h.sqlite
      .prepare(`SELECT COUNT(*) as n FROM clicks WHERE link_id = ?`)
      .get('crwl') as { n: number };
    expect(cnt.n).toBe(0);
  });

  it('410 mit Hinweis-HTML bei abgelaufenem Link', async () => {
    seedLink(h.sqlite, {
      id: 'expd',
      userId,
      originalUrl: 'https://example.test',
      expiresAt: '2000-01-01 00:00:00',
    });

    const { status, html } = await call('expd');

    expect(status).toBe(410);
    expect(html).toContain('Link abgelaufen');
    expect(html).toContain('noindex');
  });
});
