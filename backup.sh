#!/usr/bin/env bash
# ============================================================
#  Local backup -- Architect's AI Quest
#  Creates a timestamped .tar.gz of this folder in:
#    ~/Documents/architect-ai-quest-backups/
#
#  USE:
#    chmod +x backup.sh   (first time only)
#    ./backup.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TS=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR="$HOME/Documents/architect-ai-quest-backups"
mkdir -p "$BACKUP_DIR"

ARCHIVE="$BACKUP_DIR/architect-ai-quest_${TS}.tar.gz"

echo
echo "=== Creating backup ==="
echo " Source: $SCRIPT_DIR"
echo " Target: $ARCHIVE"
echo

PARENT_DIR="$(dirname "$SCRIPT_DIR")"
FOLDER_NAME="$(basename "$SCRIPT_DIR")"

tar --exclude="${FOLDER_NAME}/node_modules" \
    --exclude="${FOLDER_NAME}/.tools" \
    --exclude="${FOLDER_NAME}/.cache" \
    -czf "$ARCHIVE" \
    -C "$PARENT_DIR" \
    "$FOLDER_NAME"

if [ -f "$ARCHIVE" ]; then
  SIZE=$(du -h "$ARCHIVE" | cut -f1)
  echo
  echo " DONE! Backup saved (${SIZE})."
  echo " Location: $ARCHIVE"
  echo
  echo " TIP: keep the last 5-10 backups, delete older ones to save space."
else
  echo
  echo " ERROR: backup failed."
  exit 1
fi
