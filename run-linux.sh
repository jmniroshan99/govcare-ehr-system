#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 LTS or 24 is required." >&2
  exit 1
fi

[[ -d node_modules ]] || npm install
[[ -d server/node_modules ]] || npm --prefix server install
npm run dev:full
