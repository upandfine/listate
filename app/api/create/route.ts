import { NextRequest, NextResponse } from 'next/server';
import ogs from 'open-graph-scraper';
import db from '@/lib/db';
import { generateId } from '@/lib/generateId';
import { getBaseUrl } from '@/lib/baseUrl';

export const runtime = 'nodejs';

interface OgImage {
  url?: string;
}

function pickImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0] as OgImage | string | undefined;
    if (!first) return null;
    if (typeof first === 'string') return first;
    return first.url ?? null;
  }
  if (typeof image === 'object' && 'url' in (image as OgImage)) {
    return (image as OgImage).url ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json(
      { error: 'URL muss mit http:// oder https:// beginnen' },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'URL ist ungültig' }, { status: 400 });
  }
  const url = parsed.toString();

  let title: string | null = null;
  let description: string | null = null;
  let image: string | null = null;
  let siteName: string | null = null;

  try {
    const { result, error } = await ogs({
      url,
      timeout: 5000,
      fetchOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LinkTrackerBot/1.0; +https://github.com/) AppleWebKit/537.36',
        },
      },
    });
    if (!error && result) {
      title = result.ogTitle ?? result.twitterTitle ?? null;
      description =
        result.ogDescription ?? result.twitterDescription ?? null;
      image =
        pickImage(result.ogImage) ??
        pickImage(result.twitterImage) ??
        null;
      siteName = result.ogSiteName ?? null;
    }
  } catch {
    // OG-Scraping ist optional; Link wird trotzdem gespeichert
  }

  let id: string;
  try {
    id = generateId();
  } catch {
    return NextResponse.json(
      { error: 'ID-Generierung fehlgeschlagen, bitte erneut versuchen' },
      { status: 500 }
    );
  }

  db.prepare(
    `INSERT INTO links (id, original_url, og_title, og_description, og_image, og_site_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, url, title, description, image, siteName);

  const baseUrl = getBaseUrl();
  return NextResponse.json({
    trackingUrl: `${baseUrl}/t/${id}`,
    id,
    og: { title, description, image, siteName },
  });
}
