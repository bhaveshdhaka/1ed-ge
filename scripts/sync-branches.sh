#!/usr/bin/env bash
# sync-branches.sh — auto-sync main → preprod after every deploy.
# Run from the prod worktree (main branch).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

PREPROD="/root/1ed-ge-preprod"
if [ ! -d "$PREPROD" ]; then
  echo "warn: preprod worktree not found at $PREPROD"
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$branch" != "main" ]; then
  echo "warn: not on main branch, skipping sync"
  exit 0
fi

echo "→ syncing main → preprod"
cd "$PREPROD"

# Stash any preprod-only changes
STASHED=0
if ! git diff --quiet 2>/dev/null; then
  git stash --include-untracked -q
  STASHED=1
fi

# Fetch and merge main
if git fetch "$ROOT" main 2>/dev/null && git merge FETCH_HEAD --no-edit 2>/dev/null; then
  echo "  preprod synced to main ($(git log -1 --format='%h %s' | head -c 50))"
else
  echo "  warn: merge had conflicts — resolving with main's version"
  git checkout --theirs . 2>/dev/null || true
  git add -A 2>/dev/null || true
  git commit --no-edit -m "sync: merge main into preprod (conflicts resolved: accept main)" 2>/dev/null || true
fi

# Restore stash
if [ "$STASHED" -eq 1 ]; then
  git stash pop -q 2>/dev/null || true
fi

echo "✓ preprod synced"
