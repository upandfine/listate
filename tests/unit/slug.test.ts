import { describe, expect, it } from 'vitest';
import { normalizeSlug, validateSlug } from '@/lib/slug';

describe('normalizeSlug', () => {
  it('trimmt und lowercase-t', () => {
    expect(normalizeSlug('  Hello-World  ')).toBe('hello-world');
  });

  it('lässt zulässige Zeichen unverändert', () => {
    expect(normalizeSlug('a_b-c-123')).toBe('a_b-c-123');
  });

  it('ändert Inhalt mit Umlauten nicht — die Validierung lehnt sie ab', () => {
    // normalize lowercase-t lediglich; Validation greift dann
    expect(normalizeSlug('FÜßE')).toBe('füße');
  });
});

describe('validateSlug', () => {
  it.each(['abc', '123', 'a-b', 'a_b', 'a'.repeat(64), 'sommer-2026'])(
    'akzeptiert „%s"',
    (slug) => {
      expect(validateSlug(slug)).toEqual({ ok: true });
    }
  );

  it('lehnt leeren Slug ab', () => {
    expect(validateSlug('')).toEqual({
      ok: false,
      error: 'Slug ist leer.',
    });
  });

  it('lehnt zu kurze Slugs ab (< 3 Zeichen)', () => {
    const res = validateSlug('ab');
    expect(res.ok).toBe(false);
  });

  it('lehnt zu lange Slugs ab (> 64 Zeichen)', () => {
    const res = validateSlug('a'.repeat(65));
    expect(res.ok).toBe(false);
  });

  it.each(['ABC', 'abc!', 'abc def', 'abc.def', 'abc/def', 'abc?'])(
    'lehnt unzulässige Zeichen in „%s" ab',
    (slug) => {
      const res = validateSlug(slug);
      expect(res.ok).toBe(false);
    }
  );

  // Reservierte Slugs, die die Regex passieren (>= 3 Zeichen) und daher
  // mit explizitem „reserviert"-Fehler abgelehnt werden müssen.
  it.each([
    'admin',
    'api',
    'dashboard',
    'datenschutz',
    'impressum',
    'login',
    'logout',
    'settings',
    'templates',
    'robots',
    'sitemap',
  ])('blockiert reservierten Slug „%s" mit Reservierungs-Fehler', (slug) => {
    const res = validateSlug(slug);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('reserviert');
  });

  it('„t" ist zwar reserviert, scheitert aber bereits an der Mindestlänge', () => {
    // Doku: Bei einbuchstabigen Slugs schlägt die Regex-Prüfung zuerst
    // an. Das ist akzeptabel — der Slug wird so oder so abgelehnt.
    const res = validateSlug('t');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain('reserviert');
  });
});
