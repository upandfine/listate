/**
 * Integration-Tests fuer lib/actionHelpers.ts.
 * Schliesst die Coverage-Luecke nach dem D9-Split.
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

import {
  requireAdmin,
  requireOwnedLink,
  requireUser,
  sanitizeOverride,
} from '@/lib/actionHelpers';
import { AuthError, PermissionError } from '@/lib/actionResult';

let h: TestDbHandle;

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  mocks.session = null;
});

afterEach(() => {
  h.close();
  mocks.currentDb = null;
});

describe('requireUser', () => {
  it('wirft AuthError ohne Session', async () => {
    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });

  it('wirft AuthError wenn user.id fehlt', async () => {
    mocks.session = { user: null };
    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });

  it('liefert user bei valider Session', async () => {
    mocks.session = { user: { id: 'u1', role: 'user' } };
    const user = await requireUser();
    expect(user.id).toBe('u1');
  });
});

describe('requireAdmin', () => {
  it('wirft AuthError ohne Session (durch requireUser)', async () => {
    await expect(requireAdmin()).rejects.toBeInstanceOf(AuthError);
  });

  it('wirft PermissionError mit "Nur Admins." fuer User-Rolle', async () => {
    mocks.session = { user: { id: 'u1', role: 'user' } };
    await expect(requireAdmin()).rejects.toBeInstanceOf(PermissionError);
    try {
      await requireAdmin();
    } catch (err) {
      expect((err as Error).message).toBe('Nur Admins.');
    }
  });

  it('liefert user bei Admin-Rolle', async () => {
    mocks.session = { user: { id: 'a1', role: 'admin' } };
    const user = await requireAdmin();
    expect(user.role).toBe('admin');
  });
});

describe('requireOwnedLink', () => {
  it('wirft AuthError ohne Session', async () => {
    await expect(requireOwnedLink('lnk')).rejects.toBeInstanceOf(AuthError);
  });

  it('wirft ValidationError "Link-ID fehlt." bei leerer ID', async () => {
    mocks.session = { user: { id: 'u1', role: 'user' } };
    await expect(requireOwnedLink('')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Link-ID fehlt.',
    });
  });

  it('wirft ValidationError "Link nicht gefunden." bei unbekannter ID', async () => {
    seedUser(h.sqlite, { id: 'u1' });
    mocks.session = { user: { id: 'u1', role: 'user' } };
    await expect(requireOwnedLink('ghost')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Link nicht gefunden.',
    });
  });

  it('wirft PermissionError bei fremdem Link (non-admin)', async () => {
    seedUser(h.sqlite, { id: 'me' });
    seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: 'other' });
    mocks.session = { user: { id: 'me', role: 'user' } };

    await expect(requireOwnedLink('lnk')).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it('Owner: liefert {user, link}', async () => {
    seedUser(h.sqlite, { id: 'me' });
    seedLink(h.sqlite, { id: 'lnk', userId: 'me' });
    mocks.session = { user: { id: 'me', role: 'user' } };

    const { user, link } = await requireOwnedLink('lnk');
    expect(user.id).toBe('me');
    expect(link.id).toBe('lnk');
  });

  it('Admin: liefert auch fremde Links', async () => {
    seedUser(h.sqlite, { id: 'admin', role: 'admin' });
    seedUser(h.sqlite, { id: 'other' });
    seedLink(h.sqlite, { id: 'lnk', userId: 'other' });
    mocks.session = { user: { id: 'admin', role: 'admin' } };

    const { link } = await requireOwnedLink('lnk');
    expect(link.id).toBe('lnk');
  });
});

describe('sanitizeOverride', () => {
  it('undefined → null', () => {
    expect(sanitizeOverride(undefined)).toBeNull();
  });

  it('leerer String → null', () => {
    expect(sanitizeOverride('')).toBeNull();
  });

  it('whitespace-only → null', () => {
    expect(sanitizeOverride('   ')).toBeNull();
    expect(sanitizeOverride('\t\n')).toBeNull();
  });

  it('echte Werte werden getrimmt zurueckgegeben', () => {
    expect(sanitizeOverride('  Mein Titel  ')).toBe('Mein Titel');
  });

  it('non-string input (defensive) → null', () => {
    // sanitizeOverride ist typed gegen string | undefined, aber wir
    // testen das Runtime-Fallback fuer den Fall, dass jemand es
    // unsicher aufruft.
    expect(sanitizeOverride(42 as unknown as string)).toBeNull();
  });
});
