import { describe, expect, it } from 'vitest';
import { isExpired, TTL_LABELS, TTL_PRESETS, ttlToExpiresAt } from '@/lib/ttl';

const FIXED_NOW = new Date('2026-05-08T12:00:00Z');

describe('TTL_PRESETS / TTL_LABELS', () => {
  it('für jeden Preset existiert ein Label', () => {
    for (const preset of TTL_PRESETS) {
      expect(TTL_LABELS[preset]).toBeTruthy();
    }
  });
});

describe('ttlToExpiresAt', () => {
  it('liefert null für unbekannte / leere / nicht-string-Werte', () => {
    expect(ttlToExpiresAt(undefined, FIXED_NOW)).toBeNull();
    expect(ttlToExpiresAt(null, FIXED_NOW)).toBeNull();
    expect(ttlToExpiresAt('', FIXED_NOW)).toBeNull();
    expect(ttlToExpiresAt('xyz', FIXED_NOW)).toBeNull();
    expect(ttlToExpiresAt(42, FIXED_NOW)).toBeNull();
    expect(ttlToExpiresAt({}, FIXED_NOW)).toBeNull();
  });

  it('rechnet Tage korrekt', () => {
    expect(ttlToExpiresAt('2d', FIXED_NOW)).toBe('2026-05-10 12:00:00');
    expect(ttlToExpiresAt('7d', FIXED_NOW)).toBe('2026-05-15 12:00:00');
  });

  it('rechnet Wochen korrekt', () => {
    expect(ttlToExpiresAt('2w', FIXED_NOW)).toBe('2026-05-22 12:00:00');
    expect(ttlToExpiresAt('4w', FIXED_NOW)).toBe('2026-06-05 12:00:00');
  });

  it('rechnet Monate korrekt (kalendarisch)', () => {
    expect(ttlToExpiresAt('1m', FIXED_NOW)).toBe('2026-06-08 12:00:00');
    expect(ttlToExpiresAt('3m', FIXED_NOW)).toBe('2026-08-08 12:00:00');
  });

  it('akzeptiert getrimmte und großgeschriebene Presets', () => {
    expect(ttlToExpiresAt(' 7D ', FIXED_NOW)).toBe('2026-05-15 12:00:00');
  });

  it('arbeitet in UTC, nicht in Lokalzeit', () => {
    const result = ttlToExpiresAt('2d', new Date('2026-05-08T23:59:00Z'));
    expect(result).toBe('2026-05-10 23:59:00');
  });
});

describe('isExpired', () => {
  it('null oder leer → nicht abgelaufen', () => {
    expect(isExpired(null, FIXED_NOW)).toBe(false);
    expect(isExpired('', FIXED_NOW)).toBe(false);
  });

  it('Zeitpunkt in der Vergangenheit → abgelaufen', () => {
    expect(isExpired('2026-05-07 12:00:00', FIXED_NOW)).toBe(true);
  });

  it('Zeitpunkt exakt jetzt → abgelaufen (Grenzfall, <= statt <)', () => {
    expect(isExpired('2026-05-08 12:00:00', FIXED_NOW)).toBe(true);
  });

  it('Zeitpunkt in der Zukunft → nicht abgelaufen', () => {
    expect(isExpired('2026-05-09 12:00:00', FIXED_NOW)).toBe(false);
  });

  it('interpretiert DB-Wert als UTC, nicht Lokalzeit', () => {
    // 2026-05-08 12:00:00 wird zu '2026-05-08T12:00:00Z' geparst.
    // Wenn lokal anders interpretiert würde, wäre dieser Test
    // zeitzonenabhängig — er ist es nicht.
    const ts = '2026-05-08 11:59:59';
    expect(isExpired(ts, FIXED_NOW)).toBe(true);
  });
});
