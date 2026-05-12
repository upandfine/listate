import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetRateLimitForTests,
  checkRateLimit,
  READ_LIMITS,
} from '@/lib/rateLimit';

beforeEach(() => {
  _resetRateLimitForTests();
});

afterEach(() => {
  _resetRateLimitForTests();
});

describe('checkRateLimit', () => {
  it('erster Request ist erlaubt', () => {
    const res = checkRateLimit({ key: 'k', limit: 3, windowMs: 1000 });
    expect(res).toEqual({ allowed: true, remaining: 2, retryAfter: 0 });
  });

  it('zaehlt aufwaerts bis zum Limit', () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit({ key: 'k', limit: 3, windowMs: 1000 });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(2 - i);
    }
  });

  it('blockiert Request 4 bei Limit 3', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: 'k', limit: 3, windowMs: 1000 });
    }
    const blocked = checkRateLimit({ key: 'k', limit: 3, windowMs: 1000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('verschiedene Keys haben unabhaengige Counter', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: 'a', limit: 3, windowMs: 1000 });
    }
    expect(
      checkRateLimit({ key: 'b', limit: 3, windowMs: 1000 }).allowed
    ).toBe(true);
  });

  it('Sliding-Window: alte Eintraege werden freigegeben', () => {
    let now = 1000;
    const opts = (n: number) => ({
      key: 'k',
      limit: 2,
      windowMs: 1000,
      now: () => n,
    });

    // 2 Requests verbrauchen das Limit
    expect(checkRateLimit(opts(now)).allowed).toBe(true);
    expect(checkRateLimit(opts(now)).allowed).toBe(true);
    expect(checkRateLimit(opts(now)).allowed).toBe(false);

    // Eine Sekunde spaeter sind die alten Hits raus dem Fenster
    now += 1001;
    expect(checkRateLimit(opts(now)).allowed).toBe(true);
    expect(checkRateLimit(opts(now)).allowed).toBe(true);
    expect(checkRateLimit(opts(now)).allowed).toBe(false);
  });

  it('retryAfter zeigt auf den naechsten frei werdenden Slot', () => {
    const now = 5000;
    const opts = (n: number, key = 'k') => ({
      key,
      limit: 2,
      windowMs: 1000,
      now: () => n,
    });

    checkRateLimit(opts(now));
    checkRateLimit(opts(now + 200));

    // Bei jetzt+500: 2 Hits drin, naechster ist erst frei, wenn der erste
    // (now=5000) faellt — also bei now+1000. Differenz: 500ms = 1s gerundet.
    const blocked = checkRateLimit(opts(now + 500));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(1);
  });

  it('limit=0 → alles wird abgelehnt', () => {
    const res = checkRateLimit({ key: 'k', limit: 0, windowMs: 1000 });
    expect(res.allowed).toBe(false);
  });
});

describe('READ_LIMITS — exportierte Konstanten', () => {
  it('LINKS: 300 / Stunde', () => {
    expect(READ_LIMITS.LINKS.limit).toBe(300);
    expect(READ_LIMITS.LINKS.windowMs).toBe(3_600_000);
  });

  it('EXPORT: 10 / Stunde', () => {
    expect(READ_LIMITS.EXPORT.limit).toBe(10);
    expect(READ_LIMITS.EXPORT.windowMs).toBe(3_600_000);
  });
});
