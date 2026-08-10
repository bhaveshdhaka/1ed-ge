#!/usr/bin/env bash
# deploy-test.sh — deploy the preprod sandbox (test.1ed.ge).
# Requires SITE_ENV=test + branch=preprod. Refuses otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
# shellcheck source=lib/env.sh
source scripts/lib/env.sh
require_env test

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$branch" != "preprod" ]; then
  echo "✗ refusing: this deploy must run on the preprod branch (got: ${branch:-<no git>})" >&2
  exit 1
fi

echo "→ fetching USD market news (red/orange, no build)"
node scripts/market-news-fetch.mjs --no-build || echo "  warn: market fetch failed — deploy continues"

echo "→ building"
echo "→ ensuring data dir exists"
mkdir -p "$ROOT/data"
npm run build

echo "→ starting node server on port $SITE_PORT (kill any stale process first)"
if [ -f /tmp/preprod.pid ]; then
  OLDPID=$(cat /tmp/preprod.pid)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    echo "  killing stale pid $OLDPID"
    kill "$OLDPID" 2>/dev/null || true
    sleep 1
  fi
  rm -f /tmp/preprod.pid
fi

set -a
# shellcheck disable=SC1090
. "$ROOT/.env"
set +a

PORT="$SITE_PORT" HOST=127.0.0.1 setsid node "$ROOT/dist/server/entry.mjs" < /dev/null > /tmp/preprod.log 2>&1 &
disown
echo $! > /tmp/preprod.pid
sleep 2

echo "→ installing test nginx vhost"
sudo cp "$ROOT/nginx/test.1ed.ge.conf" /etc/nginx/sites-enabled/test.1ed.ge
sudo nginx -t && sudo systemctl reload nginx

# Auto-seed intentionally disabled (2026-08-09, owner-confirmed clean-slate request).
# The default 4 accounts + 6 habits + Day Zero journal would re-appear on every
# test deploy and conflict with the schema/data-structure changes in the new
# day-surface rebuild. `scripts/seed.mjs` is unchanged and can be run manually
# (`SITE_ENV=test node scripts/seed.mjs`) for a one-shot bootstrap if needed.
echo "→ skipping auto-seed (clean-slate) — set SITE_ENV=test and run scripts/seed.mjs manually to bootstrap"

echo
echo "→ verifying live"
bash scripts/verify-env.sh test

echo
echo "✓ deployed test — $SITE_URL  (auth: see /etc/nginx/.htpasswd-test)"
