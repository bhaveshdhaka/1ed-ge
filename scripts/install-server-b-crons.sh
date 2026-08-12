#!/usr/bin/env bash
# install-server-b-crons.sh — Server B cron installer (plan C4).
#
# Installs the two production crons that keep the live /status dashboard and
# market-news feed fresh. Run as ROOT on Server B (self-hosted runner host):
#
#     scp scripts/install-server-b-crons.sh <deploy>@202.73.4.149:/tmp/
#     ssh <deploy>@202.73.4.149 'sudo bash /tmp/install-server-b-crons.sh'
#
# The scripts run as the `deploy` user (the GitHub Actions runner user) against
# the production checkout at /srv/1edge. Paths below match the deployed layout.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "✗ run as root:  sudo bash $0" >&2
  exit 1
fi

NODE_BIN="$(command -v node || echo /usr/bin/node)"

# status snapshot — refresh data/status.json every 5 min (feeds /status)
cat > /etc/cron.d/1edge-status <<'EOF'
*/5 * * * * deploy cd /srv/1edge && /usr/bin/node /srv/1edge/scripts/status-snapshot.mjs >/dev/null 2>&1 || true
EOF

# market news — refresh USD news every 8h into /srv/1edge/content/market-news
cat > /etc/cron.d/1edge-market <<'EOF'
0 */8 * * * deploy cd /srv/1edge && /usr/bin/node /srv/1edge/scripts/market-news-fetch.mjs --no-build >> /tmp/1edge-market.log 2>&1 || true
EOF

chmod 644 /etc/cron.d/1edge-status /etc/cron.d/1edge-market

echo "installed crons (node: $NODE_BIN):"
for f in status market; do
  echo "  /etc/cron.d/1edge-$f"
done
echo
echo "verify with:"
echo "  crontab -lu deploy"
echo "  ls -la /etc/cron.d/1edge-*"
echo "  cat /etc/cron.d/1edge-status /etc/cron.d/1edge-market"