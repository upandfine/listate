import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { links, type Link } from '@/db/schema';

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

function buildHtml(link: Link): string {
  const title = link.ogTitle ?? link.originalUrl;
  const tags = [
    metaTag('og:title', link.ogTitle),
    metaTag('og:description', link.ogDescription),
    metaTag('og:image', link.ogImage),
    metaTag('og:url', link.originalUrl),
    metaTag('og:site_name', link.ogSiteName),
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    metaTag('twitter:title', link.ogTitle),
    metaTag('twitter:description', link.ogDescription),
    metaTag('twitter:image', link.ogImage),
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
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const db = getDb();

  const link = db.select().from(links).where(eq(links.id, id)).get();

  if (!link) {
    return new NextResponse('Link nicht gefunden', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const userAgent = req.headers.get('user-agent');
  if (!isCrawler(userAgent)) {
    db.update(links)
      .set({ clickCount: sql`${links.clickCount} + 1` })
      .where(eq(links.id, id))
      .run();
  }

  return new NextResponse(buildHtml(link), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
