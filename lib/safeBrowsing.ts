/**
 * Google Safe Browsing v4 — Lookup API.
 * https://developers.google.com/safe-browsing/v4/lookup-api
 *
 * Wenn kein API-Key gesetzt ist (ENV `GOOGLE_SAFE_BROWSING_API_KEY`),
 * ist die Funktion ein No-Op und liefert "safe" zurück. So bleibt die
 * App in lokaler Entwicklung und in Setups ohne Key voll funktionsfähig.
 */

const ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
] as const;

interface SafeBrowsingMatch {
  threatType: string;
  platformType?: string;
  threatEntryType?: string;
  threat?: { url: string };
}

export interface SafeBrowsingResult {
  safe: boolean;
  /** Nur gesetzt, wenn `safe === false`. */
  threats?: string[];
  /** Wenn der Service nicht erreichbar war oder API-Key fehlt. */
  skipped?: boolean;
  reason?: string;
}

/**
 * Prüft eine URL gegen Safe Browsing. Bei Netzwerkfehlern wird
 * "skipped" zurückgegeben (fail-open) – wir wollen den Tracking-Link-
 * Workflow nicht blockieren, wenn Google gerade schluckt.
 */
export async function checkSafeBrowsing(
  url: string
): Promise<SafeBrowsingResult> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    return { safe: true, skipped: true, reason: 'no API key configured' };
  }

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        client: {
          clientId: 'listate',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
  } catch (err) {
    return {
      safe: true,
      skipped: true,
      reason: `network error: ${
        err instanceof Error ? err.message : 'unknown'
      }`,
    };
  }

  if (!response.ok) {
    return {
      safe: true,
      skipped: true,
      reason: `HTTP ${response.status}`,
    };
  }

  let body: { matches?: SafeBrowsingMatch[] };
  try {
    body = (await response.json()) as { matches?: SafeBrowsingMatch[] };
  } catch {
    return { safe: true, skipped: true, reason: 'invalid JSON response' };
  }

  if (!body.matches || body.matches.length === 0) {
    return { safe: true };
  }

  const threats = Array.from(
    new Set(body.matches.map((m) => m.threatType))
  );
  return { safe: false, threats };
}

/** Mensch-lesbare Beschriftung für eine Threat-Type-Liste. */
export function describeThreats(threats: string[]): string {
  const labels: Record<string, string> = {
    MALWARE: 'Schadsoftware',
    SOCIAL_ENGINEERING: 'Phishing',
    UNWANTED_SOFTWARE: 'unerwünschte Software',
    POTENTIALLY_HARMFUL_APPLICATION: 'potenziell schädliche App',
  };
  const mapped = threats.map((t) => labels[t] ?? t);
  return mapped.join(', ');
}
