#!/usr/bin/env bash
# where-am-i.sh — print the current env snapshot. Exits 0 always.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
# shellcheck source=lib/env.sh
source scripts/lib/env.sh
load_env

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "<no git>")
worktree_path=$(git rev-parse --show-toplevel 2>/dev/null || echo "$ROOT")

url="${SITE_URL:-<unset>}"
port="${SITE_PORT:-<unset>}"
noindex="${SITE_NOINDEX:-0}"
env="${SITE_ENV:-<unset>}"

# server-up probe (best-effort)
server="down"
if [ "$port" != "<unset>" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://127.0.0.1:${port}/" 2>/dev/null || echo 000)
  case "$code" in
    200|301|302|307|308) server="up (HTTP $code)" ;;
    401) server="up (HTTP 401, auth required — test env)" ;;
    *) server="down (HTTP $code)" ;;
  esac
fi

printf "env:      %s\n" "$env"
printf "branch:   %s\n" "$branch"
printf "worktree: %s\n" "$worktree_path"
printf "url:      %s\n" "$url"
printf "port:     %s\n" "$port"
printf "noindex:  %s\n" "$noindex"
printf "server:   %s\n" "$server"
