import { NextRequest, NextResponse } from 'next/server';
import { eq, or, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { clicks, links, type Link } from '@/db/schema';
import { getBaseUrl } from '@/lib/baseUrl';
import { getDisplayOg } from '@/lib/displayOg';
import { extractClientIp, lookupCountry } from '@/lib/geo';
import { isExpired } from '@/lib/ttl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRAWLER_PATTERNS = [
  'Twitterbot',
  'facebookexternalhit',
  'WhatsApp',
  'Slackbot',
  'LinkedInBot',
  'TelegramBot',
  'Discordbot',
  'Googlebot',
  'bingbot',
  'Applebot',
  'Embedly',
];

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return CRAWLER_PATTERNS.some((p) =>
    userAgent.toLowerCase().includes(p.toLowerCase())
  );
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function metaTag(property: string, content: string | null): string {
  if (!content) return '';
  const attr = property.startsWith('og:')
    ? 'property'
    : 'name';
  return `<meta ${attr}="${property}" content="${escapeAttr(content)}" />`;
}

function buildHtml(link: Link, baseUrl: string): string {
  const og = getDisplayOg(link);
  // Bilder muessen fuer Social-Crawler ABSOLUT sein. Externe Scraper-
  // URLs bleiben wie sie sind; eigene Uploads (relativer Pfad) bekommen
  // den App-Origin vorangestellt.
  const absoluteImage =
    og.image && og.image.startsWith('/') ? `${baseUrl}${og.image}` : og.image;

  const title = og.title ?? link.originalUrl;
  const tags = [
    metaTag('og:title', og.title),
    metaTag('og:description', og.description),
    metaTag('og:image', absoluteImage),
    metaTag('og:url', link.originalUrl),
    metaTag('og:site_name', og.siteName),
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    metaTag('twitter:title', og.title),
    metaTag('twitter:description', og.description),
    metaTag('twitter:image', absoluteImage),
  ]
    .filter(Boolean)
    .join('\n  ');

  const safeUrlAttr = escapeAttr(link.originalUrl);
  const safeUrlJs = JSON.stringify(link.originalUrl);
  const safeTitle = escapeText(title);

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  ${tags}
  <meta http-equiv="refresh" content="0;url=${safeUrlAttr}" />
  <link rel="canonical" href="${safeUrlAttr}" />
</head>
<body>
  <p>Weiterleitung… <a href="${safeUrlAttr}">Hier klicken</a></p>
  <script>window.location.replace(${safeUrlJs});</script>
</body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // Lookup nach id ODER slug – damit /t/<random> und /t/<wunsch-slug>
  // beide funktionieren. Slug ist UNIQUE, also höchstens ein Treffer.
  const link = db
    .select()
    .from(links)
    .where(or(eq(links.id, id), eq(links.slug, id)))
    .get();

  if (!link) {
    return new NextResponse('Link nicht gefunden', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (isExpired(link.expiresAt)) {
    return new NextResponse(buildExpiredHtml(), {
      status: 410,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const userAgent = req.headers.get('user-agent');
  if (!isCrawler(userAgent)) {
    // Geo: nur Country-Code, nie die IP. extractClientIp gibt die IP
    // ausschliesslich an lookupCountry weiter; sie verlaesst den
    // Request-Scope nicht und wird nirgends geloggt.
    const countryCode = lookupCountry(extractClientIp(req.headers));

    // Aggregat-Counter (für schnelle Anzeige im Dashboard)
    db.update(links)
      .set({ clickCount: sql`${links.clickCount} + 1` })
      .where(eq(links.id, link.id))
      .run();
    // Einzelner Klick mit Timestamp + Country (für Sparkline / Verlauf / Geo)
    db.insert(clicks).values({ linkId: link.id, countryCode }).run();
  }

  const baseUrl = await getBaseUrl();
  return new NextResponse(buildHtml(link, baseUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildExpiredHtml(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Link abgelaufen – Listate</title>
  <meta name="robots" content="noindex" />
  <style>
    *,*::before,*::after { box-sizing: border-box }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fafafa; color: #1d284d; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding: 2rem }
    main { max-width: 28rem; text-align: center }
    .tile { width: 64px; height: 64px; margin: 0 auto 1.5rem; background: #9b0a00; border-radius: 14px; display: flex; align-items: center; justify-content: center }
    h1 { margin: 0 0 .75rem; font-size: 1.5rem; line-height: 1.3 }
    p { margin: 0 0 .5rem; color: #525252; line-height: 1.5 }
    a { color: #1d284d; text-decoration: underline; text-underline-offset: 2px }
    .meta { margin-top: 2rem; font-size: .8rem; color: #737373 }
  </style>
</head>
<body>
  <main>
    <div class="tile" aria-hidden="true">
      <svg width="38" height="38" viewBox="0 0 100 100">
        <rect x="14" y="26" width="46" height="10" rx="3" fill="#fff"/>
        <rect x="14" y="45" width="46" height="10" rx="3" fill="#fff"/>
        <rect x="14" y="64" width="30" height="10" rx="3" fill="#fff"/>
        <path d="M 64 32 L 74 32 L 90 50 L 74 68 L 64 68 L 80 50 Z" fill="#fff"/>
      </svg>
    </div>
    <h1>Link abgelaufen</h1>
    <p>Dieser Tracking-Link ist nicht mehr aktiv.</p>
    <p>Bitte beim Absender nach einer aktuellen Adresse fragen.</p>
    <div class="meta">via <a href="/">listate.de</a></div>
  </main>
</body>
</html>`;
}
