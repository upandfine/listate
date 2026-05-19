import type { OgInput } from '@/lib/displayOg';

/**
 * Eingabe-Shape fuer PreviewOverrideButton und die Toolbar-Komponenten.
 * = OG-Override-Felder (siehe lib/displayOg) plus die Link-ID.
 *
 * Vorher inline in PreviewOverrideButton sowie als 9-Feld-Objektliteral
 * in dashboard/page.tsx und links/[id]/page.tsx dupliziert.
 */
export interface LinkPreviewInput extends OgInput {
  id: string;
}

/** Pickt aus einer Link-Zeile genau die fuer die Vorschau noetigen Felder. */
export function toLinkPreviewInput(
  row: OgInput & { id: string }
): LinkPreviewInput {
  return {
    id: row.id,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImage: row.ogImage,
    ogSiteName: row.ogSiteName,
    customTitle: row.customTitle,
    customDescription: row.customDescription,
    customSiteName: row.customSiteName,
    customImagePath: row.customImagePath,
    imageHidden: row.imageHidden,
  };
}
