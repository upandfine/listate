/**
 * Slug-Helper für lesbare Tracking-URLs.
 *
 * Erlaubt sind: Kleinbuchstaben a–z, Ziffern 0–9, Bindestriche und
 * Unterstriche. Mindestens 3, maximal 64 Zeichen.
 *
 * Reservierte Slugs (würden mit System-Routen kollidieren).
 */
const RESERVED = new Set([
  'admin',
  'api',
  'dashboard',
  'datenschutz',
  'impressum',
  'login',
  'logout',
  'settings',
  't',
  'templates',
  'robots',
  'sitemap',
]);

const SLUG_REGEX = /^[a-z0-9_-]{3,64}$/;

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug) return { ok: false, error: 'Slug ist leer.' };
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      error:
        'Slug darf nur a–z, 0–9, Bindestrich oder Unterstrich enthalten und 3–64 Zeichen lang sein.',
    };
  }
  if (RESERVED.has(slug)) {
    return { ok: false, error: `„${slug}" ist reserviert.` };
  }
  return { ok: true };
}
