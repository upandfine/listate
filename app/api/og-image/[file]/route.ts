/**
 * Auslieferung von User-uploaded OG-Bildern.
 *
 * Sicherheits-Hardening:
 * - Filename muss IMAGE_FILENAME_REGEX matchen (Single-Source-of-Truth
 *   aus lib/displayOg).
 * - lib/imageStorage.readImage prueft zusaetzlich Path-Containment
 *   im Storage-Verzeichnis (kein Path-Traversal).
 * - Content-Type wird vom Server gesetzt (Magic-Bytes-validiert beim
 *   Upload), niemals vom Client.
 *
 * Kein Auth-Check: die Filenames enthalten einen 8-Hex-Hash des Inhalts.
 * Wer eine URL nicht kennt, kann sie nicht raten. Ueber die Auslieferung
 * sind die Bilder public — das ist der Zweck eines OG-Vorschau-Bildes:
 * Social-Crawler (WhatsApp, LinkedIn) sollen sie ohne Login holen.
 */
import { NextResponse } from 'next/server';
import { readImage } from '@/lib/imageStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const result = readImage(file);
  if (!result) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  // Buffer → Blob, damit NextResponse das als BodyInit akzeptiert. Mit
  // TS 5.7+ sind TypedArrays generic typisiert, was direkte Uebergabe an
  // BodyInit failt — Blob umgeht das sauber.
  const body = new Blob([new Uint8Array(result.buf)], {
    type: result.contentType,
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      // Filename enthaelt den Content-Hash → immutable Cache, lange Lifetime.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(body.size),
    },
  });
}
