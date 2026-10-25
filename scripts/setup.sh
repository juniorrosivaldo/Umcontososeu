#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --cache "${NPM_CONFIG_CACHE:-/tmp/umconto-npm-cache}" --no-audit --no-fund
python3 -m venv .venv
.venv/bin/python -m pip install --cache-dir "${PIP_CACHE_DIR:-/tmp/umconto-pip-cache}" --require-hashes -r backend/requirements.txt
mkdir -p data
.venv/bin/python -c 'from backend.app.db import initialize; initialize()'
printf '%s\n' 'Dependências e banco preparados. Consulte README.md para iniciar os serviços.'
