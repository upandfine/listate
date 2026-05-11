import { describe, expect, it } from 'vitest';
import { normalizeHost } from '@/lib/host';

describe('normalizeHost', () => {
  it('lowercase-t', () => {
    expect(normalizeHost('Example.com')).toBe('example.com');
  });

  it('entfernt www.', () => {
    expect(normalizeHost('www.example.com')).toBe('example.com');
  });

  it('extrahiert Host aus voller URL', () => {
    expect(normalizeHost('https://www.Example.com/foo?bar')).toBe('example.com');
  });

  it('extrahiert Host aus URL ohne Schema (mit Pfad)', () => {
    expect(normalizeHost('example.com/path')).toBe('example.com');
    expect(normalizeHost('www.example.com/path')).toBe('example.com');
  });

  it('liefert leeren String bei leerer Eingabe', () => {
    expect(normalizeHost('')).toBe('');
    expect(normalizeHost('   ')).toBe('');
  });

  it('belässt Subdomains außer www.', () => {
    expect(normalizeHost('blog.example.com')).toBe('blog.example.com');
    expect(normalizeHost('https://blog.example.com')).toBe('blog.example.com');
  });

  it('akzeptiert IDN/Punycode unverändert (lowercase)', () => {
    expect(normalizeHost('xn--bcher-kva.de')).toBe('xn--bcher-kva.de');
  });

  it('fällt bei ungültiger URL-mit-Slash sanft zurück auf den Roh-Wert', () => {
    // "://" macht den URL-Konstruktor explodieren, der catch-Branch greift.
    const result = normalizeHost(':://');
    expect(typeof result).toBe('string');
  });
});
