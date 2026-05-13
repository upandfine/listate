/**
 * Integration-Test: getDailyClicks / getHeatmap / getRecentClicks gegen
 * eine echte SQLite-Instanz (im RAM). Deckt Datums-Math (UTC, DOW,
 * Stunde) und die `strftime`-Verlaesslichkeit ab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCountryBreakdown,
  getDailyClicks,
  getHeatmap,
  getRecentClicks,
} from '@/lib/clickStats';
import {
  createTestDb,
  seedClicks,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

const FIXED_NOW = new Date('2026-05-08T12:00:00Z'); // Freitag UTC

describe('getDailyClicks', () => {
  let h: TestDbHandle;

  beforeEach(() => {
    h = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    h.close();
    vi.useRealTimers();
  });

  it('leerer Link → Null-Reihe in chronologischer Reihenfolge', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    const series = getDailyClicks(h.db, linkId, 5);

    expect(series).toEqual([
      { day: '2026-05-04', count: 0 },
      { day: '2026-05-05', count: 0 },
      { day: '2026-05-06', count: 0 },
      { day: '2026-05-07', count: 0 },
      { day: '2026-05-08', count: 0 },
    ]);
  });

  it('zaehlt Klicks pro Tag korrekt', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      '2026-05-04 08:00:00',
      '2026-05-04 09:00:00',
      '2026-05-07 23:59:59',
      '2026-05-08 00:00:01',
      '2026-05-08 11:00:00',
    ]);

    const series = getDailyClicks(h.db, linkId, 5);

    expect(series.find((s) => s.day === '2026-05-04')?.count).toBe(2);
    expect(series.find((s) => s.day === '2026-05-07')?.count).toBe(1);
    expect(series.find((s) => s.day === '2026-05-08')?.count).toBe(2);
  });

  it('ignoriert Klicks anderer Links', () => {
    const userId = seedUser(h.sqlite);
    const a = seedLink(h.sqlite, { userId, id: 'a' });
    const b = seedLink(h.sqlite, { userId, id: 'b' });

    seedClicks(h.sqlite, a, ['2026-05-08 10:00:00']);
    seedClicks(h.sqlite, b, [
      '2026-05-08 10:00:00',
      '2026-05-08 11:00:00',
    ]);

    expect(getDailyClicks(h.db, a, 1)).toEqual([
      { day: '2026-05-08', count: 1 },
    ]);
    expect(getDailyClicks(h.db, b, 1)).toEqual([
      { day: '2026-05-08', count: 2 },
    ]);
  });

  it('ignoriert Klicks ausserhalb des Fensters', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      '2026-04-01 12:00:00', // weit vor dem Fenster
      '2026-05-08 12:00:00',
    ]);

    const series = getDailyClicks(h.db, linkId, 3);
    const total = series.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(1);
  });
});

describe('getHeatmap', () => {
  let h: TestDbHandle;

  beforeEach(() => {
    h = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    h.close();
    vi.useRealTimers();
  });

  it('liefert ein 7×24-Grid mit Nullen, wenn keine Klicks da sind', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    const grid = getHeatmap(h.db, linkId, 30);

    expect(grid).toHaveLength(7);
    for (const row of grid) {
      expect(row).toHaveLength(24);
      expect(row.every((c) => c === 0)).toBe(true);
    }
  });

  it('ordnet Klicks SQLite-konform: %w = 0 fuer Sonntag, %H = Stunde', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    // 2026-05-03 ist ein Sonntag, 2026-05-08 ein Freitag.
    seedClicks(h.sqlite, linkId, [
      '2026-05-03 09:15:00', // Sonntag 09 Uhr
      '2026-05-03 09:45:00', // Sonntag 09 Uhr
      '2026-05-08 14:00:00', // Freitag 14 Uhr
    ]);

    const grid = getHeatmap(h.db, linkId, 30);

    expect(grid[0][9]).toBe(2); // Sonntag, 09 Uhr
    expect(grid[5][14]).toBe(1); // Freitag, 14 Uhr
    // Sicherstellen, dass nirgendwo sonst was steht.
    let total = 0;
    for (const row of grid) for (const c of row) total += c;
    expect(total).toBe(3);
  });

  it('ignoriert Klicks ausserhalb des Fensters', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      '2026-01-01 09:00:00', // ueber 90 Tage her
      '2026-05-08 09:00:00',
    ]);

    const grid = getHeatmap(h.db, linkId, 30);
    let total = 0;
    for (const row of grid) for (const c of row) total += c;
    expect(total).toBe(1);
  });
});

describe('getRecentClicks', () => {
  let h: TestDbHandle;

  beforeEach(() => {
    h = createTestDb();
  });

  afterEach(() => {
    h.close();
  });

  it('liefert leere Liste fuer Link ohne Klicks', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    expect(getRecentClicks(h.db, linkId, 10)).toEqual([]);
  });

  it('liefert Klicks chronologisch absteigend (neueste zuerst)', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      '2026-05-01 09:00:00',
      '2026-05-08 12:00:00',
      '2026-05-05 14:00:00',
    ]);

    const recent = getRecentClicks(h.db, linkId, 10);

    expect(recent).toEqual([
      '2026-05-08 12:00:00',
      '2026-05-05 14:00:00',
      '2026-05-01 09:00:00',
    ]);
  });

  it('respektiert das N-Limit', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(
      h.sqlite,
      linkId,
      Array.from({ length: 100 }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return `2026-04-${day} 12:00:00`;
      }).slice(0, 30)
    );

    expect(getRecentClicks(h.db, linkId, 5)).toHaveLength(5);
    expect(getRecentClicks(h.db, linkId, 100)).toHaveLength(30);
  });

  it('zieht Klicks anderer Links NICHT mit', () => {
    const userId = seedUser(h.sqlite);
    const a = seedLink(h.sqlite, { userId, id: 'a' });
    const b = seedLink(h.sqlite, { userId, id: 'b' });

    seedClicks(h.sqlite, a, ['2026-05-08 09:00:00']);
    seedClicks(h.sqlite, b, ['2026-05-08 10:00:00']);

    expect(getRecentClicks(h.db, a, 10)).toEqual(['2026-05-08 09:00:00']);
    expect(getRecentClicks(h.db, b, 10)).toEqual(['2026-05-08 10:00:00']);
  });
});

describe('getCountryBreakdown', () => {
  let h: TestDbHandle;

  beforeEach(() => {
    h = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    h.close();
    vi.useRealTimers();
  });

  it('liefert leere Liste bei Link ohne Klicks', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });
    expect(getCountryBreakdown(h.db, linkId, 90)).toEqual([]);
  });

  it('aggregiert Klicks pro Country, sortiert nach count desc', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      ['2026-05-08 09:00:00', 'DE'],
      ['2026-05-08 10:00:00', 'DE'],
      ['2026-05-08 11:00:00', 'DE'],
      ['2026-05-08 12:00:00', 'CH'],
      ['2026-05-08 13:00:00', 'CH'],
      ['2026-05-08 14:00:00', 'AT'],
    ]);

    expect(getCountryBreakdown(h.db, linkId, 90)).toEqual([
      { country: 'DE', count: 3 },
      { country: 'CH', count: 2 },
      { country: 'AT', count: 1 },
    ]);
  });

  it('aggregiert Klicks ohne Country-Code separat (country = null)', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      ['2026-05-08 09:00:00', 'DE'],
      ['2026-05-08 10:00:00', null],
      ['2026-05-08 11:00:00', null],
    ]);

    const result = getCountryBreakdown(h.db, linkId, 90);
    // null kommt als eigene Gruppe (mit 2 Klicks → vor DE).
    expect(result).toEqual([
      { country: null, count: 2 },
      { country: 'DE', count: 1 },
    ]);
  });

  it('ignoriert Klicks ausserhalb des Tages-Fensters', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      ['2026-01-01 09:00:00', 'DE'], // > 90 Tage her
      ['2026-05-08 10:00:00', 'CH'],
    ]);

    expect(getCountryBreakdown(h.db, linkId, 90)).toEqual([
      { country: 'CH', count: 1 },
    ]);
  });

  it('zieht Klicks anderer Links NICHT mit', () => {
    const userId = seedUser(h.sqlite);
    const a = seedLink(h.sqlite, { userId, id: 'a' });
    const b = seedLink(h.sqlite, { userId, id: 'b' });

    seedClicks(h.sqlite, a, [['2026-05-08 09:00:00', 'DE']]);
    seedClicks(h.sqlite, b, [
      ['2026-05-08 10:00:00', 'CH'],
      ['2026-05-08 11:00:00', 'CH'],
    ]);

    expect(getCountryBreakdown(h.db, a, 90)).toEqual([
      { country: 'DE', count: 1 },
    ]);
    expect(getCountryBreakdown(h.db, b, 90)).toEqual([
      { country: 'CH', count: 2 },
    ]);
  });
});
