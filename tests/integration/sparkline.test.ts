/**
 * Integration-Test: `getClickHistory` aggregiert Klicks gegen eine echte
 * SQLite-Instanz (im RAM).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClickHistory } from '@/lib/sparkline';
import {
  createTestDb,
  seedClicks,
  seedLink,
  seedUser,
  type TestDbHandle,
} from '../utils/db';

const FIXED_NOW = new Date('2026-05-08T12:00:00Z');

describe('getClickHistory', () => {
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

  it('liefert leere Map fuer leere Link-Liste', () => {
    const result = getClickHistory(h.db, [], 14);
    expect(result.size).toBe(0);
  });

  it('initialisiert jeden Tag mit count 0 fuer Links ohne Klicks', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    const result = getClickHistory(h.db, [linkId], 7);

    const series = result.get(linkId);
    expect(series).toHaveLength(7);
    expect(series?.every((s) => s.count === 0)).toBe(true);
  });

  it('legt Tage in chronologisch aufsteigender Reihenfolge ab (aelteste zuerst)', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    const series = getClickHistory(h.db, [linkId], 3).get(linkId)!;

    expect(series.map((s) => s.day)).toEqual([
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ]);
  });

  it('zaehlt Klicks pro Tag korrekt zusammen', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      '2026-05-06 09:00:00',
      '2026-05-06 18:30:00',
      '2026-05-08 11:00:00',
      '2026-05-08 11:30:00',
      '2026-05-08 11:31:00',
    ]);

    const series = getClickHistory(h.db, [linkId], 3).get(linkId)!;

    expect(series).toEqual([
      { day: '2026-05-06', count: 2 },
      { day: '2026-05-07', count: 0 },
      { day: '2026-05-08', count: 3 },
    ]);
  });

  it('ignoriert Klicks ausserhalb des Fensters', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    seedClicks(h.sqlite, linkId, [
      '2026-04-01 12:00:00', // zu alt fuer 7-Tage-Fenster
      '2026-05-08 12:00:00', // im Fenster
    ]);

    const series = getClickHistory(h.db, [linkId], 7).get(linkId)!;
    const total = series.reduce((sum, s) => sum + s.count, 0);

    expect(total).toBe(1);
  });

  it('aggregiert mehrere Links in einer Query, ohne sie zu vermischen', () => {
    const userId = seedUser(h.sqlite);
    const a = seedLink(h.sqlite, { userId, id: 'link_a' });
    const b = seedLink(h.sqlite, { userId, id: 'link_b' });

    seedClicks(h.sqlite, a, ['2026-05-08 09:00:00', '2026-05-08 10:00:00']);
    seedClicks(h.sqlite, b, ['2026-05-08 11:00:00']);

    const result = getClickHistory(h.db, [a, b], 1);

    expect(result.get(a)).toEqual([{ day: '2026-05-08', count: 2 }]);
    expect(result.get(b)).toEqual([{ day: '2026-05-08', count: 1 }]);
  });

  it('liefert auch fuer unbekannte Link-IDs eine Null-Reihe (kein Crash)', () => {
    const result = getClickHistory(h.db, ['link_does_not_exist'], 3);
    const series = result.get('link_does_not_exist');
    expect(series).toHaveLength(3);
    expect(series?.every((s) => s.count === 0)).toBe(true);
  });

  it('Default-Fenster ist 14 Tage', () => {
    const userId = seedUser(h.sqlite);
    const linkId = seedLink(h.sqlite, { userId });

    const series = getClickHistory(h.db, [linkId]).get(linkId)!;

    expect(series).toHaveLength(14);
    expect(series[0].day).toBe('2026-04-25');
    expect(series[13].day).toBe('2026-05-08');
  });
});
