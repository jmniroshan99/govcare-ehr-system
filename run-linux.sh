#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is required." >&2; exit 1; }
command -v java >/dev/null 2>&1 || { echo "Java 21 is required." >&2; exit 1; }
command -v mvn >/dev/null 2>&1 || { echo "Apache Maven 3.9+ is required." >&2; exit 1; }
[[ -f spring-api/.env ]] || cp spring-api/.env.example spring-api/.env
[[ -f .env ]] || cp .env.example .env
[[ -d node_modules ]] || npm install
npm run dev:full
