import { and, eq, ne, sql } from 'drizzle-orm';
import ogs from 'open-graph-scraper';
import { getDb } from '@/db';
import { blockedHosts, links } from '@/db/schema';
import { generateId } from '@/lib/generateId';
import { normalizeHost } from '@/lib/host';
import { isAdultHost } from '@/lib/adultFilter';
import { checkSafeBrowsing, describeThreats } from '@/lib/safeBrowsing';
import { normalizeSlug, validateSlug } from '@/lib/slug';
import { normalizeTags, tagsToString } from '@/lib/tags';

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
    public status: 400 | 403 | 429 | 500
  ) {
    super(message);
    this.name = 'TrackingLinkError';
  }
}

/**
 * Pro-Stunde-Limit für neue Links pro User. Schützt gegen versehentliche
 * oder böswillige Floods.
 */
export const RATE_LIMIT_PER_HOUR = 60;

export interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export interface CreateTrackingLinkResult {
  id: string;
  slug: string | null;
  url: string;
  expiresAt: string | null;
  tags: string[];
  og: OgData;
}

/**
 * Validiert die Ziel-URL gegen Schema, Block-Liste, Adult-Filter und
 * Safe Browsing. Liefert die kanonisierte URL plus den normalisierten
 * Hostnamen zurück.
 */
export async function validateTrackingUrl(
  rawUrl: string
): Promise<{ url: string; host: string }> {
  const trimmed = rawUrl.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) {
    throw new TrackingLinkError('Nur https-URLs sind erlaubt.', 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
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

  if (isAdultHost(host)) {
    throw new TrackingLinkError(
      'Diese Domain ist als nicht-jugendfreier Inhalt gelistet und kann nicht verlinkt werden.',
      403
    );
  }

  const sb = await checkSafeBrowsing(url);
  if (!sb.safe && sb.threats) {
    throw new TrackingLinkError(
      `Diese URL wurde von Google als unsicher eingestuft (${describeThreats(
        sb.threats
      )}).`,
      403
    );
  }

  return { url, host };
}

/**
 * Holt OG-Daten der Zielseite. Bei Netzwerk- oder Parse-Fehlern werden
 * leere Felder zurückgegeben – der Workflow soll dadurch nicht blockiert.
 */
export async function fetchOg(url: string): Promise<OgData> {
  const data: OgData = {
    title: null,
    description: null,
    image: null,
    siteName: null,
  };
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
      data.title = result.ogTitle ?? result.twitterTitle ?? null;
      data.description =
        result.ogDescription ?? result.twitterDescription ?? null;
      data.image =
        pickImage(result.ogImage) ?? pickImage(result.twitterImage) ?? null;
      data.siteName = result.ogSiteName ?? null;
    }
  } catch {
    // OG-Scraping ist optional; ignorieren.
  }
  return data;
}

/**
 * Prüft die User-spezifische Rate-Limit-Schranke. Wirft 429, wenn
 * überschritten.
 */
export function enforceRateLimit(userId: string) {
  const row = getDb()
    .select({ n: sql<number>`COUNT(*)` })
    .from(links)
    .where(
      and(
        eq(links.userId, userId),
        sql`${links.createdAt} > datetime('now', '-1 hour')`
      )
    )
    .get();
  const count = row?.n ?? 0;
  if (count >= RATE_LIMIT_PER_HOUR) {
    throw new TrackingLinkError(
      `Du hast in der letzten Stunde ${RATE_LIMIT_PER_HOUR} Links erstellt – das ist die aktuelle Obergrenze. Bitte etwas später erneut versuchen.`,
      429
    );
  }
}

/**
 * Slug-Eingabe normalisieren, validieren und auf Eindeutigkeit prüfen.
 * Optional kann eine `excludeLinkId` übergeben werden (für Edit-Flow,
 * damit der eigene Link nicht als „bereits vergeben" gilt).
 */
export function normalizeAndCheckSlug(
  slugInput: string | null | undefined,
  excludeLinkId?: string
): string | null {
  if (!slugInput) return null;
  const candidate = normalizeSlug(slugInput);
  if (!candidate) return null;
  const result = validateSlug(candidate);
  if (!result.ok) throw new TrackingLinkError(result.error, 400);
  const existingQuery = excludeLinkId
    ? getDb()
        .select({ id: links.id })
        .from(links)
        .where(and(eq(links.slug, candidate), ne(links.id, excludeLinkId)))
    : getDb()
        .select({ id: links.id })
        .from(links)
        .where(eq(links.slug, candidate));
  const existing = existingQuery.get();
  if (existing) {
    throw new TrackingLinkError(
      `Slug „${candidate}" ist bereits vergeben.`,
      400
    );
  }
  return candidate;
}

/**
 * Validiert und erstellt einen Tracking-Link inkl. OG-Fetch und Block-Check.
 * Wirft `TrackingLinkError` mit passendem Status bei vorhersehbaren Problemen.
 */
export async function createTrackingLink(params: {
  rawUrl: string;
  userId: string;
  expiresAt?: string | null;
  slug?: string | null;
  tags?: string | null;
}): Promise<CreateTrackingLinkResult> {
  enforceRateLimit(params.userId);

  const slug = normalizeAndCheckSlug(params.slug);
  const tags = params.tags ? normalizeTags(params.tags) : [];

  const { url } = await validateTrackingUrl(params.rawUrl);
  const og = await fetchOg(url);

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
        ogTitle: og.title,
        ogDescription: og.description,
        ogImage: og.image,
        ogSiteName: og.siteName,
        expiresAt: params.expiresAt ?? null,
        slug,
        tags: tagsToString(tags),
      })
      .run();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unbekannter DB-Fehler';
    throw new TrackingLinkError(`Speichern fehlgeschlagen: ${message}`, 500);
  }

  return {
    id,
    slug,
    url,
    expiresAt: params.expiresAt ?? null,
    tags,
    og,
  };
}
