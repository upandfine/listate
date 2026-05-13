/**
 * Append-only Audit-Log fuer destruktive und Admin-Aktionen.
 * Schreibt in die `audit_log`-Tabelle und ist bewusst defensiv:
 * wenn der Insert scheitert, geht die App nicht kaputt — wir loggen
 * den Error nur und arbeiten weiter.
 *
 * Schema: db/schema.ts::auditLog.
 *
 * Action-Namespaces:
 *   - link.*       (delete, override-update, …)
 *   - host.*       (blocked, unblocked)
 *   - template.*   (created, deleted, applied)
 *   - account.*    (deleted)
 */
import { getDb } from '@/db';
import { auditLog } from '@/db/schema';
import { logger } from './logger';

export type AuditAction =
  | 'link.deleted'
  | 'link.bulk_deleted'
  | 'host.blocked'
  | 'host.unblocked'
  | 'template.created'
  | 'template.deleted'
  | 'template.applied'
  | 'account.deleted';

export interface AuditEvent {
  /** Who triggered it. Null fuer System-Actions. */
  userId: string | null;
  action: AuditAction;
  /** Was war das Ziel (Link-ID, Host, Template-ID, …)? */
  targetId?: string | null;
  /** Beliebige Kontext-Felder; werden als JSON-Text serialisiert. */
  metadata?: Record<string, unknown>;
}

/**
 * Logged ein Audit-Event. Defensiv: bei DB-Fehler wird nur strukturiert
 * geloggt, der Aufrufer wird nicht gestoert.
 */
export function logAuditEvent(event: AuditEvent): void {
  try {
    getDb()
      .insert(auditLog)
      .values({
        userId: event.userId,
        action: event.action,
        targetId: event.targetId ?? null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      })
      .run();
  } catch (err) {
    logger.error(
      { module: 'auditLog', auditAction: event.action, err },
      'Audit-Log-Insert fehlgeschlagen'
    );
  }
}
