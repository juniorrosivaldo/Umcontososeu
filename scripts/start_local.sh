#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -x .venv/bin/python || ! -d node_modules ]]; then
  printf '%s\n' 'Dependências ausentes. Execute primeiro: bash scripts/setup.sh' >&2
  exit 1
fi

mkdir -p data

cleanup() {
  trap - INT TERM EXIT
  kill "${api_pid:-}" "${web_pid:-}" 2>/dev/null || true
  wait "${api_pid:-}" "${web_pid:-}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
api_pid=$!
npm run dev -- --hostname 127.0.0.1 &
web_pid=$!

printf '%s\n' 'Painel iniciado na porta 3000. Pressione Ctrl+C para encerrar.'
wait -n "$api_pid" "$web_pid"
