import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createTrackingLink,
  TrackingLinkError,
} from '@/lib/createTrackingLink';
import { getBaseUrl } from '@/lib/baseUrl';
import { ttlToExpiresAt } from '@/lib/ttl';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Nicht angemeldet' },
      { status: 401 }
    );
  }

  let body: { url?: unknown; ttl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Ungültiger Request-Body' },
      { status: 400 }
    );
  }

  const rawUrl = typeof body.url === 'string' ? body.url : '';
  const expiresAt = ttlToExpiresAt(body.ttl);

  try {
    const created = await createTrackingLink({
      rawUrl,
      userId: session.user.id,
      expiresAt,
    });

    return NextResponse.json({
      trackingUrl: `${getBaseUrl()}/t/${created.id}`,
      id: created.id,
      expiresAt: created.expiresAt,
      og: {
        title: created.og.title,
        description: created.og.description,
        image: created.og.image,
        siteName: created.og.siteName,
      },
    });
  } catch (err) {
    if (err instanceof TrackingLinkError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/create] unexpected error:', err);
    return NextResponse.json(
      { error: 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
