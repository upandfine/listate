import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { clicks, links } from '@/db/schema';
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
          })
          .from(clicks)
          .where(inArray(clicks.linkId, linkIds))
          .all()
      : [];

  const clicksByLink = new Map<string, string[]>();
  for (const c of myClicks) {
    const arr = clicksByLink.get(c.linkId) ?? [];
    arr.push(c.clickedAt);
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
      tags: parseTags(l.tags),
      clickCount: l.clickCount,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      clicks: clicksByLink.get(l.id) ?? [],
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
