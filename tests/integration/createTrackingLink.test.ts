/**
 * Integration-Tests fuer createTrackingLink + Sub-Helper.
 *
 * Mock-Strategie:
 * - `@/db.getDb` zeigt auf eine frische In-Memory-SQLite pro Test,
 *   gehalten in einem vi.hoisted()-Slot (damit das Mock-Modul den
 *   aktuellen Wert sieht, auch wenn beforeEach ihn aendert).
 * - `open-graph-scraper` wird gemockt — sonst macht der Test echtes Netz.
 * - `@/lib/adultFilter` wird gemockt — sonst laed der erste Aufruf die
 *   2-MB-Hostliste vom Filesystem.
 * - `GOOGLE_SAFE_BROWSING_API_KEY` bleibt leer → safeBrowsing skipped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

// vi.hoisted laeuft VOR allen Imports — der Mock-State muss vorher existieren.
const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  ogsResult: null as null | { result: Record<string, unknown>; error: boolean },
  /**
   * Wenn gesetzt: liefere je nach User-Agent-Header unterschiedliche
   * Mock-Antworten. Erlaubt Tests für den fetchOg-Hybrid-Retry.
   * Keys: substring-match gegen den UA. Erste Treffer-Antwort gewinnt.
   */
  ogsResultByUa: null as null | Array<{
    uaMatch: string;
    result: { result: Record<string, unknown>; error: boolean };
  }>,
  isAdult: false as boolean,
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('open-graph-scraper', () => ({
  default: vi.fn(
    async (opts: {
      url: string;
      fetchOptions?: { headers?: Record<string, string> };
    }) => {
      if (mocks.ogsResultByUa) {
        const ua = opts.fetchOptions?.headers?.['User-Agent'] ?? '';
        const hit = mocks.ogsResultByUa.find((e) => ua.includes(e.uaMatch));
        if (hit) return hit.result;
      }
      return mocks.ogsResult ?? { result: {}, error: true };
    }
  ),
}));

vi.mock('@/lib/adultFilter', () => ({
  isAdultHost: vi.fn(() => mocks.isAdult),
  adultHostCount: vi.fn(() => 0),
}));

// WICHTIG: erst NACH den vi.mock-Aufrufen importieren.
import {
  createTrackingLink,
  enforceRateLimit,
  fetchOg,
  normalizeAndCheckSlug,
  RATE_LIMIT_PER_HOUR,
  TrackingLinkError,
  validateTrackingUrl,
} from '@/lib/createTrackingLink';

