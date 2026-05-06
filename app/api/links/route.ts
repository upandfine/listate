import { NextResponse } from 'next/server';
import db, { type LinkRow } from '@/lib/db';
import { getBaseUrl } from '@/lib/baseUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const links = db
    .prepare('SELECT * FROM links ORDER BY created_at DESC')
    .all() as LinkRow[];

  const baseUrl = getBaseUrl();

  return NextResponse.json(
    links.map((l) => ({
      ...l,
      tracking_url: `${baseUrl}/t/${l.id}`,
    }))
  );
}
