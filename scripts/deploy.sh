#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# content bootstrap (seed.mjs) is done — the site starts as a clean slate;
# never auto-seed placeholder content over real trader data.

echo "→ fetching USD market news (red/orange, no build)"
node scripts/market-news-fetch.mjs --no-build || echo "  warn: market fetch failed — deploy continues"

echo "→ building + starting container"
docker compose up -d --build

echo "→ installing nginx vhost"
sudo cp nginx/1ed.ge.conf /etc/nginx/sites-enabled/1ed.ge
sudo nginx -t && sudo systemctl reload nginx

echo "→ installing git autocommit cron (every 30 min)"
CRON_LINE="*/30 * * * * root cd ${ROOT} && git add -A && git commit -m \"chore(content): autosave \$(date +\%F-\%R)\" -q 2>/dev/null || true"
printf '%s\n' "$CRON_LINE" | sudo tee /etc/cron.d/1edge-backup > /dev/null
sudo chmod 644 /etc/cron.d/1edge-backup

echo "→ installing market-news fetch cron (every 8h: fetch + rebuild inside the container)"
MARKET_CRON="0 */8 * * * root docker exec 1edge-site sh -c 'cd /app && node scripts/market-news-fetch.mjs' >> /tmp/1edge-market.log 2>&1 || true"
printf '%s\n' "$MARKET_CRON" | sudo tee /etc/cron.d/1edge-market > /dev/null
sudo chmod 644 /etc/cron.d/1edge-market

sudo systemctl restart cron 2>/dev/null || true

echo ""
echo "✓ deployed — http://1ed.ge"
echo "  zen: https://1ed.ge/zen/<ADMIN_SECRET>"
echo "  remember to point 1ed.ge A @ 142.91.108.254 on Cloudflare (proxied)"
