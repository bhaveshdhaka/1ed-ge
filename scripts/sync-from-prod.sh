#!/usr/bin/env bash
# sync-from-prod.sh — main → preprod sync.
#
# The opposite of sync-to-prod.sh. Pulls main's code into the preprod
# worktree, preserving the preprod-only files:
#   .env
#   nginx/test.1ed.ge.conf
#   scripts/seed-review.mjs (the date tweak)
#
# No allowlist — preprod is a superset of prod (it has prod code plus
# its own filler content). The sync is additive.
#
# Usage:
#   bash scripts/sync-from-prod.sh           # fetch + merge (fails on conflict)
#   bash scripts/sync-from-prod.sh --dry-run # show what would merge, do nothing
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=lib/env.sh
source scripts/lib/env.sh
require_env test

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$branch" != "preprod" ]; then
  echo "✗ refusing: this script must run on the preprod branch (got: ${branch:-<no git>})" >&2
  exit 1
fi

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Preprod-only files: preserve across the merge. .env is gitignored (never in
# the merge), but listed for the report. The tracked files are stashed.
PREPROD_ONLY_TRACKED=(
  "nginx/test.1ed.ge.conf"
  "scripts/seed-review.mjs"
)
PREPROD_ONLY_ALL=(
  ".env"
  "nginx/test.1ed.ge.conf"
  "scripts/seed-review.mjs"
)

# Find a worktree-local reference for main. /root/1ed.ge is the prod worktree
# (the .git/worktrees/* pointer in preprod confirms it shares the repo).
PROD_WORKTREE="/root/1ed.ge"
if [ ! -d "$PROD_WORKTREE/.git" ] && [ ! -f "$PROD_WORKTREE/.git" ]; then
  echo "✗ refusing: prod worktree not found at $PROD_WORKTREE" >&2
  echo "  this script syncs from the prod worktree path; pass the correct path." >&2
  exit 1
fi

echo "── main → preprod sync ──────────────────────────────────────────"
echo "preprod HEAD: $(git rev-parse --short HEAD)"
echo "main HEAD:    $(cd "$PROD_WORKTREE" && git rev-parse --short main)"
echo

# 1. Stash preprod-only files so the merge doesn't conflict
echo "→ stashing preprod-only files (tracked):"
for f in "${PREPROD_ONLY_TRACKED[@]}"; do echo "    $f"; done
echo "  (.env is gitignored — never in the merge)"
git stash push -m "preprod-only: $(date -u +%FT%TZ)" -- "${PREPROD_ONLY_TRACKED[@]}"

# 2. Fetch main from the prod worktree
echo "→ fetching main from $PROD_WORKTREE"
git fetch "$PROD_WORKTREE" main

# 3. Compute the diff for the report
mapfile -t CHANGED < <(git diff --name-only HEAD FETCH_HEAD)
if [ ${#CHANGED[@]} -eq 0 ]; then
  echo "✓ no changes to sync (preprod ≡ main)"
  git stash pop >/dev/null 2>&1 || true
  exit 0
fi
echo "→ incoming: ${#CHANGED[@]} files"
for f in "${CHANGED[@]:-}"; do echo "    $f"; done
echo

if [ "$DRY_RUN" = 1 ]; then
  echo "(dry-run — nothing applied)"
  git stash pop >/dev/null 2>&1 || true
  exit 0
fi

# 4. Merge
echo "→ merging main into preprod"
if ! git merge --no-ff -m "sync: bring main to preprod ($(printf '%d' "${#CHANGED[@]}") files)" FETCH_HEAD; then
  echo
  echo "✗ merge conflict — aborting" >&2
  git merge --abort || true
  git stash pop >/dev/null || true
  exit 1
fi

# 5. Restore preprod-only files. If the pop conflicts (e.g. main also
# touched scripts/seed-review.mjs), prefer the preprod version.
if ! git stash pop >/dev/null 2>&1; then
  echo "! stash pop conflicted on a preprod-only file — using preprod's version"
  for f in "${PREPROD_ONLY_TRACKED[@]}"; do
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git checkout --theirs -- "$f" 2>/dev/null || true
      git add "$f" 2>/dev/null || true
    fi
  done
  git stash drop >/dev/null || true
fi

echo
echo "✓ synced. review, then run:"
echo "    bash scripts/deploy-test.sh                          # to restart the preprod"
