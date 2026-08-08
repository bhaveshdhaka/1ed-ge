#!/usr/bin/env bash
# sync-to-prod.sh — the safe preprod → main sync.
#
# Why this exists: the manual sync (git checkout FETCH_HEAD -- src tests .gitignore)
# has produced near-misses in this repo — a single `git checkout <branch> -- src/`
# silently drags the whole subtree including src/content/, which on this repo
# contains the preprod sandbox filler (730 day records, 161 journals, …) and
# must NEVER land on main (prod is the owner's clean-slate).
#
# This script is the guard: it computes the preprod→main diff against an
# explicit allowlist and REFUSES to proceed if anything outside that
# allowlist is in the diff. The only paths that may sync are:
#   src/   (code — with src/content/ EXCLUDED)
#   tests/
#   .gitignore
#   nginx/  (nginx vhost configs; both envs have them)
#
# MEMORY.md is intentionally excluded: prod MEMORY is the owner's authoritative
# log, preprod MEMORY has the session log + cleanups. Pass --with-memory to
# opt in to a one-time MEMORY sync (e.g., when the owner wants both envs'
# MEMORY aligned after a cleanup).
#
# Usage:
#   scripts/sync-to-prod.sh           # interactive: shows the diff, asks to confirm
#   scripts/sync-to-prod.sh -y        # non-interactive: applies the diff if guard passes
#   scripts/sync-to-prod.sh --with-memory   # also sync MEMORY.md
#   scripts/sync-to-prod.sh --dry-run  # show what would sync, apply nothing

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

ALLOWLIST_REGEX='^(src/[^c]|src/c[^o]|src/co[^n]|src/con[^t]|src/cont[^e]|src/conte[^n]|src/conten[^t]|src/content/($|.n(ext|ot-used))|tests/|\.gitignore|nginx/)'
# ^ allows src/* EXCEPT src/content/*, plus tests/, .gitignore, nginx/.
# The content/ exclusion is the guard. The src/content/( ... .n(ext|ot-used))
# branch is a safety hatch for "I really do want to sync one specific content
# file" — but in normal use, nothing under src/content/ should sync.

WITH_MEMORY=0
ASSUME_YES=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    -y|--yes)        ASSUME_YES=1 ;;
    --with-memory)   WITH_MEMORY=1 ;;
    --dry-run)       DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,28p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# 1. Fetch preprod
git fetch /root/1ed-ge-preprod preprod 2>/dev/null \
  || git fetch "$(git remote get-url origin 2>/dev/null || echo /root/1ed-ge-preprod)" preprod \
  || { echo "✗ fetch failed — set up a remote 'preprod' or pass the fetch URL." >&2; exit 1; }

# 2. Compute the diff: preprod HEAD → main HEAD (what would sync)
mapfile -t CHANGED < <(git diff --name-only main FETCH_HEAD)
if [ ${#CHANGED[@]} -eq 0 ]; then
  echo "✓ no changes to sync (preprod ≡ main)"
  exit 0
fi

# 3. Guard: classify the changed files
ALLOWED=()
BLOCKED=()
MEMORY_CHANGED=0
for f in "${CHANGED[@]}"; do
  if [ "$f" = "MEMORY.md" ]; then
    MEMORY_CHANGED=1
    [ "$WITH_MEMORY" = 1 ] && ALLOWED+=("$f")
    continue
  fi
  if [[ "$f" =~ $ALLOWLIST_REGEX ]]; then
    ALLOWED+=("$f")
  else
    BLOCKED+=("$f")
  fi
done

# 4. Report
echo "── preprod → main sync ──────────────────────────────────────────"
echo "preprod HEAD: $(git rev-parse --short FETCH_HEAD)"
echo "main HEAD:    $(git rev-parse --short main)"
echo "changed files: ${#CHANGED[@]}"
echo
echo "✓ allowed (${#ALLOWED[@]}):"
for f in "${ALLOWED[@]:-}"; do echo "    $f"; done
echo
if [ ${#BLOCKED[@]} -gt 0 ]; then
  echo "✗ BLOCKED (${#BLOCKED[@]}) — refused, outside the allowlist:"
  for f in "${BLOCKED[@]}"; do echo "    $f"; done
  echo
  echo "The allowlist is: src/* (except src/content/*), tests/, .gitignore, nginx/."
  echo "Anything else (e.g. AGENTS.md, CHANGELOG.md, scripts/, docs/) needs an explicit"
  echo "decision — edit this script's ALLOWLIST_REGEX, or pass --with-memory to include"
  echo "MEMORY.md, or sync those paths by hand and explain why."
  exit 1
fi

if [ "$MEMORY_CHANGED" = 1 ] && [ "$WITH_MEMORY" = 0 ]; then
  echo "! MEMORY.md is in the diff but --with-memory not set. Skipping MEMORY.md."
  echo "  pass --with-memory to include it (e.g., after a cleanup that should land on both envs)."
  ALLOWED=("${ALLOWED[@]/MEMORY.md/}")
fi

if [ "$DRY_RUN" = 1 ]; then
  echo
  echo "(dry-run — nothing applied)"
  exit 0
fi

# 5. Confirm
if [ "$ASSUME_YES" = 0 ]; then
  echo
  read -r -p "Apply these ${#ALLOWED[@]} files to main? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted."; exit 1; }
fi

# 6. Apply: checkout the allowed files from preprod, commit.
# MEMORY is opt-in (handled above).
git checkout FETCH_HEAD -- "${ALLOWED[@]}"
git add "${ALLOWED[@]}"
git commit -m "sync: bring preprod cleanups to main ($(printf '%d' "${#ALLOWED[@]}") files)

Code-only sync from preprod @ $(git rev-parse --short FETCH_HEAD).
Allowlist: src/* (except src/content/*), tests/, .gitignore, nginx/.
Any src/content/ changes are blocked — the sandbox filler must never
land on main (prod is the owner's clean-slate).

Run via scripts/sync-to-prod.sh; pass --with-memory to also sync
MEMORY.md, --dry-run to preview, -y to skip the confirmation prompt."

echo
echo "✓ synced. review the commit, then deploy:"
echo "    bash scripts/deploy.sh"