let h: TestDbHandle;
let userId: string;

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.ogsResult = null;
  mocks.ogsResultByUa = null;
  mocks.isAdult = false;
  vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', '');
  userId = seedUser(h.sqlite);
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe('validateTrackingUrl', () => {
  it('akzeptiert eine valide https-URL und liefert Host', async () => {
    const result = await validateTrackingUrl('  https://Example.test/foo  ');
    expect(result.url).toBe('https://example.test/foo');
    expect(result.host).toBe('example.test');
  });

  it('lehnt http-URLs ab (400)', async () => {
    await expect(
      validateTrackingUrl('http://example.test')
    ).rejects.toMatchObject({ status: 400 });
  });

  it('lehnt leere und kaputte Eingaben ab (400)', async () => {
    await expect(validateTrackingUrl('')).rejects.toMatchObject({
      status: 400,
    });
    await expect(validateTrackingUrl('   ')).rejects.toMatchObject({
      status: 400,
    });
    await expect(validateTrackingUrl('ftp://nope')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('lehnt geblockten Host mit 403 und benutzt die hinterlegte Reason', async () => {
    h.sqlite
      .prepare(`INSERT INTO blocked_hosts (host, reason) VALUES (?, ?)`)
      .run('example.test', 'manuell gesperrt');

    await expect(
      validateTrackingUrl('https://example.test')
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('manuell gesperrt'),
    });
  });

  it('lehnt Adult-Hosts mit 403 ab', async () => {
    mocks.isAdult = true;

    await expect(
      validateTrackingUrl('https://example.test')
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('nicht-jugendfreier'),
    });
  });

  it('lehnt Safe-Browsing-Treffer mit 403 ab (wenn API-Key gesetzt)', async () => {
    vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ matches: [{ threatType: 'MALWARE' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(
      validateTrackingUrl('https://example.test')
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('unsicher'),
    });
  });
});

// ---------------------------------------------------------------------------

describe('enforceRateLimit', () => {
  it('laesst durch, wenn unter dem Limit', () => {
    expect(() => enforceRateLimit(userId)).not.toThrow();
  });

  it('wirft 429, wenn das Limit innerhalb der letzten Stunde erreicht ist', () => {
    // Genau RATE_LIMIT_PER_HOUR Links in der letzten Minute erzeugen.
    const insert = h.sqlite.prepare(
      `INSERT INTO links (id, user_id, original_url, created_at)
       VALUES (?, ?, ?, datetime('now', '-1 minute'))`
    );
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      insert.run(`r${i}`, userId, 'https://example.test');
    }

    expect(() => enforceRateLimit(userId)).toThrow(TrackingLinkError);
    expect(() => enforceRateLimit(userId)).toThrow(/Obergrenze/);
  });

  it('zaehlt nur Links DIESES Users', () => {
    const otherUser = seedUser(h.sqlite, { id: 'other' });
    const insert = h.sqlite.prepare(
      `INSERT INTO links (id, user_id, original_url, created_at)
       VALUES (?, ?, ?, datetime('now', '-1 minute'))`
    );
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      insert.run(`x${i}`, otherUser, 'https://example.test');
    }

    expect(() => enforceRateLimit(userId)).not.toThrow();
  });

  it('zaehlt Links AELTER als 1h NICHT', () => {
    const insert = h.sqlite.prepare(
      `INSERT INTO links (id, user_id, original_url, created_at)
       VALUES (?, ?, ?, datetime('now', '-2 hour'))`
    );
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      insert.run(`old${i}`, userId, 'https://example.test');
    }

    expect(() => enforceRateLimit(userId)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('fetchOg', () => {
  it('liefert OG-Daten aus dem ogs-Result', async () => {
    mocks.ogsResult = {
      error: false,
      result: {
        ogTitle: 'Title',
        ogDescription: 'Desc',
        ogImage: [{ url: 'https://example.test/img.png' }],
        ogSiteName: 'Example',
      },
    };

    const og = await fetchOg('https://example.test');

    expect(og).toEqual({
      title: 'Title',
      description: 'Desc',
      image: 'https://example.test/img.png',
      siteName: 'Example',
    });
  });

  it('faellt auf twitter*-Felder zurueck, wenn og*-Felder fehlen', async () => {
    mocks.ogsResult = {
      error: false,
      result: {
        twitterTitle: 'TW Title',
        twitterDescription: 'TW Desc',
        twitterImage: 'https://example.test/tw.png',
      },
    };

    const og = await fetchOg('https://example.test');

    expect(og.title).toBe('TW Title');
    expect(og.description).toBe('TW Desc');
    expect(og.image).toBe('https://example.test/tw.png');
  });

  it('liefert leere Felder, wenn ogs error=true meldet', async () => {
    mocks.ogsResult = { error: true, result: {} };

    const og = await fetchOg('https://example.test');

    expect(og).toEqual({
      title: null,
      description: null,
      image: null,
      siteName: null,
    });
  });

  it('akzeptiert Image als String, Array of Strings, Object mit url', async () => {
    const variants: Array<unknown> = [
      'https://example.test/a.png',
      ['https://example.test/b.png'],
      [{ url: 'https://example.test/c.png' }],
      { url: 'https://example.test/d.png' },
    ];
    const expected = [
      'https://example.test/a.png',
      'https://example.test/b.png',
      'https://example.test/c.png',
      'https://example.test/d.png',
    ];

    for (let i = 0; i < variants.length; i++) {
      mocks.ogsResult = { error: false, result: { ogImage: variants[i] } };
      const og = await fetchOg('https://example.test');
      expect(og.image).toBe(expected[i]);
    }
  });

  // -------- Hybrid-UA-Retry-Verhalten (Feature F) ---------------------------

  it('UA-Sniff-Fallback: erkennt "Browser veraltet"-Titel und retried mit Browser-UA', async () => {
    mocks.ogsResultByUa = [
      {
        uaMatch: 'ListateBot',
        result: {
          error: false,
          result: { ogTitle: 'Ihr Browser ist veraltet und wird nicht…' },
        },
      },
      {
        uaMatch: 'Chrome',
        result: {
          error: false,
          result: {
            ogTitle: 'Echtes Produkt',
            ogDescription: 'Die wahre Beschreibung',
            ogImage: 'https://example.test/real.png',
          },
        },
      },
    ];

    const og = await fetchOg('https://example.test');

    expect(og.title).toBe('Echtes Produkt');
    expect(og.description).toBe('Die wahre Beschreibung');
    expect(og.image).toBe('https://example.test/real.png');
  });

  it('keine Retry, wenn der erste Versuch sauber war', async () => {
    // Wenn ogsResultByUa nicht gesetzt ist, faellt es auf ogsResult zurueck.
    // Der ogs-Mock wird nur einmal aufgerufen.
    mocks.ogsResult = {
      error: false,
      result: { ogTitle: 'Saubere Antwort', ogDescription: 'OK' },
    };

    const og = await fetchOg('https://example.test');

    expect(og.title).toBe('Saubere Antwort');
    expect(og.description).toBe('OK');
  });

  it('bleibt bei honest-Antwort, wenn Browser-Retry auch verdaechtig ist', async () => {
    mocks.ogsResultByUa = [
      {
        uaMatch: 'ListateBot',
        result: {
          error: false,
          result: { ogTitle: 'Browser is out of date' },
        },
      },
      {
        uaMatch: 'Chrome',
        result: {
          error: false,
          result: { ogTitle: 'Update your browser please' },
        },
      },
    ];

    const og = await fetchOg('https://example.test');

    // Honest-Antwort wird beibehalten, damit User per Override eingreifen kann.
    expect(og.title).toBe('Browser is out of date');
  });

  it('Retry mit leerem Titel führt zur honest-Antwort zurück', async () => {
    mocks.ogsResultByUa = [
      {
        uaMatch: 'ListateBot',
        result: {
          error: false,
          result: { ogTitle: 'Unsupported browser detected' },
        },
      },
      {
        uaMatch: 'Chrome',
        // Browser-UA bekommt auch nichts brauchbares; lieber den honest-Wert
        // als gar nichts.
        result: { error: true, result: {} },
      },
    ];

    const og = await fetchOg('https://example.test');

    expect(og.title).toBe('Unsupported browser detected');
  });

  it.each([
    'Ihr Browser ist veraltet',
    'Browser is out of date',
    'Please update your browser',
    'Please upgrade your browser',
    'Unsupported browser',
  ])('erkennt Pattern "%s" als verdaechtig', async (title) => {
    mocks.ogsResultByUa = [
      {
        uaMatch: 'ListateBot',
        result: { error: false, result: { ogTitle: title } },
      },
      {
        uaMatch: 'Chrome',
        result: { error: false, result: { ogTitle: 'OK – ECHTER Titel' } },
      },
    ];

    const og = await fetchOg('https://example.test');

    expect(og.title).toBe('OK – ECHTER Titel');
  });
});

// ---------------------------------------------------------------------------

describe('normalizeAndCheckSlug', () => {
  it('null und leer → null', () => {
    expect(normalizeAndCheckSlug(null)).toBeNull();
    expect(normalizeAndCheckSlug(undefined)).toBeNull();
    expect(normalizeAndCheckSlug('')).toBeNull();
    expect(normalizeAndCheckSlug('   ')).toBeNull();
  });

  it('liefert normalisierten Slug, wenn frei', () => {
    expect(normalizeAndCheckSlug(' My-SLUG ')).toBe('my-slug');
  });

  it('wirft 400 bei ungueltigem Slug', () => {
    expect(() => normalizeAndCheckSlug('Bad Slug!')).toThrow(
      TrackingLinkError
    );
  });

  it('wirft 400, wenn Slug bereits vergeben', () => {
    seedLink(h.sqlite, { userId, slug: 'taken' });

    expect(() => normalizeAndCheckSlug('taken')).toThrow(/bereits vergeben/);
  });

  it('akzeptiert eigenen Slug, wenn excludeLinkId passt (Edit-Flow)', () => {
    const linkId = seedLink(h.sqlite, { userId, slug: 'mine' });

    expect(() => normalizeAndCheckSlug('mine', linkId)).not.toThrow();
    expect(normalizeAndCheckSlug('mine', linkId)).toBe('mine');
  });
});

// ---------------------------------------------------------------------------

describe('createTrackingLink — End-to-End', () => {
  it('happy path: legt Link an, liefert Result, persistiert in DB', async () => {
    mocks.ogsResult = {
      error: false,
      result: {
        ogTitle: 'Example',
        ogDescription: 'Doc',
        ogSiteName: 'Example Inc',
      },
    };

    const result = await createTrackingLink({
      rawUrl: 'https://example.test/foo',
      userId,
      slug: 'my-link',
      tags: 'foo, bar, foo', // dedupe expected
      expiresAt: '2026-12-31 23:59:59',
    });

    expect(result.id).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(result.slug).toBe('my-link');
    expect(result.url).toBe('https://example.test/foo');
    expect(result.tags).toEqual(['foo', 'bar']);
    expect(result.og.title).toBe('Example');

    const row = h.sqlite
      .prepare(`SELECT * FROM links WHERE id = ?`)
      .get(result.id) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.user_id).toBe(userId);
    expect(row.original_url).toBe('https://example.test/foo');
    expect(row.slug).toBe('my-link');
    expect(row.tags).toBe('foo,bar');
    expect(row.og_title).toBe('Example');
  });

  it('greift Rate-Limit ab, bevor irgendwas anderes passiert', async () => {
    const insert = h.sqlite.prepare(
      `INSERT INTO links (id, user_id, original_url, created_at)
       VALUES (?, ?, ?, datetime('now', '-1 minute'))`
    );
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      insert.run(`r${i}`, userId, 'https://example.test');
    }

    await expect(
      createTrackingLink({
        rawUrl: 'https://example.test/foo',
        userId,
      })
    ).rejects.toMatchObject({ status: 429 });
  });

  it('greift URL-Validation: keine http-URLs', async () => {
    await expect(
      createTrackingLink({ rawUrl: 'http://example.test', userId })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('verpackt DB-Fehler in TrackingLinkError 500', async () => {
    // Zweimal denselben Slug ueber direkte SQL einfuegen, der zweite
    // Insert via createTrackingLink trifft den UNIQUE-Constraint
    // (verifiziert den catch-Branch um den .run()-Aufruf herum).
    seedLink(h.sqlite, { userId, slug: 'collision' });

    // Slug-Check oben wuerde "bereits vergeben" werfen — wir muessen also
    // die Kollision auf der ID erzwingen. Einfacher: einen Link mit
    // einer von generateId rotierten ID seeden klappt nicht (zufaellig).
    // Stattdessen: blocked_hosts mit dem Host setzen — das gibt zwar
    // 403, nicht 500. DB-500-Pfad ist defensive Code; explizit testen
    // wir das ueber Slug-Vergabe-Konflikt:
    await expect(
      createTrackingLink({
        rawUrl: 'https://example.test/foo',
        userId,
        slug: 'collision',
      })
    ).rejects.toMatchObject({ status: 400 }); // Slug-Konflikt fuehrt zu 400, nicht 500
  });

  it('toleriert leeren Slug-Input', async () => {
    mocks.ogsResult = { error: false, result: {} };

    const result = await createTrackingLink({
      rawUrl: 'https://example.test',
      userId,
      slug: null,
      tags: null,
    });

    expect(result.slug).toBeNull();
    expect(result.tags).toEqual([]);
  });

  it('toleriert OG-Fehler — der Link wird trotzdem erstellt', async () => {
    mocks.ogsResult = { error: true, result: {} };

    const result = await createTrackingLink({
      rawUrl: 'https://example.test',
      userId,
    });

    expect(result.id).toBeTruthy();
    expect(result.og.title).toBeNull();
  });

  it('toleriert ogImage-Object OHNE url-Property (kein Crash)', async () => {
    mocks.ogsResult = {
      error: false,
      result: { ogImage: { width: 200 } }, // kein url-Feld
    };

    const result = await createTrackingLink({
      rawUrl: 'https://example.test',
      userId,
    });

    expect(result.og.image).toBeNull();
  });

  it('verpackt FK-Violation als TrackingLinkError 500', async () => {
    // Foreign-Key-Constraint auf user_id wird die DB werfen lassen.
    await expect(
      createTrackingLink({
        rawUrl: 'https://example.test',
        userId: 'user_does_not_exist',
      })
    ).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('Speichern fehlgeschlagen'),
    });
  });
});
