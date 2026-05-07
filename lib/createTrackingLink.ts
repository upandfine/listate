import { eq } from 'drizzle-orm';
import ogs from 'open-graph-scraper';
import { getDb } from '@/db';
import { blockedHosts, links } from '@/db/schema';
import { generateId } from '@/lib/generateId';
import { normalizeHost } from '@/lib/host';
import { isAdultHost } from '@/lib/adultFilter';
import { checkSafeBrowsing, describeThreats } from '@/lib/safeBrowsing';

interface OgImage {
  url?: string;
}

function pickImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0] as OgImage | string | undefined;
    if (!first) return null;
    if (typeof first === 'string') return first;
    return first.url ?? null;
  }
  if (typeof image === 'object' && 'url' in (image as OgImage)) {
    return (image as OgImage).url ?? null;
  }
  return null;
}

export class TrackingLinkError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 500
  ) {
    super(message);
    this.name = 'TrackingLinkError';
  }
}

export interface CreateTrackingLinkResult {
  id: string;
  url: string;
  expiresAt: string | null;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
  };
}

/**
 * Validiert und erstellt einen Tracking-Link inkl. OG-Fetch und Block-Check.
 * Wirft `TrackingLinkError` mit passendem Status bei vorhersehbaren Problemen.
 */
export async function createTrackingLink(params: {
  rawUrl: string;
  userId: string;
  expiresAt?: string | null;
}): Promise<CreateTrackingLinkResult> {
  const rawUrl = params.rawUrl.trim();
  if (!rawUrl || !/^https:\/\//i.test(rawUrl)) {
    throw new TrackingLinkError('Nur https-URLs sind erlaubt.', 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new TrackingLinkError('URL ist ungültig.', 400);
  }
  const url = parsed.toString();

  const host = normalizeHost(parsed.hostname);
  const blocked = getDb()
    .select()
    .from(blockedHosts)
    .where(eq(blockedHosts.host, host))
    .get();
  if (blocked) {
    throw new TrackingLinkError(
      blocked.reason
        ? `Diese Domain ist gesperrt: ${blocked.reason}`
        : 'Diese Domain ist gesperrt.',
      403
    );
  }

  // Adult-Content-Filter via Hostliste (StevenBlack/hosts porn-only).
  if (isAdultHost(host)) {
    throw new TrackingLinkError(
      'Diese Domain ist als nicht-jugendfreier Inhalt gelistet und kann nicht verlinkt werden.',
      403
    );
  }

  // Google Safe Browsing: bei aktiviertem Key wird die Ziel-URL gegen
  // Threat-Lists geprüft. Bei Treffer (Phishing, Malware o.ä.) Insert
  // verhindern. Wenn Service nicht erreichbar oder kein Key: durchlassen.
  const sb = await checkSafeBrowsing(url);
  if (!sb.safe && sb.threats) {
    throw new TrackingLinkError(
      `Diese URL wurde von Google als unsicher eingestuft (${describeThreats(
        sb.threats
      )}).`,
      403
    );
  }

  let title: string | null = null;
  let description: string | null = null;
  let image: string | null = null;
  let siteName: string | null = null;

  try {
    const { result, error } = await ogs({
      url,
      timeout: 5000,
      fetchOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ListateBot/1.0; +https://listate.de/) AppleWebKit/537.36',
        },
      },
    });
    if (!error && result) {
      title = result.ogTitle ?? result.twitterTitle ?? null;
      description =
        result.ogDescription ?? result.twitterDescription ?? null;
      image =
        pickImage(result.ogImage) ?? pickImage(result.twitterImage) ?? null;
      siteName = result.ogSiteName ?? null;
    }
  } catch {
    // OG-Scraping ist optional; Link wird trotzdem gespeichert
  }

  let id: string;
  try {
    id = generateId();
  } catch {
    throw new TrackingLinkError(
      'ID-Generierung fehlgeschlagen, bitte erneut versuchen.',
      500
    );
  }

  try {
    getDb()
      .insert(links)
      .values({
        id,
        userId: params.userId,
        originalUrl: url,
        ogTitle: title,
        ogDescription: description,
        ogImage: image,
        ogSiteName: siteName,
        expiresAt: params.expiresAt ?? null,
      })
      .run();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unbekannter DB-Fehler';
    throw new TrackingLinkError(`Speichern fehlgeschlagen: ${message}`, 500);
  }

  return {
    id,
    url,
    expiresAt: params.expiresAt ?? null,
    og: { title, description, image, siteName },
  };
}
