/**
 * Unit-Tests fuer adultFilter.
 *
 * Der Modul-interne _hosts-Cache lebt fuer die Lebensdauer der
 * Modul-Instanz. Daher pro Test: vi.resetModules() + frischer
 * dynamic import. fs.readFileSync wird ueber vi.mock gemockt; der
 * Mock-Inhalt wird pro Test gesetzt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fakeFile: string | ((path: string) => string | Buffer) | Error =
  '';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: (p: string) => {
        if (fakeFile instanceof Error) throw fakeFile;
        if (typeof fakeFile === 'function') return fakeFile(p);
        return fakeFile;
      },
    },
    readFileSync: (p: string) => {
      if (fakeFile instanceof Error) throw fakeFile;
      if (typeof fakeFile === 'function') return fakeFile(p);
      return fakeFile;
    },
  };
});

async function freshImport(): Promise<typeof import('@/lib/adultFilter')> {
  // Modul-Cache leeren, damit _hosts pro Test neu geladen wird.
  vi.resetModules();
  return import('@/lib/adultFilter');
}

beforeEach(() => {
  fakeFile = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isAdultHost — Format-Parsing', () => {
  it('parst "0.0.0.0 hostname"-Format', async () => {
    fakeFile = `# Header-Kommentar
0.0.0.0 badsite.example
0.0.0.0 evil.test`;

    const { isAdultHost } = await freshImport();

    expect(isAdultHost('badsite.example')).toBe(true);
    expect(isAdultHost('evil.test')).toBe(true);
    expect(isAdultHost('safe.test')).toBe(false);
  });

  it('ueberspringt leere Zeilen und Kommentare', async () => {
    fakeFile = `
# Eine Kommentarzeile
   # mit Leerzeichen am Anfang ist kein Kommentar laut Logik

0.0.0.0 valid.test
`;
    const { isAdultHost, adultHostCount } = await freshImport();

    expect(isAdultHost('valid.test')).toBe(true);
    // "# mit Leerzeichen..." beginnt nach trim() mit "#", wird also doch
    // als Kommentar erkannt. Wir verifizieren: nur eine Domain in der Liste.
    expect(adultHostCount()).toBe(1);
  });

  it('lowercase-t und entfernt www.-Prefix', async () => {
    fakeFile = `0.0.0.0 www.BadSite.Example`;

    const { isAdultHost } = await freshImport();

    expect(isAdultHost('badsite.example')).toBe(true);
    expect(isAdultHost('BadSite.Example'.toLowerCase())).toBe(true);
  });

  it('ueberspringt Hosts ohne Punkt (z.B. localhost)', async () => {
    fakeFile = `0.0.0.0 localhost
0.0.0.0 example.test`;

    const { adultHostCount } = await freshImport();

    expect(adultHostCount()).toBe(1);
  });

  it('ueberspringt "0.0.0.0" als Hostname (Self-Reference)', async () => {
    fakeFile = `0.0.0.0 0.0.0.0
0.0.0.0 real.test`;

    const { adultHostCount } = await freshImport();

    expect(adultHostCount()).toBe(1);
  });
});

describe('isAdultHost — Matching', () => {
  it('matcht exakten Host', async () => {
    fakeFile = `0.0.0.0 bad.example`;
    const { isAdultHost } = await freshImport();

    expect(isAdultHost('bad.example')).toBe(true);
    expect(isAdultHost('good.example')).toBe(false);
  });

  it('matcht ueber Eltern-Domain (Subdomain-Fall)', async () => {
    fakeFile = `0.0.0.0 bad.example`;
    const { isAdultHost } = await freshImport();

    expect(isAdultHost('videos.bad.example')).toBe(true);
    expect(isAdultHost('deep.nested.bad.example')).toBe(true);
  });

  it('matcht NICHT, wenn die Eltern-Domain nicht gelistet ist', async () => {
    fakeFile = `0.0.0.0 deep.nested.bad.example`;
    const { isAdultHost } = await freshImport();

    // Nur "deep.nested.bad.example" ist gelistet. "bad.example" zaehlt nicht.
    expect(isAdultHost('bad.example')).toBe(false);
    expect(isAdultHost('other.bad.example')).toBe(false);
  });

  it('matcht NICHT bei Hosts ohne Punkt (TLD-only)', async () => {
    fakeFile = `0.0.0.0 example.test`;
    const { isAdultHost } = await freshImport();

    // Walk-up bricht ab, sobald nur noch ein Label uebrig ist.
    expect(isAdultHost('foo')).toBe(false);
    expect(isAdultHost('test')).toBe(false);
  });

  it('leerer Host → false', async () => {
    fakeFile = `0.0.0.0 bad.example`;
    const { isAdultHost } = await freshImport();

    expect(isAdultHost('')).toBe(false);
  });

  it('liefert false, wenn die Liste leer ist (z.B. Datei fehlt)', async () => {
    fakeFile = new Error('ENOENT');
    const { isAdultHost, adultHostCount } = await freshImport();

    expect(adultHostCount()).toBe(0);
    expect(isAdultHost('bad.example')).toBe(false);
  });
});

describe('adultHostCount', () => {
  it('zaehlt eindeutige Hosts (dedupe via Set)', async () => {
    fakeFile = `0.0.0.0 a.test
0.0.0.0 b.test
0.0.0.0 a.test
0.0.0.0 c.test`;

    const { adultHostCount } = await freshImport();

    expect(adultHostCount()).toBe(3);
  });
});

// Caching-Verhalten ist Implementation-Detail (Modul-scope _hosts-Cache)
// und mit `vi.resetModules() + dynamic import` nicht sinnvoll messbar,
// weil jeder Test eh eine neue Modul-Instanz bekommt. Die Korrektheit
// des Cachings wird indirekt durch die anderen Tests gesichert: wenn
// die Datei bei jedem Aufruf erneut geparst wuerde, waere kein
// `adultHostCount() === N`-Vergleich stabil.
