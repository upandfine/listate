import { NextResponse } from 'next/server';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { links, users } from '@/db/schema';
import { getBaseUrl } from '@/lib/baseUrl';
import { getDisplayOg } from '@/lib/displayOg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'admin';
  const url = new URL(req.url);
  const userFilter = url.searchParams.get('user') || undefined;
  const showExpired = url.searchParams.get('expired') === '1';

  const ownerCondition = isAdmin
    ? userFilter
      ? eq(links.userId, userFilter)
      : sql`1 = 1`
    : eq(links.userId, session.user.id);

  const activeCondition = or(
    isNull(links.expiresAt),
    sql`${links.expiresAt} > datetime('now')`
  );

  const where = showExpired
    ? ownerCondition
    : and(ownerCondition, activeCondition);

  const rows = getDb()
    .select({
      id: links.id,
      original_url: links.originalUrl,
      og_title: links.ogTitle,
      og_description: links.ogDescription,
      og_image: links.ogImage,
      og_site_name: links.ogSiteName,
      custom_title: links.customTitle,
      custom_description: links.customDescription,
      custom_site_name: links.customSiteName,
      custom_image_path: links.customImagePath,
      image_hidden: links.imageHidden,
      click_count: links.clickCount,
      created_at: links.createdAt,
      expires_at: links.expiresAt,
      user_id: links.userId,
      owner_email: users.email,
    })
    .from(links)
    .leftJoin(users, eq(users.id, links.userId))
    .where(where)
    .orderBy(desc(links.createdAt))
    .all();

  const baseUrl = await getBaseUrl();
  return NextResponse.json(
    rows.map((l) => {
      const og = getDisplayOg({
        ogTitle: l.og_title,
        ogDescription: l.og_description,
        ogImage: l.og_image,
        ogSiteName: l.og_site_name,
        customTitle: l.custom_title,
        customDescription: l.custom_description,
        customSiteName: l.custom_site_name,
        customImagePath: l.custom_image_path,
        imageHidden: l.image_hidden,
      });
      return {
        ...l,
        tracking_url: `${baseUrl}/t/${l.id}`,
        // Display-Felder (Override-aware) zusaetzlich anbieten, damit
        // API-Konsumenten nicht selber resolven muessen.
        display_title: og.title,
        display_description: og.description,
        display_site_name: og.siteName,
        display_image: og.image
          ? og.image.startsWith('/')
            ? `${baseUrl}${og.image}`
            : og.image
          : null,
      };
    })
  );
}
