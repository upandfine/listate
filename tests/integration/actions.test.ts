/**
 * Integration-Tests fuer Server-Actions in app/actions.ts.
 *
 * 9 Actions: updateLink, deleteLink, blockHost, unblockHost,
 * deleteAccount, createTemplate, deleteTemplate, useTemplate,
 * testTemplatePattern.
 *
 * Mock-Stack wie bei API-Routes plus:
 * - next/cache.revalidatePath als No-Op
 * - next/navigation.redirect wirft NEXT_REDIRECT; wir fangen das im Test
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
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
  ogsResult: null as null | { result: Record<string, unknown>; error: boolean },
  isAdult: false as boolean,
  signOutCalls: [] as Array<unknown>,
  redirectCalls: [] as string[],
  resolveResult: null as
    | null
    | { ok: boolean; resolved?: string; candidates: string[]; error?: string },
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.currentDb,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => mocks.session),
  signOut: vi.fn(async (opts?: unknown) => {
    mocks.signOutCalls.push(opts);
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(() => undefined),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    mocks.redirectCalls.push(path);
    // Echtes next/navigation.redirect wirft NEXT_REDIRECT — wir imitieren das
    // mit einer typischen Error, damit der Aufrufer nichts weiter ausfuehrt.
    const err = new Error('NEXT_REDIRECT');
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${path}`;
    throw err;
  }),
}));

vi.mock('open-graph-scraper', () => ({
  default: vi.fn(async () => mocks.ogsResult ?? { result: {}, error: true }),
}));

vi.mock('@/lib/adultFilter', () => ({
  isAdultHost: vi.fn(() => mocks.isAdult),
  adultHostCount: vi.fn(() => 0),
}));

vi.mock('@/lib/resolveTemplateUrl', () => ({
  resolveTemplateUrl: vi.fn(async () => mocks.resolveResult ?? {
    ok: false,
    candidates: [],
    error: 'kein Mock-Result gesetzt',
  }),
}));

import {
  blockHost,
  clearLinkImageOverride,
  createTemplate,
  deleteAccount,
  deleteLink,
  deleteTemplate,
  testTemplatePattern,
  unblockHost,
  updateLink,
  updateLinkOverrides,
  uploadLinkImage,
  useTemplate,
} from '@/app/actions';

// JPEG-Header fuer Magic-Bytes-Validation.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
// PNG-Header, fuer Tests, die einen "neuen Hash" erzwingen sollen.
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

let imgDir: string;

let h: TestDbHandle;

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.session = null;
  mocks.ogsResult = null;
  mocks.isAdult = false;
  mocks.signOutCalls = [];
  mocks.redirectCalls = [];
  mocks.resolveResult = null;
  vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', '');
  imgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'listate-actions-'));
  vi.stubEnv('OG_IMAGE_DIR', imgDir);
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
  vi.unstubAllEnvs();
  fs.rmSync(imgDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// updateLink
// ---------------------------------------------------------------------------

describe('updateLink', () => {
  it('ok=false ohne Session (wird derzeit als Generic-Fehler verpackt)', async () => {
    // BACKLOG Feature D Punkt 4 ("Server-Actions vereinheitlichen"):
    // updateLink wrappt JEDEN Error im aeusseren Catch, auch
    // "Nicht angemeldet" aus requireUser(). Der Aufrufer kann daher
    // 401-Faelle nicht von echten Speicherfehlern unterscheiden.
    // Test bildet das tatsaechliche Verhalten ab; die saubere Trennung
    // ist im Refactoring-Backlog vorgemerkt.
    const res = await updateLink(fd({ id: 'x' }));
    expect(res.ok).toBe(false);
  });

  it('ok=false ohne id', async () => {
    const me = seedUser(h.sqlite);
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLink(fd({}));
    expect(res).toEqual({ ok: false, error: 'Link-ID fehlt.' });
  });

  it('ok=false bei nicht-existentem Link', async () => {
    const me = seedUser(h.sqlite);
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLink(fd({ id: 'ghost' }));
    expect(res.ok).toBe(false);
  });

  it('ok=false bei fremdem Link (non-admin)', async () => {
    const me = seedUser(h.sqlite, { id: 'me' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: other });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLink(fd({ id: 'lnk' }));
    expect(res).toEqual({ ok: false, error: 'Keine Berechtigung.' });
  });

  it('Admin darf fremde Links bearbeiten', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, {
      id: 'lnk',
      userId: other,
      originalUrl: 'https://old.test',
    });
    mocks.session = { user: { id: admin, role: 'admin' } };

    const res = await updateLink(
      fd({ id: 'lnk', url: 'https://new.test', tags: 'x' })
    );
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT * FROM links WHERE id = ?`)
      .get('lnk') as Record<string, unknown>;
    expect(row.original_url).toBe('https://new.test/');
  });

  it('ergaenzt fehlendes https://-Schema bei der URL-Eingabe', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, {
      id: 'lnk',
      userId: me,
      originalUrl: 'https://old.test',
    });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLink(fd({ id: 'lnk', url: 'example.com' }));
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT original_url FROM links WHERE id = ?`)
      .get('lnk') as { original_url: string };
    expect(row.original_url).toBe('https://example.com/');
  });

  it('setzt expiresAt auf null wenn ttlClear=on', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, {
      id: 'lnk',
      userId: me,
      expiresAt: '2026-12-31 23:59:59',
    });
    mocks.session = { user: { id: me, role: 'user' } };

    await updateLink(fd({ id: 'lnk', ttlClear: 'on' }));

    const row = h.sqlite
      .prepare(`SELECT expires_at FROM links WHERE id = ?`)
      .get('lnk') as { expires_at: string | null };
    expect(row.expires_at).toBeNull();
  });

  it('setzt expiresAt aus TTL-Preset', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    await updateLink(fd({ id: 'lnk', ttl: '7d' }));

    const row = h.sqlite
      .prepare(`SELECT expires_at FROM links WHERE id = ?`)
      .get('lnk') as { expires_at: string | null };
    expect(row.expires_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('verpackt TrackingLinkError als ok=false-Result', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    seedLink(h.sqlite, { id: 'other', userId: me, slug: 'taken' });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLink(fd({ id: 'lnk', slug: 'taken' }));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('bereits vergeben');
  });

  it('eigener Slug bei Edit ist erlaubt (excludeLinkId-Pfad)', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me, slug: 'mine' });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLink(fd({ id: 'lnk', slug: 'mine' }));
    expect(res).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// deleteLink
// ---------------------------------------------------------------------------

describe('deleteLink', () => {
  it('wirft "Nicht angemeldet" ohne Session', async () => {
    await expect(deleteLink(fd({ id: 'x' }))).rejects.toThrow(
      'Nicht angemeldet'
    );
  });

  it('silent return ohne id', async () => {
    const me = seedUser(h.sqlite);
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(deleteLink(fd({}))).resolves.toBeUndefined();
  });

  it('silent return bei nicht-existentem Link', async () => {
    const me = seedUser(h.sqlite);
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(
      deleteLink(fd({ id: 'ghost' }))
    ).resolves.toBeUndefined();
  });

  it('wirft "Keine Berechtigung" bei fremdem Link (non-admin)', async () => {
    const me = seedUser(h.sqlite, { id: 'me' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: other });
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(deleteLink(fd({ id: 'lnk' }))).rejects.toThrow(
      'Keine Berechtigung'
    );
  });

  it('Owner darf loeschen', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    await deleteLink(fd({ id: 'lnk' }));

    const row = h.sqlite
      .prepare(`SELECT id FROM links WHERE id = ?`)
      .get('lnk');
    expect(row).toBeUndefined();
  });

  it('Admin darf fremde Links loeschen', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: other });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await deleteLink(fd({ id: 'lnk' }));

    const row = h.sqlite
      .prepare(`SELECT id FROM links WHERE id = ?`)
      .get('lnk');
    expect(row).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// blockHost / unblockHost
// ---------------------------------------------------------------------------

describe('blockHost', () => {
  it('wirft "Nur Admins" ohne Admin-Rolle', async () => {
    const me = seedUser(h.sqlite, { role: 'user' });
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(
      blockHost(fd({ host: 'bad.test' }))
    ).rejects.toThrow('Nur Admins');
  });

  it('wirft bei ungueltigem Host (kein Punkt)', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await expect(blockHost(fd({ host: 'foo' }))).rejects.toThrow(
      'gültigen Host'
    );
  });

  it('fuegt Host in blocked_hosts ein mit Reason und createdBy', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await blockHost(fd({ host: 'bad.test', reason: 'phishing' }));

    const row = h.sqlite
      .prepare(`SELECT * FROM blocked_hosts WHERE host = ?`)
      .get('bad.test') as Record<string, unknown>;
    expect(row.reason).toBe('phishing');
    expect(row.created_by).toBe(admin);
  });

  it('normalisiert URL-Eingabe zu Host (strips www., scheme, path)', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await blockHost(fd({ host: 'https://www.Bad.test/some/path' }));

    const row = h.sqlite
      .prepare(`SELECT host FROM blocked_hosts`)
      .get() as { host: string };
    expect(row.host).toBe('bad.test');
  });

  it('upsertet, statt zu craschen, wenn Host schon existiert', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await blockHost(fd({ host: 'bad.test', reason: 'first' }));
    await blockHost(fd({ host: 'bad.test', reason: 'second' }));

    const row = h.sqlite
      .prepare(`SELECT reason FROM blocked_hosts WHERE host = ?`)
      .get('bad.test') as { reason: string };
    expect(row.reason).toBe('second');
  });

  it('alsoDelete=on entfernt zugleich alle Links auf diesen Host', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const u = seedUser(h.sqlite, { id: 'u' });
    seedLink(h.sqlite, { id: 'k', userId: u, originalUrl: 'https://bad.test/' });
    seedLink(h.sqlite, {
      id: 'safe',
      userId: u,
      originalUrl: 'https://good.test/',
    });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await blockHost(fd({ host: 'bad.test', alsoDelete: 'on' }));

    const remaining = h.sqlite
      .prepare(`SELECT id FROM links`)
      .all() as Array<{ id: string }>;
    expect(remaining.map((r) => r.id)).toEqual(['safe']);
  });
});

describe('unblockHost', () => {
  it('wirft "Nur Admins" ohne Admin-Rolle', async () => {
    const me = seedUser(h.sqlite, { role: 'user' });
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(unblockHost(fd({ host: 'bad.test' }))).rejects.toThrow(
      'Nur Admins'
    );
  });

  it('entfernt den Eintrag', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    h.sqlite
      .prepare(`INSERT INTO blocked_hosts (host) VALUES (?)`)
      .run('bad.test');
    mocks.session = { user: { id: admin, role: 'admin' } };

    await unblockHost(fd({ host: 'bad.test' }));

    const row = h.sqlite
      .prepare(`SELECT host FROM blocked_hosts WHERE host = ?`)
      .get('bad.test');
    expect(row).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

describe('deleteAccount', () => {
  it('wirft "Nicht angemeldet" ohne Session', async () => {
    await expect(deleteAccount()).rejects.toThrow('Nicht angemeldet');
  });

  it('loescht den User-Eintrag und cascadet auf Links', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'l1', userId: me });
    seedLink(h.sqlite, { id: 'l2', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    await deleteAccount();

    expect(
      h.sqlite.prepare(`SELECT id FROM user WHERE id = ?`).get(me)
    ).toBeUndefined();
    expect(
      h.sqlite.prepare(`SELECT id FROM links WHERE user_id = ?`).all(me)
    ).toEqual([]);
    expect(mocks.signOutCalls).toEqual([{ redirectTo: '/login' }]);
  });
});

// ---------------------------------------------------------------------------
// createTemplate / deleteTemplate / testTemplatePattern
// ---------------------------------------------------------------------------

describe('createTemplate', () => {
  it('wirft "Nur Admins" ohne Admin-Rolle', async () => {
    const me = seedUser(h.sqlite, { role: 'user' });
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(
      createTemplate(fd({ label: 'x', url: 'https://x.test' }))
    ).rejects.toThrow('Nur Admins');
  });

  it('wirft bei fehlendem Label', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await expect(
      createTemplate(fd({ label: '', url: 'https://x.test' }))
    ).rejects.toThrow('Bezeichnung fehlt');
  });

  it('wirft bei nicht-https URL', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await expect(
      createTemplate(fd({ label: 'x', url: 'http://x.test' }))
    ).rejects.toThrow('https');
  });

  it('wirft bei ungueltigem urlPattern-Regex', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await expect(
      createTemplate(
        fd({ label: 'x', url: 'https://x.test', urlPattern: '[unclosed' })
      )
    ).rejects.toThrow('Pattern');
  });

  it('legt Vorlage an mit allen Feldern', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    await createTemplate(
      fd({
        label: 'Bibel woche',
        url: 'https://bibel.test/overview',
        description: 'wochenartikel',
        urlPattern: 'woche-\\d+',
      })
    );

    const row = h.sqlite
      .prepare(`SELECT * FROM templates`)
      .get() as Record<string, unknown>;
    expect(row.label).toBe('Bibel woche');
    expect(row.original_url).toBe('https://bibel.test/overview');
    expect(row.description).toBe('wochenartikel');
    expect(row.url_pattern).toBe('woche-\\d+');
    expect(row.created_by).toBe(admin);
  });
});

describe('deleteTemplate', () => {
  it('wirft "Nur Admins" ohne Admin-Rolle', async () => {
    const me = seedUser(h.sqlite, { role: 'user' });
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(deleteTemplate(fd({ id: 't1' }))).rejects.toThrow(
      'Nur Admins'
    );
  });

  it('entfernt die Vorlage', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    h.sqlite
      .prepare(
        `INSERT INTO templates (id, label, original_url) VALUES (?, ?, ?)`
      )
      .run('t1', 'x', 'https://x.test');
    mocks.session = { user: { id: admin, role: 'admin' } };

    await deleteTemplate(fd({ id: 't1' }));

    expect(
      h.sqlite.prepare(`SELECT id FROM templates WHERE id = ?`).get('t1')
    ).toBeUndefined();
  });
});

describe('testTemplatePattern', () => {
  it('verlangt Admin', async () => {
    const me = seedUser(h.sqlite, { role: 'user' });
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(
      testTemplatePattern({ url: 'https://x.test', pattern: 'a' })
    ).rejects.toThrow('Nur Admins');
  });

  it('lehnt non-https URL ab', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    const res = await testTemplatePattern({
      url: 'http://x.test',
      pattern: 'a',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('https');
  });

  it('lehnt leeres Pattern ab', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };

    const res = await testTemplatePattern({
      url: 'https://x.test',
      pattern: '   ',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Pattern');
  });

  it('delegiert an resolveTemplateUrl bei validem Input', async () => {
    const admin = seedUser(h.sqlite, { role: 'admin' });
    mocks.session = { user: { id: admin, role: 'admin' } };
    mocks.resolveResult = {
      ok: true,
      resolved: 'https://x.test/match',
      candidates: ['https://x.test/match'],
    };

    const res = await testTemplatePattern({
      url: 'https://x.test',
      pattern: 'match',
    });

    expect(res.ok).toBe(true);
    expect(res.resolved).toBe('https://x.test/match');
  });
});

// ---------------------------------------------------------------------------
// useTemplate (mit redirect am Ende!)
// ---------------------------------------------------------------------------

describe('useTemplate', () => {
  it('wirft "Nicht angemeldet" ohne Session', async () => {
    await expect(useTemplate(fd({ templateId: 't1' }))).rejects.toThrow(
      'Nicht angemeldet'
    );
  });

  it('wirft bei nicht-existenter Vorlage', async () => {
    const me = seedUser(h.sqlite);
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(useTemplate(fd({ templateId: 'ghost' }))).rejects.toThrow(
      'nicht gefunden'
    );
  });

  it('happy path ohne Pattern: erstellt Link aus template.original_url, redirected', async () => {
    const me = seedUser(h.sqlite);
    h.sqlite
      .prepare(
        `INSERT INTO templates (id, label, original_url) VALUES (?, ?, ?)`
      )
      .run('t1', 'Test', 'https://example.test/page');
    mocks.session = { user: { id: me, role: 'user' } };

    await expect(useTemplate(fd({ templateId: 't1' }))).rejects.toThrow(
      'NEXT_REDIRECT'
    );

    expect(mocks.redirectCalls).toHaveLength(1);
    expect(mocks.redirectCalls[0]).toMatch(/^\/templates\?created=/);

    const created = h.sqlite
      .prepare(`SELECT * FROM links WHERE user_id = ?`)
      .get(me) as Record<string, unknown>;
    expect(created.original_url).toBe('https://example.test/page');
  });

  it('happy path mit Pattern: Resolver-Result wird Ziel-URL', async () => {
    const me = seedUser(h.sqlite);
    h.sqlite
      .prepare(
        `INSERT INTO templates (id, label, original_url, url_pattern)
         VALUES (?, ?, ?, ?)`
      )
      .run('t1', 'Test', 'https://example.test/uebersicht', 'woche-\\d+');
    mocks.session = { user: { id: me, role: 'user' } };
    mocks.resolveResult = {
      ok: true,
      resolved: 'https://example.test/woche-19',
      candidates: [],
    };

    await expect(useTemplate(fd({ templateId: 't1' }))).rejects.toThrow(
      'NEXT_REDIRECT'
    );

    const created = h.sqlite
      .prepare(`SELECT original_url FROM links WHERE user_id = ?`)
      .get(me) as { original_url: string };
    expect(created.original_url).toBe('https://example.test/woche-19');
  });

  it('wirft, wenn Resolver kein Match findet', async () => {
    const me = seedUser(h.sqlite);
    h.sqlite
      .prepare(
        `INSERT INTO templates (id, label, original_url, url_pattern)
         VALUES (?, ?, ?, ?)`
      )
      .run('t1', 'Test', 'https://example.test/u', 'nichts');
    mocks.session = { user: { id: me, role: 'user' } };
    mocks.resolveResult = {
      ok: false,
      candidates: [],
      error: 'Kein Link auf der Quellseite passt zum Pattern.',
    };

    await expect(useTemplate(fd({ templateId: 't1' }))).rejects.toThrow(
      'Pattern'
    );
  });
});

// ---------------------------------------------------------------------------
// OG-Override-Actions
// ---------------------------------------------------------------------------

function fdWithFile(
  entries: Record<string, string>,
  fileField: string,
  file: File
): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  f.append(fileField, file);
  return f;
}

function makeFile(buf: Uint8Array, name = 'preview.jpg'): File {
  return new File([new Uint8Array(buf)], name, { type: 'image/jpeg' });
}

describe('updateLinkOverrides', () => {
  it('ok=false ohne Session (im Generic-Catch verpackt — siehe Feature D)', async () => {
    const res = await updateLinkOverrides(
      fd({ id: 'lnk', customTitle: 'X' })
    );
    expect(res.ok).toBe(false);
  });

  it('ok=false bei nicht-existentem Link', async () => {
    const me = seedUser(h.sqlite);
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLinkOverrides(
      fd({ id: 'ghost', customTitle: 'X' })
    );
    expect(res.ok).toBe(false);
  });

  it('ok=false bei fremdem Link (non-admin)', async () => {
    const me = seedUser(h.sqlite, { id: 'me' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: other });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLinkOverrides(
      fd({ id: 'lnk', customTitle: 'X' })
    );
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining('Berechtigung'),
    });
  });

  it('Owner darf Title/Description/SiteName ueberschreiben', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await updateLinkOverrides(
      fd({
        id: 'lnk',
        customTitle: '  Mein Titel  ',
        customDescription: 'Meine Beschreibung',
        customSiteName: 'Meine Site',
      })
    );
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT * FROM links WHERE id = ?`)
      .get('lnk') as Record<string, unknown>;
    expect(row.custom_title).toBe('Mein Titel');
    expect(row.custom_description).toBe('Meine Beschreibung');
    expect(row.custom_site_name).toBe('Meine Site');
  });

  it('leere Strings werden als NULL gespeichert (= Reset auf Scraper-Wert)', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    h.sqlite
      .prepare(
        `UPDATE links SET custom_title = ?, custom_description = ?, custom_site_name = ? WHERE id = ?`
      )
      .run('alt', 'alt', 'alt', 'lnk');
    mocks.session = { user: { id: me, role: 'user' } };

    await updateLinkOverrides(
      fd({
        id: 'lnk',
        customTitle: '',
        customDescription: '   ',
        customSiteName: '',
      })
    );

    const row = h.sqlite
      .prepare(`SELECT * FROM links WHERE id = ?`)
      .get('lnk') as Record<string, unknown>;
    expect(row.custom_title).toBeNull();
    expect(row.custom_description).toBeNull();
    expect(row.custom_site_name).toBeNull();
  });

  it('setzt image_hidden = 1 bei imageHidden=on, sonst 0', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    await updateLinkOverrides(fd({ id: 'lnk', imageHidden: 'on' }));
    expect(
      (
        h.sqlite
          .prepare(`SELECT image_hidden FROM links WHERE id = ?`)
          .get('lnk') as { image_hidden: number }
      ).image_hidden
    ).toBe(1);

    await updateLinkOverrides(fd({ id: 'lnk' }));
    expect(
      (
        h.sqlite
          .prepare(`SELECT image_hidden FROM links WHERE id = ?`)
          .get('lnk') as { image_hidden: number }
      ).image_hidden
    ).toBe(0);
  });

  it('Admin darf fremde Links ueberschreiben', async () => {
    const admin = seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    const other = seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: other });
    mocks.session = { user: { id: admin, role: 'admin' } };

    const res = await updateLinkOverrides(
      fd({ id: 'lnk', customTitle: 'Admin-Edit' })
    );
    expect(res).toEqual({ ok: true });
  });
});

describe('uploadLinkImage', () => {
  it('ok=false ohne Session', async () => {
    const res = await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(JPEG))
    );
    expect(res.ok).toBe(false);
  });

  it('ok=false ohne Datei', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await uploadLinkImage(fd({ id: 'lnk' }));
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining('Keine Datei'),
    });
  });

  it('ok=false bei Garbage-Datei (Magic-Bytes failen)', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    const garbage = new Uint8Array(new TextEncoder().encode('<html>'));
    const res = await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(garbage))
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Format');
  });

  it('Happy Path: persistiert File und setzt custom_image_path', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    const res = await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(JPEG))
    );
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT custom_image_path, image_hidden FROM links WHERE id = ?`)
      .get('lnk') as { custom_image_path: string; image_hidden: number };
    expect(row.custom_image_path).toMatch(/^lnk-[a-f0-9]{8}\.jpg$/);
    expect(row.image_hidden).toBe(0);
    expect(fs.existsSync(path.join(imgDir, row.custom_image_path))).toBe(true);
  });

  it('Re-Upload: alte Datei wird aufgeraeumt, neuer Hash kommt rein', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(JPEG))
    );
    const first = (
      h.sqlite
        .prepare(`SELECT custom_image_path FROM links WHERE id = ?`)
        .get('lnk') as { custom_image_path: string }
    ).custom_image_path;

    await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(PNG, 'preview.png'))
    );
    const second = (
      h.sqlite
        .prepare(`SELECT custom_image_path FROM links WHERE id = ?`)
        .get('lnk') as { custom_image_path: string }
    ).custom_image_path;

    expect(second).not.toBe(first);
    expect(fs.existsSync(path.join(imgDir, first))).toBe(false);
    expect(fs.existsSync(path.join(imgDir, second))).toBe(true);
  });

  it('Upload setzt image_hidden zurueck auf 0', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    h.sqlite
      .prepare(`UPDATE links SET image_hidden = 1 WHERE id = ?`)
      .run('lnk');
    mocks.session = { user: { id: me, role: 'user' } };

    await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(JPEG))
    );

    expect(
      (
        h.sqlite
          .prepare(`SELECT image_hidden FROM links WHERE id = ?`)
          .get('lnk') as { image_hidden: number }
      ).image_hidden
    ).toBe(0);
  });
});

describe('clearLinkImageOverride', () => {
  it('setzt custom_image_path zurueck und loescht die Datei', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    // Erst hochladen
    await uploadLinkImage(
      fdWithFile({ id: 'lnk' }, 'image', makeFile(JPEG))
    );
    const filename = (
      h.sqlite
        .prepare(`SELECT custom_image_path FROM links WHERE id = ?`)
        .get('lnk') as { custom_image_path: string }
    ).custom_image_path;
    expect(fs.existsSync(path.join(imgDir, filename))).toBe(true);

    // Reset
    const res = await clearLinkImageOverride(fd({ id: 'lnk' }));
    expect(res).toEqual({ ok: true });

    const row = h.sqlite
      .prepare(`SELECT custom_image_path FROM links WHERE id = ?`)
      .get('lnk') as { custom_image_path: string | null };
    expect(row.custom_image_path).toBeNull();
    expect(fs.existsSync(path.join(imgDir, filename))).toBe(false);
  });

  it('ist idempotent: zweites Clear crasht nicht', async () => {
    const me = seedUser(h.sqlite);
    seedLink(h.sqlite, { id: 'lnk', userId: me });
    mocks.session = { user: { id: me, role: 'user' } };

    const first = await clearLinkImageOverride(fd({ id: 'lnk' }));
    const second = await clearLinkImageOverride(fd({ id: 'lnk' }));

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// deleteLink/deleteAccount – Image-Cleanup-Hooks
// ---------------------------------------------------------------------------

describe('deleteLink — Image-Cleanup', () => {
  it('loescht das Override-Bild aus dem Storage', async () => {
    const me = seedUser(h.sqlite);
    // Erst ein Bild als File anlegen, dann den Link mit dem Filename verknuepfen.
    const filename = 'lnk001-12345678.jpg';
    fs.writeFileSync(path.join(imgDir, filename), JPEG);
    seedLink(h.sqlite, {
      id: 'lnk001',
      userId: me,
      customImagePath: filename,
    });
    mocks.session = { user: { id: me, role: 'user' } };

    await deleteLink(fd({ id: 'lnk001' }));

    expect(fs.existsSync(path.join(imgDir, filename))).toBe(false);
  });
});

describe('deleteAccount — Image-Cleanup', () => {
  it('raeumt alle Override-Bilder des Users auf, bevor cascade greift', async () => {
    const me = seedUser(h.sqlite);
    const fileA = 'lnkA00-aaaaaaaa.jpg';
    const fileB = 'lnkB00-bbbbbbbb.png';
    fs.writeFileSync(path.join(imgDir, fileA), JPEG);
    fs.writeFileSync(path.join(imgDir, fileB), PNG);
    seedLink(h.sqlite, {
      id: 'lnkA00',
      userId: me,
      customImagePath: fileA,
    });
    seedLink(h.sqlite, {
      id: 'lnkB00',
      userId: me,
      customImagePath: fileB,
    });
    mocks.session = { user: { id: me, role: 'user' } };

    await deleteAccount();

    expect(fs.existsSync(path.join(imgDir, fileA))).toBe(false);
    expect(fs.existsSync(path.join(imgDir, fileB))).toBe(false);
  });
});
