/**
 * Integration-Tests fuer /api/og-image/[file].
 * Liefert Bilder aus dem OG_IMAGE_DIR aus, mit Magic-Bytes-validem Filename
 * und Path-Traversal-Schutz.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let imgDir: string;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

import { GET } from '@/app/api/og-image/[file]/route';

beforeEach(() => {
  imgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'listate-ogimg-'));
  vi.stubEnv('OG_IMAGE_DIR', imgDir);
});

afterEach(() => {
  fs.rmSync(imgDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function callGet(file: string) {
  return GET(new Request(`https://listate.test/api/og-image/${file}`), {
    params: Promise.resolve({ file }),
  });
}

describe('GET /api/og-image/[file]', () => {
  it('200 mit korrektem Content-Type + immutable Cache, wenn File existiert', async () => {
    const filename = 'lnk001-12345678.jpg';
    fs.writeFileSync(path.join(imgDir, filename), JPEG);

    const res = await callGet(filename);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable'
    );
    expect(res.headers.get('content-length')).toBe(String(JPEG.byteLength));

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf).toEqual(JPEG);
  });

  it('404 bei fehlendem File', async () => {
    const res = await callGet('lnk001-deadbeef.jpg');
    expect(res.status).toBe(404);
  });

  it('404 bei ungueltigem Filename (Path-Traversal-Schutz, kein File-Lookup)', async () => {
    const res = await callGet('..%2Fetc%2Fpasswd');
    expect(res.status).toBe(404);
  });

  it('404 bei nicht-erlaubter Extension (.exe)', async () => {
    const filename = 'lnk001-12345678.exe';
    fs.writeFileSync(path.join(imgDir, filename), JPEG);

    const res = await callGet(filename);
    expect(res.status).toBe(404);
  });

  it('liefert auch grosse Bilder (~500 KB) korrekt aus', async () => {
    const filename = 'lnk999-aaaaaaaa.png';
    // Valides PNG-Header + 500 KB Null-Bytes
    const png = new Uint8Array(500_000);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fs.writeFileSync(path.join(imgDir, filename), png);

    const res = await callGet(filename);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-length')).toBe('500000');
  });
});
