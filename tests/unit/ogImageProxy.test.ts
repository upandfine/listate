/**
 * Unit-Tests fuer lib/ogImageProxy: SSRF-Haertung + server-seitiges
 * Bild-Fetching mit injiziertem HttpClient.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_PROXY_IMAGE_BYTES,
  fetchProxiedImage,
  parseProxyableImageUrl,
} from '@/lib/ogImageProxy';
import type { HttpClient } from '@/lib/http';

describe('parseProxyableImageUrl', () => {
  it('akzeptiert oeffentliche https-URL', () => {
    const url = parseProxyableImageUrl('https://cdn.example.com/og.jpg');
    expect(url?.hostname).toBe('cdn.example.com');
  });

  it.each([
    ['http (kein TLS)', 'http://example.com/a.jpg'],
    ['Muell-String', 'not-a-url'],
    ['localhost', 'https://localhost/a.jpg'],
    ['.localhost-Suffix', 'https://foo.localhost/a.jpg'],
    ['.local mDNS', 'https://printer.local/a.jpg'],
    ['.internal', 'https://svc.internal/a.jpg'],
    ['0.0.0.0', 'https://0.0.0.0/a.jpg'],
    ['Loopback 127.x', 'https://127.0.0.1/a.jpg'],
    ['Private 10.x', 'https://10.1.2.3/a.jpg'],
    ['Private 192.168.x', 'https://192.168.0.5/a.jpg'],
    ['Cloud-Metadata 169.254.169.254', 'https://169.254.169.254/latest'],
    ['Private 172.16.x', 'https://172.16.9.9/a.jpg'],
    ['Private 172.31.x', 'https://172.31.0.1/a.jpg'],
    ['CGNAT 100.64.x', 'https://100.64.0.1/a.jpg'],
    ['IPv6-Loopback', 'https://[::1]/a.jpg'],
    ['IPv6-Literal', 'https://[2001:db8::1]/a.jpg'],
  ])('blockt %s', (_label, raw) => {
    expect(parseProxyableImageUrl(raw)).toBeNull();
  });

  it('blockt NICHT 172.15.x (ausserhalb des privaten Bereichs)', () => {
    expect(parseProxyableImageUrl('https://172.15.0.1/a.jpg')).not.toBeNull();
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function clientReturning(res: unknown): HttpClient {
  return vi.fn(async () => res as Response) as unknown as HttpClient;
}

describe('fetchProxiedImage', () => {
  const url = new URL('https://cdn.example.com/og.png');

  it('liefert Body + normalisierten Content-Type bei 200', async () => {
    const http = clientReturning(
      new Response(PNG, {
        status: 200,
        headers: { 'content-type': 'image/PNG; charset=binary' },
      })
    );
    const r = await fetchProxiedImage(url, http);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.contentType).toBe('image/png');
      expect(r.body).toEqual(PNG);
    }
  });

  it('ok=false bei Non-2xx', async () => {
    const http = clientReturning(new Response('nope', { status: 502 }));
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });

  it('ok=false bei Nicht-Bild-Content-Type', async () => {
    const http = clientReturning(
      new Response('<html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });

  it('ok=false wenn Content-Length-Header zu gross', async () => {
    const http = clientReturning(
      new Response(PNG, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(MAX_PROXY_IMAGE_BYTES + 1),
        },
      })
    );
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });

  it('ok=false bei leerem Body', async () => {
    const http = clientReturning(
      new Response(new Uint8Array(0), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    );
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });

  it('ok=false wenn Body groesser als Limit (ohne Content-Length)', async () => {
    const big = new Uint8Array(MAX_PROXY_IMAGE_BYTES + 1);
    big[0] = 0x89;
    const http = clientReturning(
      new Response(big, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })
    );
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });

  it('ok=false wenn fetch wirft (Timeout/Netz)', async () => {
    const http = vi.fn(async () => {
      throw new Error('aborted');
    }) as unknown as HttpClient;
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });

  it('ok=false wenn arrayBuffer() wirft', async () => {
    const http = clientReturning({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.reject(new Error('stream error')),
    });
    expect((await fetchProxiedImage(url, http)).ok).toBe(false);
  });
});
