#!/bin/zsh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Bughouse tournament app..."
echo "Opening http://localhost:8080 ..."

if command -v open >/dev/null 2>&1; then
  open "http://localhost:8080"
fi

npx serve "$APP_DIR" -l 8080 --no-clipboard
