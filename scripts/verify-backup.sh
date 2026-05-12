#!/usr/bin/env bash
# Verifiziert einen Backup-Tarball: dekomprimiert, PRAGMA integrity_check,
# Tabellen- und User-Counts.
#
# Verwendung:
#   bash scripts/verify-backup.sh /pfad/zu/links-20260512-030000.db.gz

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.db.gz>" >&2
  exit 1
fi

SRC="$1"
if [[ ! -f "$SRC" ]]; then
  echo "[verify] Datei nicht gefunden: $SRC" >&2
  exit 1
fi

TMP=$(mktemp -t listate-verify.XXXXXX.db)
trap "rm -f '$TMP'" EXIT

echo "[verify] Dekomprimiere $SRC → $TMP"
gunzip -c "$SRC" > "$TMP"

echo "[verify] PRAGMA integrity_check"
INTEGRITY=$(sqlite3 "$TMP" "PRAGMA integrity_check;")
echo "  → $INTEGRITY"
if [[ "$INTEGRITY" != "ok" ]]; then
  echo "[verify] FAIL — Integritaet beschaedigt." >&2
  exit 2
fi

echo "[verify] Quick-Counts:"
sqlite3 "$TMP" <<SQL
SELECT 'user'      AS table_name, COUNT(*) AS n FROM user
UNION ALL SELECT 'links',     COUNT(*) FROM links
UNION ALL SELECT 'clicks',    COUNT(*) FROM clicks
UNION ALL SELECT 'templates', COUNT(*) FROM templates;
SQL

echo "[verify] OK"
