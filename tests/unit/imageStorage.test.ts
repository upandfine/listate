import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteImage,
  getImageDir,
  MAX_IMAGE_BYTES,
  readImage,
  validateImage,
  writeImage,
} from '@/lib/imageStorage';

// Magic-Bytes-Konstanten fuer Test-Buffer.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
// WebP: 'RIFF' + 4 Bytes Length + 'WEBP'
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // length (irrelevant)
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x4c, // VP8L (irrelevant)
]);

describe('validateImage', () => {
  it('akzeptiert JPEG', () => {
    const res = validateImage(JPEG);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ext).toBe('jpg');
      expect(res.contentType).toBe('image/jpeg');
    }
  });

  it('akzeptiert PNG', () => {
    const res = validateImage(PNG);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe('png');
  });

  it('akzeptiert GIF', () => {
    const res = validateImage(GIF);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe('gif');
  });

  it('akzeptiert WebP (RIFF + WEBP-Trailer)', () => {
    const res = validateImage(WEBP);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe('webp');
  });

  it('lehnt leere Eingabe ab', () => {
    const res = validateImage(new Uint8Array(0));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('leer');
  });

  it('lehnt Eingabe ueber Max-Size ab', () => {
    const buf = new Uint8Array(MAX_IMAGE_BYTES + 1);
    // JPEG-Header reinsetzen, damit der Magic-Check nicht vorher feuert.
    buf.set(JPEG);
    const res = validateImage(buf);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('groesser');
  });

  it('lehnt unbekanntes Format ab (Text)', () => {
    const buf = new TextEncoder().encode('<!DOCTYPE html>hello');
    const res = validateImage(buf);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Format');
  });

  it('lehnt RIFF ohne WEBP-Trailer ab (defensiver Spezialfall)', () => {
    const fakeWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // 'WAVE' statt 'WEBP'
    ]);
    const res = validateImage(fakeWebp);
    expect(res.ok).toBe(false);
  });
});

describe('writeImage / deleteImage / readImage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'listate-img-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('schreibt JPEG, liefert Filename <linkId>-<8hex>.jpg', () => {
    const res = writeImage({ linkId: 'AbCdEf', buf: JPEG, dir: tmpDir });
    expect(res.filename).toMatch(/^AbCdEf-[a-f0-9]{8}\.jpg$/);
    expect(res.ext).toBe('jpg');

    expect(fs.existsSync(path.join(tmpDir, res.filename))).toBe(true);
  });

  it('legt das Zielverzeichnis bei Bedarf an', () => {
    const nested = path.join(tmpDir, 'sub', 'sub2');
    expect(fs.existsSync(nested)).toBe(false);

    writeImage({ linkId: 'XyZ123', buf: PNG, dir: nested });

    expect(fs.existsSync(nested)).toBe(true);
  });

  it('raeumt die alte Datei auf, wenn ein neuer Hash entsteht', () => {
    const first = writeImage({
      linkId: 'AbCdEf',
      buf: JPEG,
      dir: tmpDir,
    });
    // Anderes Bild → anderer Hash → anderer Filename
    const second = writeImage({
      linkId: 'AbCdEf',
      buf: PNG,
      dir: tmpDir,
      previousFilename: first.filename,
    });

    expect(second.filename).not.toBe(first.filename);
    expect(fs.existsSync(path.join(tmpDir, first.filename))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, second.filename))).toBe(true);
  });

  it('crasht NICHT, wenn previousFilename nicht existiert', () => {
    expect(() =>
      writeImage({
        linkId: 'AbCdEf',
        buf: JPEG,
        dir: tmpDir,
        previousFilename: 'AbCdEf-deadbeef.png', // existiert nie
      })
    ).not.toThrow();
  });

  it('lehnt ungueltige linkId ab', () => {
    expect(() =>
      writeImage({ linkId: '../etc/passwd', buf: JPEG, dir: tmpDir })
    ).toThrow(/linkId/);
  });

  it('lehnt unbekanntes Format ab', () => {
    const garbage = new TextEncoder().encode('<html>');
    expect(() =>
      writeImage({ linkId: 'AbCdEf', buf: garbage, dir: tmpDir })
    ).toThrow();
  });

  it('deleteImage entfernt die Datei', () => {
    const { filename } = writeImage({
      linkId: 'AbCdEf',
      buf: JPEG,
      dir: tmpDir,
    });
    expect(fs.existsSync(path.join(tmpDir, filename))).toBe(true);

    deleteImage(filename, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, filename))).toBe(false);
  });

  it('deleteImage ignoriert ungueltige Filenamen (kein Crash)', () => {
    expect(() => deleteImage('../etc/passwd', tmpDir)).not.toThrow();
    expect(() => deleteImage('whatever.exe', tmpDir)).not.toThrow();
  });

  it('deleteImage crasht NICHT bei fehlender Datei', () => {
    expect(() =>
      deleteImage('AbCdEf-deadbeef.png', tmpDir)
    ).not.toThrow();
  });

  it('readImage liefert Buffer + Content-Type', () => {
    const { filename } = writeImage({
      linkId: 'AbCdEf',
      buf: JPEG,
      dir: tmpDir,
    });
    const out = readImage(filename, tmpDir);
    expect(out).not.toBeNull();
    expect(out!.contentType).toBe('image/jpeg');
    expect(out!.buf.byteLength).toBe(JPEG.byteLength);
  });

  it('readImage gibt null bei ungueltigem Filename (Path-Traversal-Schutz)', () => {
    expect(readImage('../etc/passwd', tmpDir)).toBeNull();
    expect(readImage('/absolute', tmpDir)).toBeNull();
  });

  it('readImage gibt null bei fehlender Datei', () => {
    expect(readImage('AbCdEf-deadbeef.jpg', tmpDir)).toBeNull();
  });

  it('readImage normalisiert .jpeg → ext=jpg, contentType=image/jpeg', () => {
    // Wir schreiben das Bild manuell mit .jpeg-Endung, um den Branch
    // zu testen. validateImage liefert nie 'jpeg', nur 'jpg'; aber
    // legacy-Dateien koennten mit .jpeg auf der Platte liegen.
    const filename = 'AbCdEf-12345678.jpeg';
    fs.writeFileSync(path.join(tmpDir, filename), JPEG);

    const out = readImage(filename, tmpDir);
    expect(out).not.toBeNull();
    expect(out!.ext).toBe('jpg');
    expect(out!.contentType).toBe('image/jpeg');
  });
});

describe('getImageDir', () => {
  const ENV_BACKUP = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_BACKUP };
  });

  it('respektiert OG_IMAGE_DIR-Env', () => {
    process.env.OG_IMAGE_DIR = '/custom/path';
    expect(getImageDir()).toBe('/custom/path');
  });

  it('faellt zurueck auf <DB_DIR>/og-images', () => {
    delete process.env.OG_IMAGE_DIR;
    process.env.DB_PATH = '/var/data/links.db';
    expect(getImageDir()).toBe('/var/data/og-images');
  });

  it('Default cwd/data/og-images, wenn weder ENV gesetzt ist', () => {
    delete process.env.OG_IMAGE_DIR;
    delete process.env.DB_PATH;
    const result = getImageDir();
    expect(result.endsWith(path.join('data', 'og-images'))).toBe(true);
  });
});
