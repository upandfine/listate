/**
 * Zod-Schemas fuer alle Server-Action-FormData-Inputs.
 *
 * Single-Source-of-Truth: hier sind die akzeptierten Felder, Pflicht-
 * felder und Format-Regeln definiert. Actions in app/actions.ts rufen
 * parseFormData(fd, ...Schema) auf und arbeiten mit dem typisierten
 * Ergebnis.
 *
 * Konventionen:
 * - Optionale Text-Felder werden als z.string().optional() definiert;
 *   leere Strings bleiben erhalten (Actions entscheiden, ob '' = NULL).
 * - Checkbox-Felder kommen als 'on' (gecheckt) oder fehlen (nicht
 *   gecheckt). Wir transformieren zu boolean.
 * - IDs sind alphanumerisch (generateId-Pattern) ODER UUIDs (templates).
 *   Wir akzeptieren beide locker via .string().min(1).
 */
import { z } from 'zod';

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === 'on');

// ---------------------------------------------------------------------------
// Link-Edit
// ---------------------------------------------------------------------------

export const updateLinkSchema = z.object({
  id: z.string().default('').refine((v) => v.length >= 1, 'Link-ID fehlt.'),
  url: z.string().optional().default(''),
  slug: z.string().optional().default(''),
  tags: z.string().optional().default(''),
  ttl: z.string().optional().default(''),
  ttlClear: checkbox,
});
export type UpdateLinkInput = z.output<typeof updateLinkSchema>;

export const deleteLinkSchema = z.object({
  id: z.string().default('').refine((v) => v.length >= 1, 'Link-ID fehlt.'),
});

// ---------------------------------------------------------------------------
// OG-Overrides
// ---------------------------------------------------------------------------

export const updateLinkOverridesSchema = z.object({
  id: z.string().default('').refine((v) => v.length >= 1, 'Link-ID fehlt.'),
  customTitle: z.string().max(200).optional().default(''),
  customDescription: z.string().max(500).optional().default(''),
  customSiteName: z.string().max(100).optional().default(''),
  imageHidden: checkbox,
});

export const linkIdOnlySchema = z.object({
  id: z.string().default('').refine((v) => v.length >= 1, 'Link-ID fehlt.'),
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  label: z
    .string()
    .default('')
    .refine((v) => v.length >= 1, 'Bezeichnung fehlt.')
    .refine((v) => v.length <= 100, 'Bezeichnung zu lang (max 100).'),
  url: z
    .string()
    .default('')
    .refine((v) => /^https:\/\//i.test(v), 'URL muss mit https:// beginnen.'),
  description: z.string().max(500).optional().default(''),
  urlPattern: z.string().max(500).optional().default(''),
});

export const deleteTemplateSchema = z.object({
  id: z
    .string()
    .default('')
    .refine((v) => v.length >= 1, 'Template-ID fehlt.'),
});

export const useTemplateSchema = z.object({
  templateId: z
    .string()
    .default('')
    .refine((v) => v.length >= 1, 'Template-ID fehlt.'),
});

// testTemplatePattern bekommt ein Object statt FormData, daher hier nur
// das Eingabe-Schema fuer ihn selbst:
export const testTemplatePatternSchema = z.object({
  url: z
    .string()
    .min(1, 'URL fehlt.')
    .regex(/^https:\/\//i, 'URL muss mit https:// beginnen.'),
  pattern: z.string().min(1, 'Pattern fehlt.'),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const blockHostSchema = z.object({
  host: z.string().default('').refine((v) => v.length >= 1, 'Host fehlt.'),
  reason: z.string().max(200).optional().default(''),
  alsoDelete: checkbox,
});

export const unblockHostSchema = z.object({
  host: z.string().default('').refine((v) => v.length >= 1, 'Host fehlt.'),
});
