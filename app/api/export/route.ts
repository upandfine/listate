import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { clicks, links } from '@/db/schema';
import { checkRateLimit, READ_LIMITS } from '@/lib/rateLimit';
import { parseTags } from '@/lib/tags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Datenexport für den eingeloggten User – DSGVO Art. 20.
 * Liefert ein JSON-Dokument mit allen eigenen Links + Klick-Historie.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  // Rate-Limit: 10 Exports/h pro User. Export ist teurer (komplette DB-
  // Sicht des Users + Click-Historie), daher engerer Wert als bei /links.
  const rate = checkRateLimit({
    key: `export:${session.user.id}`,
    ...READ_LIMITS.EXPORT,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Export-Anfragen. Bitte in einem Moment erneut probieren.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfter) },
      }
    );
  }

  const db = getDb();

  const myLinks = db
    .select()
    .from(links)
    .where(eq(links.userId, session.user.id))
    .orderBy(desc(links.createdAt))
    .all();

  const linkIds = myLinks.map((l) => l.id);
  const myClicks =
    linkIds.length > 0
      ? db
          .select({
            linkId: clicks.linkId,
            clickedAt: clicks.clickedAt,
            countryCode: clicks.countryCode,
          })
          .from(clicks)
          .where(inArray(clicks.linkId, linkIds))
          .all()
      : [];

  const clicksByLink = new Map<
    string,
    { clickedAt: string; country: string | null }[]
  >();
  for (const c of myClicks) {
    const arr = clicksByLink.get(c.linkId) ?? [];
    arr.push({ clickedAt: c.clickedAt, country: c.countryCode });
    clicksByLink.set(c.linkId, arr);
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    },
    links: myLinks.map((l) => ({
      id: l.id,
      slug: l.slug,
      originalUrl: l.originalUrl,
      ogTitle: l.ogTitle,
      ogDescription: l.ogDescription,
      ogImage: l.ogImage,
      ogSiteName: l.ogSiteName,
      customTitle: l.customTitle,
      customDescription: l.customDescription,
      customSiteName: l.customSiteName,
      customImagePath: l.customImagePath,
      imageHidden: l.imageHidden === 1,
      tags: parseTags(l.tags),
      clickCount: l.clickCount,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      clicks: clicksByLink.get(l.id) ?? [],
      // Hinweis: country wird aus der IP abgeleitet (geoip-lite). Die IP
      // selbst wird nirgends persistiert oder geloggt.
    })),
  };

  const filename = `listate-export-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
