#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f /tmp/umconto-preview.pid ]] && kill -0 "$(cat /tmp/umconto-preview.pid)" 2>/dev/null; then
  exit 0
fi

nohup bash scripts/start_local.sh >/tmp/umconto-preview.log 2>&1 &
printf '%s\n' "$!" >/tmp/umconto-preview.pid
