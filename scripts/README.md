# Betriebs-Skripte

## `backup-db.sh` — SQLite-Backup

Nightly-Backup der Produktiv-DB via SQLite-Online-Backup-API. Atomar
(funktioniert auch während Schreibvorgängen), validiert per
`PRAGMA integrity_check`, komprimiert per gzip, rotiert nach 14 Tagen.

```bash
# Lokal testen
bash scripts/backup-db.sh data/links.db /tmp/backups

# Production-Default (DB_PATH-env oder /app/data/links.db)
bash scripts/backup-db.sh
```

**Sliplane-Cron-Setup:**

Im Sliplane-Dashboard unter „Scheduled Tasks" einen neuen Task anlegen:

| Feld | Wert |
|---|---|
| Schedule | `0 3 * * *` (täglich 03:00 UTC) |
| Command | `bash /app/scripts/backup-db.sh` |
| Working Dir | `/app` |

Backups landen in `/app/data/backups/links-<timestamp>.db.gz` (gleiches
Volume wie die Live-DB — Sliplane-Snapshots erfassen sie automatisch
mit). Wer das auf ein externes Storage rotieren will, kann
`BACKUP_KEEP=2` setzen und in einer zweiten Schedule-Task per `scp` /
`rclone` extern abladen.

**Restore (manuell):**

```bash
# Container stoppen (Sliplane-UI).
gunzip < /app/data/backups/links-20260512-030000.db.gz > /app/data/links.db
# Container wieder starten.
```

## `verify-backup.sh` — Restore-Smoke-Test

Prüft ein Backup auf Verwendbarkeit, ohne die Live-DB zu berühren:
dekomprimiert in `/tmp/`, läuft `PRAGMA integrity_check`, listet
Quick-Counts pro Tabelle.

```bash
bash scripts/verify-backup.sh /app/data/backups/links-20260512-030000.db.gz
```

Empfohlen als zweiter Sliplane-Cron-Job (z. B. 03:15 UTC, nimmt den
jüngsten Backup-File). So wird mindestens einmal pro Tag verifiziert,
dass die Backups wirklich wiederherstellbar sind — der häufigste
„unsere Backups gehen nicht"-Fall.

## `update-adult-hosts.sh`

Aktualisiert `lib/blocklists/adult-hosts.txt` aus dem StevenBlack/hosts
Repo (porn-only-Variante). Manuell nach Bedarf laufen lassen.
