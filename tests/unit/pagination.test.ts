import { describe, expect, it } from 'vitest';
import { paginate, parsePageParam } from '@/lib/pagination';

describe('parsePageParam', () => {
  it('undefined → 1', () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it('leerer String → 1', () => {
    expect(parsePageParam('')).toBe(1);
  });

  it('akzeptiert Ganzzahlen ab 1', () => {
    expect(parsePageParam('1')).toBe(1);
    expect(parsePageParam('2')).toBe(2);
    expect(parsePageParam('999')).toBe(999);
  });

  it('toleriert whitespace', () => {
    expect(parsePageParam('  3  ')).toBe(3);
  });

  it('schneidet Dezimalstellen ab (parseInt-Semantik)', () => {
    expect(parsePageParam('3.7')).toBe(3);
  });

  it('clamped 0 und negative Werte auf 1', () => {
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-5')).toBe(1);
  });

  it('alphanumerischer Muell → 1', () => {
    expect(parsePageParam('abc')).toBe(1);
    expect(parsePageParam('NaN')).toBe(1);
  });

  it('liest fuehrende Zahl aus gemischtem Input (parseInt-Semantik)', () => {
    // parseInt('5abc', 10) liefert 5 — dokumentiertes Verhalten.
    expect(parsePageParam('5abc')).toBe(5);
  });
});

describe('paginate', () => {
  const PS = 25;

  it('total = 0 → totalPages = 1, page = 1, offset = 0', () => {
    expect(paginate(0, 1, PS)).toEqual({ page: 1, totalPages: 1, offset: 0 });
  });

  it('total < pageSize → 1 Seite', () => {
    expect(paginate(7, 1, PS)).toEqual({ page: 1, totalPages: 1, offset: 0 });
  });

  it('total = pageSize → 1 Seite', () => {
    expect(paginate(25, 1, PS)).toEqual({ page: 1, totalPages: 1, offset: 0 });
  });

  it('total = pageSize + 1 → 2 Seiten (Pagination greift)', () => {
    expect(paginate(26, 1, PS)).toEqual({
      page: 1,
      totalPages: 2,
      offset: 0,
    });
    expect(paginate(26, 2, PS)).toEqual({
      page: 2,
      totalPages: 2,
      offset: 25,
    });
  });

  it('offset waechst korrekt mit Seitennummer', () => {
    expect(paginate(100, 1, PS).offset).toBe(0);
    expect(paginate(100, 2, PS).offset).toBe(25);
    expect(paginate(100, 3, PS).offset).toBe(50);
    expect(paginate(100, 4, PS).offset).toBe(75);
  });

  it('totalPages rundet AUF', () => {
    expect(paginate(26, 1, PS).totalPages).toBe(2);
    expect(paginate(50, 1, PS).totalPages).toBe(2);
    expect(paginate(51, 1, PS).totalPages).toBe(3);
    expect(paginate(75, 1, PS).totalPages).toBe(3);
  });

  it('clamped requestedPage > totalPages auf letzte Seite', () => {
    expect(paginate(26, 99, PS)).toEqual({
      page: 2,
      totalPages: 2,
      offset: 25,
    });
  });

  it('clamped requestedPage <= 0 auf 1', () => {
    expect(paginate(100, 0, PS).page).toBe(1);
    expect(paginate(100, -10, PS).page).toBe(1);
  });

  it('akzeptiert auch andere pageSize-Werte', () => {
    expect(paginate(10, 1, 5)).toEqual({ page: 1, totalPages: 2, offset: 0 });
    expect(paginate(10, 2, 5)).toEqual({ page: 2, totalPages: 2, offset: 5 });
  });

  it('wirft RangeError bei pageSize <= 0', () => {
    expect(() => paginate(10, 1, 0)).toThrow(RangeError);
    expect(() => paginate(10, 1, -5)).toThrow(RangeError);
  });

  it('wirft RangeError bei nicht-endlichem pageSize', () => {
    expect(() => paginate(10, 1, NaN)).toThrow(RangeError);
    expect(() => paginate(10, 1, Infinity)).toThrow(RangeError);
  });

  it('negativer total wird auf 0 normalisiert', () => {
    // Defensive: ein DB-COUNT(*) kann theoretisch nie negativ sein, aber
    // wenn doch (Mock, Bug, …), wollen wir nicht durch NaN multiplizieren.
    expect(paginate(-5, 1, PS)).toEqual({
      page: 1,
      totalPages: 1,
      offset: 0,
    });
  });

  it('schneidet fraktionale requestedPage ab', () => {
    expect(paginate(100, 2.9, PS).page).toBe(2);
  });
});
