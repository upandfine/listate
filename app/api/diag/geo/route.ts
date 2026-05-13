/**
 * TEMPORAERER Diagnose-Endpunkt fuer Feature B (Geo-Tracking).
 *
 * Wird nach dem Onboarding-Smoke wieder entfernt. Admin-only. Gibt
 * sichtbar zurueck, welche Forwarding-Header Sliplane setzt und was
 * unser extractClientIp/lookupCountry daraus macht — damit wir
 * fundiert entscheiden koennen, ob `cf-connecting-ip`, `forwarded`
 * o.ae. ergaenzt werden muss.
 *
 * Persistiert NICHTS und loggt NICHTS.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { extractClientIp, lookupCountry } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_FORWARDING_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'fly-client-ip',
  'forwarded',
  'x-forwarded-host',
  'x-forwarded-proto',
] as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const headerSnapshot: Record<string, string | null> = {};
  for (const h of KNOWN_FORWARDING_HEADERS) {
    headerSnapshot[h] = req.headers.get(h);
  }

  const allHeaderNames = Array.from(req.headers.keys()).sort();

  const extractedIp = extractClientIp(req.headers);
  const country = lookupCountry(extractedIp);

  return NextResponse.json(
    {
      knownForwardingHeaders: headerSnapshot,
      allHeaderNames,
      extractClientIpResult: extractedIp,
      lookupCountryResult: country,
      note: 'Diagnose-Endpunkt — wird nach Verifikation entfernt.',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
