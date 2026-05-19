/**
 * Proxy-Auslieferung externer OG-Vorschau-Bilder (Backlog D7).
 *
 * Keyed by linkId statt by URL: kein beliebiger ?url=-Parameter →
 * keine offene SSRF-Flaeche. Die og_image-URL wird aus der DB gelesen
 * und in lib/ogImageProxy zusaetzlich gegen interne Hosts gehaertet.
 *
 * Kein Auth-Check: OG-Bilder sind per Definition public (Social-
 * Crawler holen sie ohne Login). Der Proxy verhindert lediglich, dass
 * der Browser des Owners den Fremd-Host direkt kontaktiert.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { links } from '@/db/schema';
import { fetchProxiedImage, parseProxyableImageUrl } from '@/lib/ogImageProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LINK_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;

function notFound(): NextResponse {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!LINK_ID_RE.test(id)) return notFound();

  const db = getDb();
  const row = db
    .select({ ogImage: links.ogImage })
    .from(links)
    .where(eq(links.id, id))
    .get();

  if (!row?.ogImage) return notFound();

  const url = parseProxyableImageUrl(row.ogImage);
  if (!url) return notFound();

  const result = await fetchProxiedImage(url);
  if (!result.ok) return notFound();

  // Uint8Array → frischer ArrayBuffer-backed Blob (TS 5.7+ BodyInit, vgl.
  // app/api/og-image/[file]/route.ts).
  const body = new Blob([new Uint8Array(result.body)], {
    type: result.contentType,
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      // Keyed by linkId (aenderbar bei URL-Wechsel) → nicht immutable.
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Length': String(body.size),
    },
  });
}
