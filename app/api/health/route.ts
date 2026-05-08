import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health-Check: 200 OK wenn die App live ist und die DB antwortet,
 * 503 sonst. Bewusst minimal — keine Auth, keine Logging-Geräusche.
 *
 * Verwendung: Sliplane-Healthcheck, externe Uptime-Monitore.
 */
export async function GET() {
  const start = Date.now();
  try {
    const result = getDb().get(sql`SELECT 1 AS ok`) as
      | { ok: number }
      | undefined;
    if (!result || result.ok !== 1) {
      return NextResponse.json(
        { status: 'error', reason: 'db ping returned unexpected result' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        status: 'ok',
        db: 'ok',
        latencyMs: Date.now() - start,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        reason: err instanceof Error ? err.message : 'unknown',
      },
      { status: 503 }
    );
  }
}
