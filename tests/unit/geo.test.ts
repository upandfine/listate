/**
 * Unit-Tests fuer lookupCountry + extractClientIp.
 * geoip-lite wird gemockt, damit die Tests nicht von der echten
 * GeoLite-DB abhaengen (und unter CI ohne Daten laufen).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn<(ip: string) => { country: string } | null>(),
}));

vi.mock('geoip-lite', () => ({
  default: { lookup: mocks.lookup },
}));

import { extractClientIp, lookupCountry } from '@/lib/geo';

describe('lookupCountry', () => {
  beforeEach(() => {
    mocks.lookup.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('liefert null bei leerer/ungesetzter IP — geoip wird nicht befragt', () => {
    expect(lookupCountry(null)).toBeNull();
    expect(lookupCountry(undefined)).toBeNull();
    expect(lookupCountry('')).toBeNull();
    expect(lookupCountry('   ')).toBeNull();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('liefert den 2-Letter-Country-Code aus geoip', () => {
    mocks.lookup.mockReturnValue({ country: 'DE' });
    expect(lookupCountry('1.2.3.4')).toBe('DE');
    expect(mocks.lookup).toHaveBeenCalledWith('1.2.3.4');
  });

  it('mappt IPv4-mapped-IPv6 (`::ffff:1.2.3.4`) auf die IPv4 vor dem Lookup', () => {
    mocks.lookup.mockReturnValue({ country: 'CH' });
    expect(lookupCountry('::ffff:5.6.7.8')).toBe('CH');
    expect(mocks.lookup).toHaveBeenCalledWith('5.6.7.8');
  });

  it('liefert null fuer Loopback (127.0.0.1, ::1, 0.0.0.0, ::) — kein DB-Hit', () => {
    expect(lookupCountry('127.0.0.1')).toBeNull();
    expect(lookupCountry('::1')).toBeNull();
    expect(lookupCountry('0.0.0.0')).toBeNull();
    expect(lookupCountry('::')).toBeNull();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('liefert null, wenn geoip keine Range findet', () => {
    mocks.lookup.mockReturnValue(null);
    expect(lookupCountry('203.0.113.99')).toBeNull();
  });

  it('liefert null, wenn geoip einen leeren Country-String liefert (Anycast)', () => {
    // geoip-lite gibt fuer 1.1.1.1 (Cloudflare-Anycast) ein Objekt mit
    // `country: ""` zurueck — wir wollen das wie null behandeln, nicht
    // einen leeren Code in die DB schreiben.
    mocks.lookup.mockReturnValue({ country: '' });
    expect(lookupCountry('1.1.1.1')).toBeNull();
  });

  it('faengt geoip-Fehler ab und liefert null', () => {
    mocks.lookup.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(lookupCountry('1.2.3.4')).toBeNull();
  });

  it('trimmt Whitespace vor dem Lookup', () => {
    mocks.lookup.mockReturnValue({ country: 'AT' });
    expect(lookupCountry('  9.9.9.9  ')).toBe('AT');
    expect(mocks.lookup).toHaveBeenCalledWith('9.9.9.9');
  });
});

describe('extractClientIp', () => {
  it('liefert null, wenn kein Header gesetzt ist', () => {
    expect(extractClientIp(new Headers())).toBeNull();
  });

  it('nimmt die erste IP aus x-forwarded-for', () => {
    const h = new Headers({
      'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2',
    });
    expect(extractClientIp(h)).toBe('203.0.113.7');
  });

  it('faellt auf x-real-ip zurueck, wenn x-forwarded-for fehlt', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.42' });
    expect(extractClientIp(h)).toBe('198.51.100.42');
  });

  it('x-forwarded-for hat Vorrang vor x-real-ip', () => {
    const h = new Headers({
      'x-forwarded-for': '203.0.113.7',
      'x-real-ip': '198.51.100.42',
    });
    expect(extractClientIp(h)).toBe('203.0.113.7');
  });

  it('mappt IPv4-mapped-IPv6 in x-forwarded-for auf reine IPv4', () => {
    const h = new Headers({ 'x-forwarded-for': '::ffff:1.2.3.4' });
    expect(extractClientIp(h)).toBe('1.2.3.4');
  });

  it('ignoriert Loopback (127.0.0.1) als erste IP und faellt nicht weiter', () => {
    // x-forwarded-for-First ist Loopback → null. x-real-ip nicht gesetzt.
    const h = new Headers({ 'x-forwarded-for': '127.0.0.1' });
    expect(extractClientIp(h)).toBeNull();
  });

  it('ignoriert Loopback in x-real-ip', () => {
    const h = new Headers({ 'x-real-ip': '::1' });
    expect(extractClientIp(h)).toBeNull();
  });

  it('liefert null bei leerem x-forwarded-for-Wert', () => {
    const h = new Headers({ 'x-forwarded-for': '   ' });
    expect(extractClientIp(h)).toBeNull();
  });
});
