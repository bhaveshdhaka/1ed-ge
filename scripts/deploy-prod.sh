#!/usr/bin/env bash
# deploy-prod.sh — deploy the prod site (1ed.ge).
# Requires SITE_ENV=prod + branch=main. Refuses otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
# shellcheck source=lib/env.sh
source scripts/lib/env.sh
require_env prod

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$branch" != "main" ]; then
  echo "✗ refusing: this deploy must run on the main branch (got: ${branch:-<no git>})" >&2
  exit 1
fi

echo "→ fetching USD market news (red/orange, no build)"
node scripts/market-news-fetch.mjs --no-build || echo "  warn: market fetch failed — deploy continues"

echo "→ building + starting container"
docker compose up -d --build

echo "→ installing prod nginx vhost"
sudo cp nginx/1ed.ge.conf /etc/nginx/sites-enabled/1ed.ge
sudo nginx -t && sudo systemctl reload nginx

echo "→ installing market-news fetch cron (every 8h) — prod only"
MARKET_CRON="0 */8 * * * root docker exec 1edge-site sh -c 'cd /app && node scripts/market-news-fetch.mjs' >> /tmp/1edge-market.log 2>&1 || true"
printf '%s\n' "$MARKET_CRON" | sudo tee /etc/cron.d/1edge-market > /dev/null
sudo chmod 644 /etc/cron.d/1edge-market

sudo systemctl restart cron 2>/dev/null || true

echo
echo "→ verifying live"
bash scripts/verify-env.sh prod

echo
echo "✓ deployed prod — $SITE_URL"
