/**
 * Filesystem-Backed Storage fuer User-uploaded OG-Bilder.
 *
 * Storage-Pfad: <DB_DIR>/og-images/. Ein Bild pro Link, Filename
 * '<linkId>-<sha1[:8]>.<ext>'. Der Hash bringt automatischen
 * Cache-Bust beim Update: alter Filename verschwindet aus der DB,
 * Datei wird geloescht; neuer Filename mit neuem Hash wird gespeichert.
 *
 * Security:
 * - Magic-Bytes-Check (nicht der Content-Type-Header) entscheidet, ob
 *   eine Datei akzeptiert wird. Damit kann kein User PHP/HTML/JS unter
 *   .jpg hochladen.
 * - Max-Size 2 MB. Wer drueber drueckt, kriegt einen Error.
 * - Filename wird vom Server gebildet, nie vom Client.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { IMAGE_FILENAME_REGEX } from './displayOg';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Magic-Bytes → erlaubte Extension. Reihenfolge ist relevant: GIF und WebP haben mehrteilige Signaturen. */
const MAGIC_BYTES: Array<{
  ext: 'jpg' | 'png' | 'webp' | 'gif';
  sig: number[];
  /** Falls Signatur nicht am Offset 0 sitzt (WebP-RIFF). */
  offset?: number;
  /** Zusatz-Check fuer WebP: muss "WEBP" an Offset 8 stehen. */
  trailer?: { offset: number; bytes: number[] };
}> = [
  { ext: 'jpg', sig: [0xff, 0xd8, 0xff] },
  { ext: 'png', sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'gif', sig: [0x47, 0x49, 0x46, 0x38] }, // GIF87a / GIF89a
  {
    ext: 'webp',
    sig: [0x52, 0x49, 0x46, 0x46], // 'RIFF'
    trailer: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // 'WEBP'
  },
];

export type ImageExt = 'jpg' | 'png' | 'webp' | 'gif';

export interface ValidateOk {
  ok: true;
  ext: ImageExt;
  contentType: string;
}
export interface ValidateFail {
  ok: false;
  error: string;
}
export type ValidateResult = ValidateOk | ValidateFail;

const CONTENT_TYPE: Record<ImageExt, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Magic-Bytes-Validation. Erkennt JPEG, PNG, WebP, GIF. */
export function validateImage(buf: Uint8Array): ValidateResult {
  if (buf.byteLength === 0) {
    return { ok: false, error: 'Datei ist leer.' };
  }
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Datei ist groesser als ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
    };
  }

  for (const m of MAGIC_BYTES) {
    const start = m.offset ?? 0;
    if (buf.byteLength < start + m.sig.length) continue;
    let match = true;
    for (let i = 0; i < m.sig.length; i++) {
      if (buf[start + i] !== m.sig[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;

    if (m.trailer) {
      if (buf.byteLength < m.trailer.offset + m.trailer.bytes.length) continue;
      let trailerMatch = true;
      for (let i = 0; i < m.trailer.bytes.length; i++) {
        if (buf[m.trailer.offset + i] !== m.trailer.bytes[i]) {
          trailerMatch = false;
          break;
        }
      }
      if (!trailerMatch) continue;
    }
    return { ok: true, ext: m.ext, contentType: CONTENT_TYPE[m.ext] };
  }

  return {
    ok: false,
    error: 'Format nicht erkannt. Erlaubt: JPEG, PNG, WebP, GIF.',
  };
}

/**
 * Liefert das Verzeichnis, in dem OG-Bilder abgelegt werden — neben der
 * SQLite-Datei. So bleibt das Storage gemeinsam mit der DB im selben
 * persistierten Sliplane-Volume.
 *
 * Env-Override: OG_IMAGE_DIR (falls jemand das Verzeichnis frei waehlen will).
 */
export function getImageDir(): string {
  if (process.env.OG_IMAGE_DIR) return process.env.OG_IMAGE_DIR;
  const dbPath =
    process.env.DB_PATH || path.join(process.cwd(), 'data', 'links.db');
  return path.join(path.dirname(dbPath), 'og-images');
}

/** sha1 der ersten 1024 Bytes — ausreichend fuer Cache-Busting. */
function shortHash(buf: Uint8Array): string {
  const slice = buf.byteLength > 1024 ? buf.subarray(0, 1024) : buf;
  return createHash('sha1').update(slice).digest('hex').slice(0, 8);
}

/**
 * Schreibt das validierte Bild ins Storage. Liefert den Filename
 * (relativ, ohne Pfad-Prefix) — das ist der Wert, der in
 * `links.custom_image_path` landet.
 *
 * Wenn `previousFilename` mitkommt UND es existiert UND ein anderer
 * Filename rauskommt, wird die alte Datei aufgeraeumt.
 */
export interface WriteImageOptions {
  linkId: string;
  buf: Uint8Array;
  previousFilename?: string | null;
  dir?: string; // override fuer Tests
}

export interface WriteImageResult {
  ok: true;
  filename: string;
  ext: ImageExt;
}

export function writeImage(opts: WriteImageOptions): WriteImageResult {
  if (!/^[A-Za-z0-9]{3,64}$/.test(opts.linkId)) {
    throw new Error('linkId enthaelt unerlaubte Zeichen.');
  }
  const validation = validateImage(opts.buf);
  if (!validation.ok) throw new Error(validation.error);

  const hash = shortHash(opts.buf);
  const filename = `${opts.linkId}-${hash}.${validation.ext}`;
  const dir = opts.dir ?? getImageDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), opts.buf);

  // Alte Datei aufraeumen, falls der Hash sich geaendert hat.
  if (
    opts.previousFilename &&
    opts.previousFilename !== filename &&
    IMAGE_FILENAME_REGEX.test(opts.previousFilename)
  ) {
    try {
      fs.unlinkSync(path.join(dir, opts.previousFilename));
    } catch {
      // Datei kann fehlen — wir aktualisieren trotzdem den DB-Eintrag.
    }
  }

  return { ok: true, filename, ext: validation.ext };
}

/** Loescht das Bild eines Links — z.B. beim Entfernen des Overrides oder beim Link-Delete. */
export function deleteImage(filename: string, dir = getImageDir()): void {
  if (!IMAGE_FILENAME_REGEX.test(filename)) return;
  try {
    fs.unlinkSync(path.join(dir, filename));
  } catch {
    // Bereits weg — ok.
  }
}

/**
 * Liest ein Bild zur Auslieferung. Gibt null zurueck, wenn das File
 * nicht existiert oder der Filename ungueltig ist (Path-Traversal-Schutz).
 */
export interface ReadImageResult {
  buf: Buffer;
  contentType: string;
  ext: ImageExt;
}

export function readImage(
  filename: string,
  dir = getImageDir()
): ReadImageResult | null {
  if (!IMAGE_FILENAME_REGEX.test(filename)) return null;
  const filePath = path.join(dir, filename);
  // Defensive: Pfad muss wirklich im erwarteten Verzeichnis liegen.
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(dir);
  if (!resolved.startsWith(resolvedDir + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  const buf = fs.readFileSync(resolved);
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() as
    | 'jpg'
    | 'jpeg'
    | 'png'
    | 'webp'
    | 'gif';
  const normalizedExt: ImageExt = ext === 'jpeg' ? 'jpg' : (ext as ImageExt);
  return { buf, contentType: CONTENT_TYPE[normalizedExt], ext: normalizedExt };
}
