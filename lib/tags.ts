/**
 * Tags werden als Komma-separierter String in `links.tags` gespeichert.
 * Je Tag: lowercase, getrimmt, alphanumerisch + Bindestrich, 1–32 Zeichen.
 */

const TAG_REGEX = /^[a-z0-9-]{1,32}$/;

export function parseTags(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/** Eingabe normalisieren: lowercase, dedupe, ungültige rauswerfen, max. 8 Tags. */
export function normalizeTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) continue;
    if (!TAG_REGEX.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 8) break;
  }
  return out;
}

/** Speicher-Repräsentation: kommasepariert oder null wenn leer. */
export function tagsToString(tags: string[]): string | null {
  return tags.length > 0 ? tags.join(',') : null;
}
