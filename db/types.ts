/**
 * Geteilte Drizzle-Projektionen + Domain-Types fuer Query-Returns.
 *
 * Statt in jeder Page erneut die Spaltenliste fuer den Dashboard- bzw.
 * Detail-View zu wiederholen, gibt es hier ein einziges
 * `linkListProjection`. Der Row-Typ `LinkListRow` ist 1:1 das, was
 * `db.select(linkListProjection).from(links).leftJoin(users, ...).all()`
 * zurueckliefert.
 *
 * Hintergrund: D.3 (TypeScript-Hygiene) aus BACKLOG.md.
 */
import { links, users, type Link } from './schema';

/**
 * Drizzle-Select-Projektion: alle Spalten eines Links plus
 * `ownerEmail` aus dem Join auf `users`. Mit dem Spread-Operator
 * koennen Aufrufer zusaetzliche Felder ergaenzen (z.B. `ownerName`).
 *
 *   db.select({ ...linkListProjection, ownerName: users.name })
 *     .from(links).leftJoin(users, eq(users.id, links.userId))
 */
export const linkListProjection = {
  id: links.id,
  slug: links.slug,
  originalUrl: links.originalUrl,
  ogTitle: links.ogTitle,
  ogDescription: links.ogDescription,
  ogImage: links.ogImage,
  ogSiteName: links.ogSiteName,
  customTitle: links.customTitle,
  customDescription: links.customDescription,
  customSiteName: links.customSiteName,
  customImagePath: links.customImagePath,
  imageHidden: links.imageHidden,
  clickCount: links.clickCount,
  createdAt: links.createdAt,
  expiresAt: links.expiresAt,
  tags: links.tags,
  userId: links.userId,
  ownerEmail: users.email,
} as const;

/** Row-Typ zur `linkListProjection`. */
export type LinkListRow = Link & { ownerEmail: string | null };

/** Variante mit zusaetzlichem ownerName (Dashboard-Admin-Ansicht). */
export type LinkListRowWithOwnerName = LinkListRow & {
  ownerName: string | null;
};
