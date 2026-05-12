/**
 * Einheitliches Result-Pattern fuer alle Server-Actions.
 *
 * Bisheriger Stand (vor D3): Actions haben gemischt {ok,error}-Result
 * zurueckgegeben, Errors geworfen, oder redirect()-aufgerufen. Aufrufer
 * mussten je nach Funktion verschieden behandeln; Auth-Fehler wurden
 * vom Generic-Catch zu „Speichern fehlgeschlagen" entwertet.
 *
 * Neu (D3): Alle Actions liefern ActionResult zurueck. Redirect-Actions
 * geben { ok: true, redirect: '/path' } zurueck und der Aufrufer (Form-
 * Action im Frontend ODER ein redirect()-Aufruf am Ende des Wrappers)
 * triggert das redirect.
 *
 * Validation: Zod-Schemas fuer alle FormData-Inputs, Helper extrahiert
 * unten in parseInput.
 */
import { z } from 'zod';
import { TrackingLinkError } from './createTrackingLink';

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: true; redirect: string }
  | { ok: false; error: string };

/** Konstruktor-Helper fuer den Erfolgs-Pfad ohne Daten. */
export function actionOk(): { ok: true } {
  return { ok: true };
}

/** Konstruktor-Helper fuer den Erfolgs-Pfad mit Daten. */
export function actionOkData<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

/** Konstruktor-Helper fuer den Redirect-Pfad. */
export function actionRedirect(path: string): { ok: true; redirect: string } {
  return { ok: true, redirect: path };
}

/** Konstruktor-Helper fuer den Fehler-Pfad. */
export function actionFail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Wandelt einen geworfenen Fehler in ein ActionResult-Failure um.
 * Bekannte Fehler-Klassen werden mit ihrer Message uebernommen,
 * unbekannte werden geloggt und in eine generische Message verpackt
 * (damit keine internen Details nach aussen lecken).
 *
 * @param context kurzer Identifier fuer den Server-Log
 */
export function toActionFail(
  err: unknown,
  context: string
): { ok: false; error: string } {
  if (err instanceof TrackingLinkError) return actionFail(err.message);
  if (err instanceof AuthError) return actionFail(err.message);
  if (err instanceof PermissionError) return actionFail(err.message);
  if (err instanceof ValidationError) return actionFail(err.message);
  if (err instanceof Error) {
    console.error(`[${context}] unexpected error:`, err);
    return actionFail('Unbekannter Fehler.');
  }
  console.error(`[${context}] unexpected non-Error throw:`, err);
  return actionFail('Unbekannter Fehler.');
}

// ---------------------------------------------------------------------------
// Typisierte Fehler-Klassen fuer den ActionResult-Mapper.
// Sie alle erweitern Error, sodass auch sie via instanceof erkennbar sind
// UND ihre `message` 1:1 als User-Message verwendet wird.
// ---------------------------------------------------------------------------

/** 401 — kein User in der Session. */
export class AuthError extends Error {
  constructor(message = 'Nicht angemeldet.') {
    super(message);
    this.name = 'AuthError';
  }
}

/** 403 — User da, aber Berechtigung fehlt (z.B. Owner/Admin). */
export class PermissionError extends Error {
  constructor(message = 'Keine Berechtigung.') {
    super(message);
    this.name = 'PermissionError';
  }
}

/** 400 — Eingabe ungueltig, Validation-Fehler. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---------------------------------------------------------------------------
// FormData → typisiertes Object via Zod
// ---------------------------------------------------------------------------

/**
 * Wandelt FormData in ein plain Object (alle Werte als string) und
 * validiert es gegen das uebergebene Zod-Schema.
 *
 * - Mehrfach-Felder: nimmt nur den ersten Wert (FormData-API). Das ist
 *   fuer unsere Forms ausreichend; bei Bedarf koennen wir auf
 *   `formData.getAll()` umstellen.
 * - File-Felder werden NICHT umgewandelt — die werden separat geholt
 *   (siehe uploadLinkImage).
 *
 * Wirft ValidationError mit menschlicher Fehlermessage bei Schema-Verstoss.
 */
export function parseFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T
): z.output<T> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    // File-Felder uebersrpringen — wer ein File will, holt es direkt
    // ueber formData.get(name).
    if (typeof v !== 'string') continue;
    obj[k] = v;
  }
  const result = schema.safeParse(obj);
  if (!result.success) {
    // Custom-Messages aus actionSchemas.ts enthalten ohnehin schon den
    // Field-Kontext ("Link-ID fehlt."), daher kein Path-Prefix.
    const first = result.error.issues[0];
    throw new ValidationError(first.message);
  }
  return result.data;
}
