/**
 * HttpClient-Abstraktion fuer Dependency-Inversion in fetch-basierten
 * Helpern (safeBrowsing, resolveTemplateUrl, fetchOg).
 *
 * Default ist `globalThis.fetch`. Tests injizieren eine Mock-Funktion
 * statt `vi.stubGlobal('fetch', ...)` — saubereres Setup, kein
 * Global-State-Mocking noetig.
 *
 * Konvention: Funktionen, die fetch nutzen, akzeptieren `client?: HttpClient`
 * als optionalen letzten Parameter. Im Default-Code-Pfad bleibt alles
 * wie vorher.
 */
export type HttpClient = typeof globalThis.fetch;

/**
 * Default-Client fuer Production. Wird als Fallback verwendet, wenn
 * kein Client uebergeben wurde.
 */
export const defaultHttpClient: HttpClient = (...args) =>
  globalThis.fetch(...args);
