#!/bin/bash
set -euo pipefail

CANDIDATES=(
  "$HOME/Library/Logs/Normies/main.log"
  "$HOME/Library/Logs/Normies Dev/main.log"
  "$HOME/.normies/logs/main.log"
)

LOG_FILE=""
for path in "${CANDIDATES[@]}"; do
  if [ -f "$path" ]; then
    LOG_FILE="$path"
    break
  fi
done

if [ -z "$LOG_FILE" ]; then
  LOG_FILE="${CANDIDATES[0]}"
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"
fi

echo "Tailing: $LOG_FILE"
tail -F "$LOG_FILE"

