#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "→ seeding content (idempotent)"
node scripts/seed.mjs

echo "→ building + starting container"
docker compose up -d --build

echo "→ installing nginx vhost"
sudo cp nginx/1ed.ge.conf /etc/nginx/sites-enabled/1ed.ge
sudo nginx -t && sudo systemctl reload nginx

echo "→ installing git autocommit cron (every 30 min)"
CRON_LINE="*/30 * * * * root cd ${ROOT} && git add -A && git commit -m \"chore(content): autosave \$(date +\%F-\%R)\" -q 2>/dev/null || true"
printf '%s\n' "$CRON_LINE" | sudo tee /etc/cron.d/1edge-backup > /dev/null
sudo chmod 644 /etc/cron.d/1edge-backup
sudo systemctl restart cron 2>/dev/null || true

echo ""
echo "✓ deployed — http://1ed.ge"
echo "  admin: https://1ed.ge/admin/<ADMIN_SECRET>"
echo "  remember to point 1ed.ge A @ 142.91.108.254 on Cloudflare (proxied)"
