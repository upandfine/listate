#!/usr/bin/env bash
#
# Aktualisiert lib/blocklists/adult-hosts.txt aus StevenBlack/hosts
# (porn-only Variante). Periodisch ausführen, danach committen.
#
# Quelle:
#   https://github.com/StevenBlack/hosts/tree/master/alternates/porn-only

set -euo pipefail

SOURCE="https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts"
TARGET="lib/blocklists/adult-hosts.txt"

cd "$(dirname "$0")/.."

echo "Lade $SOURCE …"
curl -sL --fail --max-time 60 -A "Mozilla/5.0" "$SOURCE" -o "$TARGET.tmp"

NEW_HOSTS=$(grep -c "^0\\.0\\.0\\.0 " "$TARGET.tmp" || true)
if [ "$NEW_HOSTS" -lt 1000 ]; then
  echo "Verdächtig wenig Einträge ($NEW_HOSTS), Update abgebrochen." >&2
  rm -f "$TARGET.tmp"
  exit 1
fi

mv "$TARGET.tmp" "$TARGET"

OLD_HOSTS=$(git show "HEAD:$TARGET" 2>/dev/null | grep -c "^0\\.0\\.0\\.0 " || echo 0)
DIFF=$((NEW_HOSTS - OLD_HOSTS))

echo "Fertig: $NEW_HOSTS Einträge (Δ $DIFF gegenüber HEAD)."
echo "Bitte prüfen mit: git diff $TARGET | head"
echo "Dann: git add $TARGET && git commit -m \"Update adult-hosts.txt (\$NEW_HOSTS Einträge)\""
