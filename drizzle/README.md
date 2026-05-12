# Drizzle-Migrationen

Versionierte Schema-Änderungen ab Mai 2026.

## Hintergrund

Das initiale Schema wird weiterhin von [`db/index.ts::bootstrap()`](../db/index.ts)
idempotent angelegt (`CREATE TABLE IF NOT EXISTS` + `ensureColumn`). Das
funktioniert seit der ersten Version und stört nicht.

Drizzle-Kit-Migrations sind **additiv für neue Schema-Änderungen**:

- Schema-Änderung in [`db/schema.ts`](../db/schema.ts) machen.
- `npm run db:generate -- --name <kurz_beschreibung>` ausführen.
- Erzeugt `0001_<...>.sql` plus Snapshot-Files in `meta/`.
- Commiten.
- Beim nächsten App-Start spielt [`getDb()`](../db/index.ts) die
  ausstehende Migration ein (über `drizzle-orm/better-sqlite3/migrator`).

## Konventionen

- Jede Migration sollte **reversible** sein, falls möglich (Tabellen-/
  Spalten-Adds sind unproblematisch; Drops/Renames brauchen extra Sorgfalt
  auf Sliplane).
- Datenmigrationen (UPDATE/INSERT auf Bestandsdaten) gehen mit, aber
  sollten idempotent geschrieben werden.
- Drizzle-Kit-`generate` produziert SQL ohne `IF NOT EXISTS`. Wer eine
  Migration schreibt, die bei einem **leeren** und einem **bestehenden**
  Schema-Snapshot funktionieren muss, ergänzt das manuell.

## Beziehung zu `bootstrap()`

| | bootstrap() | Drizzle-Migration |
|---|---|---|
| Wird ausgeführt | Bei jedem `getDb()`-Aufruf (idempotent) | Einmalig pro Migration via `__drizzle_migrations`-Tracking |
| Verantwortlich für | Initiales Schema + alte Spalten-Adds | Neue Schema-Änderungen ab heute |
| Format | TypeScript (raw SQL inline) | `.sql`-Dateien mit Drizzle-Snapshot |
| Reihenfolge | Erst | Danach |

Wenn das initiale Schema einmal komplett in Migrations gewandert ist,
kann `bootstrap()` durch einen leeren Marker ersetzt werden.
