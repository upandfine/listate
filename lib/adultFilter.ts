/**
 * Adult-Content-Filter via Hostliste.
 *
 * Quelle: lib/blocklists/adult-hosts.txt – aktualisierbar via
 * `./scripts/update-adult-hosts.sh`. Liste basiert auf
 * StevenBlack/hosts (porn-only Variante).
 *
 * Geprüft wird der vollständige Hostname plus alle übergeordneten
 * Eltern-Domains (z. B. wenn `videos.example.com` nicht in der Liste
 * steht, aber `example.com`, gilt der Host als Adult).
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const LIST_PATH = path.join(
  process.cwd(),
  'lib',
  'blocklists',
  'adult-hosts.txt'
);

let _hosts: Set<string> | null = null;

function load(): Set<string> {
  if (_hosts) return _hosts;
  const set = new Set<string>();
  try {
    const raw = fs.readFileSync(LIST_PATH, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Erwartetes Format: "0.0.0.0 hostname"
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      const host = parts[1].toLowerCase().replace(/^www\./, '');
      if (host && host !== '0.0.0.0' && host.includes('.')) {
        set.add(host);
      }
    }
  } catch (err) {
    logger.error(
      { module: 'adultFilter', path: LIST_PATH, err },
      'Konnte Adult-Hostliste nicht laden'
    );
  }
  _hosts = set;
  return set;
}

/**
 * Prüft, ob ein Host als Adult-Inhalt gelistet ist. Berücksichtigt auch
 * übergeordnete Domains: ist `bad.example.com` nicht in der Liste, aber
 * `example.com`, dann zählt der Host als Adult.
 *
 * @param host normalisierter Hostname (lowercase, ohne `www.`-Prefix)
 */
export function isAdultHost(host: string): boolean {
  if (!host) return false;
  const set = load();
  if (set.size === 0) return false;

  let candidate = host;
  while (true) {
    if (set.has(candidate)) return true;
    const dot = candidate.indexOf('.');
    if (dot < 0) return false;
    const parent = candidate.slice(dot + 1);
    if (!parent.includes('.')) return false;
    candidate = parent;
  }
}

/** Größe der geladenen Liste – nur für Health-/Diagnose-Zwecke. */
export function adultHostCount(): number {
  return load().size;
}
