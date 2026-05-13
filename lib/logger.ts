/**
 * Strukturiertes Logging via pino.
 *
 * - Production / Dev: JSON-Output auf stdout. Sliplane/Caddy parsen das
 *   und machen es durchsuchbar.
 * - Test (NODE_ENV=test): `enabled: false` — Logs werden nicht emittiert.
 *   Tests koennen via `vi.spyOn(logger, 'error')` weiterhin Aufrufe
 *   assertieren.
 *
 * Verwendung in Server-Code:
 *
 *   import { logger } from '@/lib/logger';
 *   logger.error({ context: 'updateLink', userId, err }, 'Action failed');
 *
 * Trace-ID-Pattern: bei einer logischen Operation (Server-Action,
 * API-Route) am Anfang `const traceId = newTraceId()` aufrufen und in
 * allen weiteren Log-Calls als Feld mitgeben. Macht die Korrelation
 * mehrerer Log-Zeilen aus demselben Request lesbar.
 */
import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  enabled: !isTest,
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  // pid + hostname sind im Container-Deploy redundant.
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      '*.password',
      '*.token',
      '*.authorization',
      '*.cookie',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Kurze Trace-ID fuer eine einzelne Request-/Action-Invocation.
 * 8 Hex-Zeichen aus crypto.randomUUID — lang genug zum Auseinanderhalten
 * der gleichzeitigen Requests, kurz genug fuer lesbare Log-Zeilen.
 */
export function newTraceId(): string {
  return crypto.randomUUID().slice(0, 8);
}
