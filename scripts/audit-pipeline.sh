#!/usr/bin/env bash
# audit-pipeline.sh — 10-second "is the pipeline wired up?" check.
# Runs where-am-i.sh + verify-env.sh + git status + .env sanity.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== where-am-i =="
bash scripts/where-am-i.sh || true
echo

echo "== SITE_ENV check =="
if grep -q "^SITE_ENV=" .env 2>/dev/null; then
  echo "  ✓ .env declares SITE_ENV"
else
  echo "  ✗ .env does NOT declare SITE_ENV"
fi
echo

echo "== git status =="
git status -sb
echo

echo "== verify-env =="
bash scripts/verify-env.sh || true
