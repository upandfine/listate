/**
 * Unit-Tests fuer resolveTemplateUrl.
 * fetch wird global gemockt — alle Tests laufen ohne Netz.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTemplateUrl } from '@/lib/resolveTemplateUrl';

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveTemplateUrl — Pattern-Validierung', () => {
  it('lehnt ungueltigen Regex ab, ohne fetch aufzurufen', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await resolveTemplateUrl(
      'https://example.test',
      '[unclosed'
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Pattern ist kein gültiger Regex');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('resolveTemplateUrl — Fetch-Fehler', () => {
  it('fail bei Netzwerk-Exception', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('DNS fail'))
    );

    const result = await resolveTemplateUrl(
      'https://example.test',
      '/foo'
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('DNS fail');
    expect(result.candidates).toEqual([]);
  });

  it('fail bei non-2xx HTTP-Response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }))
    );

    const result = await resolveTemplateUrl(
      'https://example.test',
      '/foo'
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Quellseite antwortete mit HTTP 404.');
  });
});

describe('resolveTemplateUrl — URL-Extraktion', () => {
  it('findet absolute URL, die zum Pattern passt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse(`
          <a href="https://other.test/x">x</a>
          <a href="https://bibel.test/woche-19">heute</a>
          <a href="https://bibel.test/woche-18">gestern</a>
        `)
      )
    );

    const result = await resolveTemplateUrl(
      'https://bibel.test/uebersicht',
      'bibel\\.test/woche-19'
    );

    expect(result.ok).toBe(true);
    expect(result.resolved).toBe('https://bibel.test/woche-19');
  });

  it('absolutisiert relative URLs gegen die Quell-URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse(`
          <a href="/artikel/2026-05-08">heute</a>
          <a href="../andere">andere</a>
        `)
      )
    );

    const result = await resolveTemplateUrl(
      'https://bibel.test/uebersicht/',
      '/artikel/2026-05-08'
    );

    expect(result.ok).toBe(true);
    expect(result.resolved).toBe('https://bibel.test/artikel/2026-05-08');
  });

  it('dedupliziert in Reihenfolge: erste Position gewinnt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse(`
          <a href="https://example.test/a">erste</a>
          <a href="https://example.test/b">zweite</a>
          <a href="https://example.test/a">duplikat</a>
        `)
      )
    );

    const result = await resolveTemplateUrl(
      'https://example.test',
      'example\\.test'
    );

    expect(result.ok).toBe(true);
    expect(result.resolved).toBe('https://example.test/a');
  });

  it('akzeptiert Single- UND Double-Quote-href-Werte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse(`
          <a href='https://example.test/single'>s</a>
          <a href="https://example.test/double">d</a>
        `)
      )
    );

    const single = await resolveTemplateUrl(
      'https://example.test',
      '/single'
    );
    expect(single.resolved).toBe('https://example.test/single');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse(`<a href="https://example.test/double">d</a>`)
      )
    );

    const double = await resolveTemplateUrl(
      'https://example.test',
      '/double'
    );
    expect(double.resolved).toBe('https://example.test/double');
  });

  it('ueberspringt Anker-Links (#) und javascript:', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        htmlResponse(`
          <a href="#top">anker</a>
          <a href="javascript:alert(1)">js</a>
          <a href="https://example.test/real">echt</a>
        `)
      )
    );

    const result = await resolveTemplateUrl(
      'https://example.test',
      'example\\.test'
    );

    expect(result.ok).toBe(true);
    expect(result.resolved).toBe('https://example.test/real');
    expect(result.candidates).not.toContain('#top');
  });
});

describe('resolveTemplateUrl — kein Treffer', () => {
  it('liefert ok=false plus die ersten 10 Kandidaten zur Fehlersuche', async () => {
    const links = Array.from(
      { length: 20 },
      (_, i) => `<a href="https://example.test/${i}">l</a>`
    ).join('\n');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse(links)));

    const result = await resolveTemplateUrl(
      'https://example.test',
      'nichts-was-matcht'
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Kein Link');
    expect(result.candidates).toHaveLength(10);
    expect(result.candidates[0]).toBe('https://example.test/0');
    expect(result.candidates[9]).toBe('https://example.test/9');
  });
});
