#!/usr/bin/env bash
# SQLite-Backup mit Online-Backup-API + Rotation.
#
# Verwendet `sqlite3 .backup` statt blossem `cp`, weil das den
# WAL-Modus respektiert und auch waehrend laufender Schreibvorgaenge
# einen konsistenten Snapshot liefert.
#
# Verwendung (lokal / Sliplane-Cron):
#   bash scripts/backup-db.sh
#   bash scripts/backup-db.sh /pfad/zu/links.db /pfad/zu/backups
#
# Defaults greifen auf die Production-Pfade (DB_PATH-Env oder
# /app/data/links.db).
#
# Empfohlener Cron (Sliplane-Schedule oder via host crontab):
#   0 3 * * *   bash /app/scripts/backup-db.sh
# = nightly um 03:00 UTC.

set -euo pipefail

DB="${1:-${DB_PATH:-/app/data/links.db}}"
DEST_DIR="${2:-$(dirname "$DB")/backups}"
KEEP=${BACKUP_KEEP:-14}

if [[ ! -f "$DB" ]]; then
  echo "[backup] Quelle nicht gefunden: $DB" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
TARGET="$DEST_DIR/links-${STAMP}.db"
TARGET_GZ="$TARGET.gz"

echo "[backup] $(date -u +%FT%TZ) → $TARGET_GZ"

# 1) Online-Backup via SQLite (.backup-Befehl ist atomic).
sqlite3 "$DB" ".backup '$TARGET'"

# 2) Integritaetsschecker auf der Kopie.
INTEGRITY=$(sqlite3 "$TARGET" "PRAGMA integrity_check;")
if [[ "$INTEGRITY" != "ok" ]]; then
  echo "[backup] integrity_check fehlgeschlagen: $INTEGRITY" >&2
  rm -f "$TARGET"
  exit 2
fi

# 3) Komprimieren.
gzip "$TARGET"

# 4) Rotation: aelter als KEEP Tage loeschen.
find "$DEST_DIR" -maxdepth 1 -name 'links-*.db.gz' -type f -mtime "+${KEEP}" -delete

# 5) Listing fuer den Log.
COUNT=$(find "$DEST_DIR" -maxdepth 1 -name 'links-*.db.gz' -type f | wc -l | tr -d ' ')
SIZE=$(du -h "$TARGET_GZ" | cut -f1)
echo "[backup] OK ($SIZE), $COUNT Backups insgesamt im $DEST_DIR"
