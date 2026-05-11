/**
 * Resolved-OG-Layer: vereint Scraper-Werte (og_*) mit User-Overrides
 * (custom_*) zu der Repraesentation, die in Vorschauen + Listen
 * angezeigt wird.
 *
 * Regel:
 * - Text-Felder: custom > og  (NULL-Override = nutze og)
 * - Bild: bei `image_hidden = 1` -> null. Sonst custom_image > og_image.
 * - Wenn `customImagePath` gesetzt ist, wird ein relativer App-Pfad
 *   `/api/og-image/<filename>` zurueckgegeben. Der Aufrufer muss das
 *   ggf. mit der Basis-URL absolutieren (fuer OG-Meta-Tags im
 *   Crawler-HTML).
 */

export interface OgInput {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
  customTitle: string | null;
  customDescription: string | null;
  customSiteName: string | null;
  customImagePath: string | null;
  imageHidden: number;
}

export interface ResolvedOg {
  title: string | null;
  description: string | null;
  siteName: string | null;
  /**
   * Entweder absolute Externe-URL (vom Scraper) oder relativer App-Pfad
   * "/api/og-image/<filename>" (User-Upload). `null`, wenn image_hidden
   * gesetzt oder weder Scraper- noch Override-Bild vorhanden ist.
   */
  image: string | null;
}

/**
 * Sicheres Filename-Pattern fuer hochgeladene OG-Bilder:
 *  <linkId 6 Zeichen alphanumerisch>-<sha1 8 hex Zeichen>.<ext>
 * Beispiel: 'AbCdEf-1a2b3c4d.jpg'
 *
 * Diese Pruefung wird sowohl in writeImage als auch in der
 * Auslieferungs-Route verwendet — Path-Traversal ist damit ausgeschlossen.
 */
export const IMAGE_FILENAME_REGEX =
  /^[A-Za-z0-9]{3,64}-[a-f0-9]{8}\.(jpe?g|png|webp|gif)$/i;

export function isValidImageFilename(name: string): boolean {
  return IMAGE_FILENAME_REGEX.test(name);
}

export function getDisplayOg(link: OgInput): ResolvedOg {
  return {
    title: link.customTitle ?? link.ogTitle,
    description: link.customDescription ?? link.ogDescription,
    siteName: link.customSiteName ?? link.ogSiteName,
    image: resolveImage(link),
  };
}

function resolveImage(link: OgInput): string | null {
  if (link.imageHidden === 1) return null;
  if (link.customImagePath) {
    if (!isValidImageFilename(link.customImagePath)) {
      // Defensive: ein manipulierter DB-Eintrag soll nichts auslieferbares
      // ergeben. Im Produktionspfad wird der Wert nur vom Server geschrieben.
      return null;
    }
    return `/api/og-image/${link.customImagePath}`;
  }
  return link.ogImage;
}
