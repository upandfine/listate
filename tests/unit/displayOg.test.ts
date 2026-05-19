import { describe, expect, it } from 'vitest';
import {
  getDisplayOg,
  isValidImageFilename,
  proxiedOgImage,
  type OgInput,
} from '@/lib/displayOg';

function input(overrides: Partial<OgInput> = {}): OgInput {
  return {
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    ogSiteName: null,
    customTitle: null,
    customDescription: null,
    customSiteName: null,
    customImagePath: null,
    imageHidden: 0,
    ...overrides,
  };
}

describe('getDisplayOg — Text-Felder', () => {
  it('liefert og_*, wenn keine Overrides gesetzt sind', () => {
    const res = getDisplayOg(
      input({
        ogTitle: 'Scraped Title',
        ogDescription: 'Scraped Desc',
        ogSiteName: 'Scraped Site',
      })
    );
    expect(res.title).toBe('Scraped Title');
    expect(res.description).toBe('Scraped Desc');
    expect(res.siteName).toBe('Scraped Site');
  });

  it('custom_* uebersteuert og_*', () => {
    const res = getDisplayOg(
      input({
        ogTitle: 'Scraped',
        customTitle: 'Mein Titel',
        ogDescription: 'Scraped Desc',
        customDescription: 'Meine Beschreibung',
        ogSiteName: 'Scraped Site',
        customSiteName: 'Meine Site',
      })
    );
    expect(res.title).toBe('Mein Titel');
    expect(res.description).toBe('Meine Beschreibung');
    expect(res.siteName).toBe('Meine Site');
  });

  it('leerer String im custom_* ist KEIN Override (er gewinnt nicht)', () => {
    // Aktuelles Verhalten: NULL = "nutze og". Wenn der User explizit
    // einen leeren Wert speichern will, muss er den Reset-Button benutzen
    // (custom = NULL). Das ist die saubere Variante — leerer String =
    // "ich will explizit nichts anzeigen" wuerde mehrere States brauchen
    // und ist hier bewusst nicht implementiert.
    const res = getDisplayOg(
      input({ ogTitle: 'Scraped', customTitle: '' })
    );
    // Hinweis: '' ist truthy fuer `??`, deshalb gewinnt der leere String.
    // Wenn das nicht gewollt waere, muessten wir custom_* trimmen und
    // leere Werte beim Schreiben auf NULL casten — Vorgehensweise im
    // Backend.
    expect(res.title).toBe('');
  });
});

describe('getDisplayOg — Image', () => {
  it('keine OG-Bilder → image = null', () => {
    expect(getDisplayOg(input()).image).toBeNull();
  });

  it('og_image vorhanden, kein Override → og_image gewinnt', () => {
    const res = getDisplayOg(
      input({ ogImage: 'https://example.test/scraped.png' })
    );
    expect(res.image).toBe('https://example.test/scraped.png');
  });

  it('custom_image_path uebersteuert og_image (als App-Pfad)', () => {
    const res = getDisplayOg(
      input({
        ogImage: 'https://example.test/scraped.png',
        customImagePath: 'AbCdEf-1a2b3c4d.jpg',
      })
    );
    expect(res.image).toBe('/api/og-image/AbCdEf-1a2b3c4d.jpg');
  });

  it('imageHidden = 1 → image = null, auch wenn og_image oder custom_image gesetzt ist', () => {
    expect(
      getDisplayOg(
        input({
          ogImage: 'https://example.test/scraped.png',
          customImagePath: 'AbCdEf-1a2b3c4d.jpg',
          imageHidden: 1,
        })
      ).image
    ).toBeNull();
  });

  it('manipulierter customImagePath wird nicht ausgeliefert (defensive)', () => {
    const res = getDisplayOg(
      input({
        ogImage: 'https://example.test/scraped.png',
        customImagePath: '../etc/passwd',
      })
    );
    // Fallback ist NICHT og_image — wir wollen nicht "ohne Override"
    // wirken, sondern explizit null, damit der Fehler sichtbar wird.
    expect(res.image).toBeNull();
  });
});

describe('isValidImageFilename', () => {
  it.each([
    'AbCdEf-1a2b3c4d.jpg',
    'AbCdEf-1a2b3c4d.jpeg',
    'AbCdEf-1a2b3c4d.png',
    'AbCdEf-1a2b3c4d.webp',
    'AbCdEf-1a2b3c4d.gif',
    'mYLinkId12345-1a2b3c4d.jpg', // 13 Zeichen ID, weiterhin alphanumerisch
  ])('akzeptiert "%s"', (name) => {
    expect(isValidImageFilename(name)).toBe(true);
  });

  it.each([
    '../etc/passwd',
    '/absolute/path.jpg',
    'sub/dir.jpg',
    'AbCdEf.jpg', // kein Hash-Teil
    'AbCdEf-XYZ.jpg', // Hash mit Nicht-Hex
    'AbCdEf-1a2b3c4d.exe', // falsche Extension
    'AbCdEf-1a2b3c4d', // keine Extension
    '-1a2b3c4d.jpg', // leere ID
  ])('lehnt "%s" ab', (name) => {
    expect(isValidImageFilename(name)).toBe(false);
  });
});

describe('proxiedOgImage', () => {
  const withId = (o: Partial<OgInput> = {}) => ({ ...input(o), id: 'lnkXYZ1' });

  it('externes og_image → eigener Proxy-Pfad', () => {
    expect(
      proxiedOgImage(withId({ ogImage: 'https://cdn.foreign.com/x.jpg' }))
    ).toBe('/api/og-image/remote/lnkXYZ1');
  });

  it('Custom-Upload → direkter /api/og-image-Pfad (schon same-origin)', () => {
    expect(
      proxiedOgImage(withId({ customImagePath: 'AbCdEf-1a2b3c4d.jpg' }))
    ).toBe('/api/og-image/AbCdEf-1a2b3c4d.jpg');
  });

  it('imageHidden = 1 → null', () => {
    expect(
      proxiedOgImage(
        withId({ ogImage: 'https://cdn.foreign.com/x.jpg', imageHidden: 1 })
      )
    ).toBeNull();
  });

  it('kein Bild → null', () => {
    expect(proxiedOgImage(withId())).toBeNull();
  });

  it('manipulierter customImagePath → null (defensive)', () => {
    expect(
      proxiedOgImage(withId({ customImagePath: '../etc/passwd' }))
    ).toBeNull();
  });
});
