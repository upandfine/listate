import { NextRequest, NextResponse } from 'next/server';
import { getDb, type LinkRow } from '@/lib/db';

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
  const attr = property.startsWith('og:') || property.startsWith('twitter:')
    ? property.startsWith('og:')
      ? 'property'
      : 'name'
    : 'name';
  return `<meta ${attr}="${property}" content="${escapeAttr(content)}" />`;
}

function buildHtml(link: LinkRow): string {
  const title = link.og_title ?? link.original_url;
  const tags = [
    metaTag('og:title', link.og_title),
    metaTag('og:description', link.og_description),
    metaTag('og:image', link.og_image),
    metaTag('og:url', link.original_url),
    metaTag('og:site_name', link.og_site_name),
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    metaTag('twitter:title', link.og_title),
    metaTag('twitter:description', link.og_description),
    metaTag('twitter:image', link.og_image),
  ]
    .filter(Boolean)
    .join('\n  ');

  const safeUrlAttr = escapeAttr(link.original_url);
  const safeUrlJs = JSON.stringify(link.original_url);
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

  const link = getDb()
    .prepare('SELECT * FROM links WHERE id = ?')
    .get(id) as LinkRow | undefined;

  if (!link) {
    return new NextResponse('Link nicht gefunden', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const userAgent = req.headers.get('user-agent');
  if (!isCrawler(userAgent)) {
    getDb()
      .prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?')
      .run(id);
  }

  return new NextResponse(buildHtml(link), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
