/**
 * Unit-Tests fuer checkSafeBrowsing + describeThreats.
 * fetch wird via vi.stubGlobal gemockt, ENV via vi.stubEnv.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSafeBrowsing, describeThreats } from '@/lib/safeBrowsing';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('checkSafeBrowsing', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('liefert skipped, wenn kein API-Key gesetzt ist', async () => {
    vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', '');

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await checkSafeBrowsing('https://example.test');

    expect(result.safe).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('no API key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('liefert safe=true, wenn Google 0 Matches zurueckgibt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ matches: [] }))
    );

    const result = await checkSafeBrowsing('https://example.test');

    expect(result).toEqual({ safe: true });
  });

  it('liefert safe=true, wenn die Response keine matches-Property hat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

    const result = await checkSafeBrowsing('https://example.test');

    expect(result.safe).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it('liefert safe=false mit dedupliziertem Threat-Array bei Matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          matches: [
            { threatType: 'MALWARE' },
            { threatType: 'SOCIAL_ENGINEERING' },
            { threatType: 'MALWARE' }, // dupliziert
          ],
        })
      )
    );

    const result = await checkSafeBrowsing('https://evil.test');

    expect(result.safe).toBe(false);
    expect(result.threats).toBeDefined();
    expect(result.threats?.sort()).toEqual([
      'MALWARE',
      'SOCIAL_ENGINEERING',
    ]);
  });

  it('fail-open bei Netzwerk-Fehler (skipped, safe=true)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection refused'))
    );

    const result = await checkSafeBrowsing('https://example.test');

    expect(result.safe).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('connection refused');
  });

  it('fail-open bei nicht-2xx HTTP-Response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429 }))
    );

    const result = await checkSafeBrowsing('https://example.test');

    expect(result.safe).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('HTTP 429');
  });

  it('fail-open bei ungueltiger JSON-Response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>not json</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );

    const result = await checkSafeBrowsing('https://example.test');

    expect(result.safe).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('invalid JSON');
  });

  it('schickt den API-Key URL-encoded an den Endpoint', async () => {
    vi.stubEnv('GOOGLE_SAFE_BROWSING_API_KEY', 'key with/special&chars');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ matches: [] }));
    vi.stubGlobal('fetch', fetchSpy);

    await checkSafeBrowsing('https://example.test');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('safebrowsing.googleapis.com');
    expect(calledUrl).toContain('key%20with%2Fspecial%26chars');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.threatInfo.threatEntries).toEqual([
      { url: 'https://example.test' },
    ]);
    expect(body.threatInfo.threatTypes).toContain('MALWARE');
    expect(body.threatInfo.threatTypes).toContain('SOCIAL_ENGINEERING');
  });
});

describe('describeThreats', () => {
  it('liefert deutsche Labels fuer bekannte Threat-Types', () => {
    expect(describeThreats(['MALWARE'])).toBe('Schadsoftware');
    expect(describeThreats(['SOCIAL_ENGINEERING'])).toBe('Phishing');
    expect(describeThreats(['UNWANTED_SOFTWARE'])).toBe(
      'unerwünschte Software'
    );
    expect(describeThreats(['POTENTIALLY_HARMFUL_APPLICATION'])).toBe(
      'potenziell schädliche App'
    );
  });

  it('joint mehrere Threats kommasepariert', () => {
    expect(describeThreats(['MALWARE', 'SOCIAL_ENGINEERING'])).toBe(
      'Schadsoftware, Phishing'
    );
  });

  it('faellt bei unbekanntem Threat-Type auf den Raw-Wert zurueck', () => {
    expect(describeThreats(['UNKNOWN_FUTURE_THREAT'])).toBe(
      'UNKNOWN_FUTURE_THREAT'
    );
  });

  it('leere Liste → leerer String', () => {
    expect(describeThreats([])).toBe('');
  });
});
