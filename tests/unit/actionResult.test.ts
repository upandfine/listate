/**
 * Unit-Tests fuer die ActionResult-Foundation (lib/actionResult.ts).
 * Schliesst die Coverage-Luecke nach dem D9-Split.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackingLinkError } from '@/lib/createTrackingLink';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    const err = new Error('NEXT_REDIRECT');
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${path}`;
    throw err;
  }),
}));

import {
  actionFail,
  actionOk,
  actionOkData,
  actionRedirect,
  AuthError,
  executeOrRedirect,
  parseFormData,
  PermissionError,
  toActionFail,
  ValidationError,
} from '@/lib/actionResult';
import { z } from 'zod';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Konstruktoren', () => {
  it('actionOk: { ok: true }', () => {
    expect(actionOk()).toEqual({ ok: true });
  });

  it('actionOkData: { ok: true, data }', () => {
    expect(actionOkData({ x: 1 })).toEqual({ ok: true, data: { x: 1 } });
  });

  it('actionRedirect: { ok: true, redirect }', () => {
    expect(actionRedirect('/foo')).toEqual({ ok: true, redirect: '/foo' });
  });

  it('actionFail: { ok: false, error }', () => {
    expect(actionFail('boom')).toEqual({ ok: false, error: 'boom' });
  });
});

describe('toActionFail', () => {
  it('reicht TrackingLinkError-Message 1:1 durch', () => {
    const res = toActionFail(
      new TrackingLinkError('Nur https-URLs sind erlaubt.', 400),
      'test'
    );
    expect(res).toEqual({ ok: false, error: 'Nur https-URLs sind erlaubt.' });
  });

  it('reicht AuthError-Message 1:1 durch', () => {
    const res = toActionFail(new AuthError(), 'test');
    expect(res).toEqual({ ok: false, error: 'Nicht angemeldet.' });
  });

  it('reicht PermissionError-Message 1:1 durch', () => {
    const res = toActionFail(new PermissionError(), 'test');
    expect(res).toEqual({ ok: false, error: 'Keine Berechtigung.' });
  });

  it('reicht ValidationError-Message 1:1 durch', () => {
    const res = toActionFail(new ValidationError('Pattern fehlt.'), 'test');
    expect(res).toEqual({ ok: false, error: 'Pattern fehlt.' });
  });

  it('verpackt unbekannten Error in generischer Message + console.error', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = toActionFail(new Error('internal db crash'), 'updateLink');
    expect(res).toEqual({ ok: false, error: 'Unbekannter Fehler.' });
    expect(errSpy).toHaveBeenCalledWith(
      '[updateLink] unexpected error:',
      expect.any(Error)
    );
  });

  it('verpackt non-Error-Throws in generischer Message + console.error', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = toActionFail('plain string thrown', 'updateLink');
    expect(res).toEqual({ ok: false, error: 'Unbekannter Fehler.' });
    expect(errSpy).toHaveBeenCalledWith(
      '[updateLink] unexpected non-Error throw:',
      'plain string thrown'
    );
  });
});

describe('parseFormData', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name fehlt.'),
    age: z.string().optional().default(''),
  });

  function fd(entries: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.append(k, v);
    return f;
  }

  it('liefert validierten Output', () => {
    const result = parseFormData(fd({ name: 'Alice', age: '30' }), schema);
    expect(result).toEqual({ name: 'Alice', age: '30' });
  });

  it('default greift bei fehlendem optional-Feld', () => {
    const result = parseFormData(fd({ name: 'Bob' }), schema);
    expect(result.age).toBe('');
  });

  it('wirft ValidationError mit Custom-Message (kein Path-Prefix)', () => {
    expect(() => parseFormData(fd({ name: '' }), schema)).toThrow(
      ValidationError
    );
    try {
      parseFormData(fd({ name: '' }), schema);
    } catch (err) {
      expect((err as Error).message).toBe('Name fehlt.');
    }
  });

  it('ueberspringt File-Felder (kein Schema-Crash)', () => {
    const f = new FormData();
    f.append('name', 'X');
    f.append('avatar', new File(['data'], 'a.png'));
    const result = parseFormData(f, schema);
    expect(result.name).toBe('X');
  });
});

describe('executeOrRedirect', () => {
  it('ok-no-redirect: still kein Side-Effect', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    executeOrRedirect({ ok: true }, 'test');
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('ok-with-data: still kein Side-Effect', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // ActionResult<T> erzwingt fuer { ok: true, data } ein generisches
    // T — wir casten hier explizit auf die Union-Variante.
    executeOrRedirect(
      { ok: true, data: { x: 1 } } as unknown as Parameters<
        typeof executeOrRedirect
      >[0],
      'test'
    );
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('ok-with-redirect: ruft next/navigation.redirect (das NEXT_REDIRECT wirft)', () => {
    expect(() =>
      executeOrRedirect({ ok: true, redirect: '/login' }, 'test')
    ).toThrow('NEXT_REDIRECT');
  });

  it('error: logged mit context, kein throw', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      executeOrRedirect(
        { ok: false, error: 'Speichern fehlgeschlagen.' },
        'updateLink'
      )
    ).not.toThrow();
    expect(errSpy).toHaveBeenCalledWith(
      '[updateLink]',
      'Speichern fehlgeschlagen.'
    );
  });
});
