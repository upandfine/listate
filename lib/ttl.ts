/**
 * Erlaubte TTL-Presets als Strings: 2d, 5d, 7d, 2w, 4w, 1m, 3m.
 * Aufgerufen mit '' / null / unbekanntem Wert → null (= kein Ablauf).
 */
export const TTL_PRESETS = ['2d', '5d', '7d', '2w', '4w', '1m', '3m'] as const;
export type TtlPreset = (typeof TTL_PRESETS)[number];

export const TTL_LABELS: Record<TtlPreset, string> = {
  '2d': '2 Tage',
  '5d': '5 Tage',
  '7d': '7 Tage',
  '2w': '2 Wochen',
  '4w': '4 Wochen',
  '1m': '1 Monat',
  '3m': '3 Monate',
};

/**
 * Liefert das berechnete Ablauf-Datum als SQLite-konformen UTC-Timestamp
 * ('YYYY-MM-DD HH:MM:SS') oder null, falls kein gültiger Preset übergeben wurde.
 */
export function ttlToExpiresAt(ttl: unknown, now: Date = new Date()): string | null {
  if (typeof ttl !== 'string') return null;
  const normalized = ttl.trim().toLowerCase();
  if (!normalized || !(TTL_PRESETS as readonly string[]).includes(normalized)) {
    return null;
  }

  const match = normalized.match(/^(\d+)([dwm])$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2];

  const date = new Date(now.getTime());
  switch (unit) {
    case 'd':
      date.setUTCDate(date.getUTCDate() + num);
      break;
    case 'w':
      date.setUTCDate(date.getUTCDate() + num * 7);
      break;
    case 'm':
      date.setUTCMonth(date.getUTCMonth() + num);
      break;
  }

  // Format passend zu SQLite datetime('now'): 'YYYY-MM-DD HH:MM:SS' in UTC.
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Prüft, ob ein in der DB gespeicherter `expires_at`-Wert bereits abgelaufen ist.
 * SQLite-Format wird als UTC interpretiert (kein Zeitzonen-Suffix nötig).
 */
export function isExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt + 'Z');
  return exp.getTime() <= now.getTime();
}
