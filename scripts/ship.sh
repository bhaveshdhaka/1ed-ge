#!/usr/bin/env bash
# ship.sh — the single entry point for shipping changes between envs.
#
# Usage:
#   bash scripts/ship.sh preprod-to-main   # preprod → prod: sync + deploy + verify
#   bash scripts/ship.sh main-to-preprod   # prod → preprod: sync + deploy + verify
#   bash scripts/ship.sh prod-only         # main → prod: deploy + verify (no preprod step)
#   bash scripts/ship.sh test-only         # preprod → preprod: deploy + verify
#
# Why this exists: the four-step pipeline (sync + deploy + verify + remember
# which env) is hard to remember as a sequence. This script IS the sequence.
# The pre-push git hook also routes pushes through this script — there's no
# path to a remote that bypasses it.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=lib/env.sh
source scripts/lib/env.sh
load_env

cmd="${1:-}"
if [ -z "$cmd" ] || [ "$cmd" = "--help" ] || [ "$cmd" = "-h" ]; then
  cat <<'EOF'
ship.sh — the single entry point for shipping changes between envs.

usage:
  bash scripts/ship.sh preprod-to-main   preprod → prod: sync + deploy + verify
  bash scripts/ship.sh main-to-preprod   prod → preprod: sync + deploy + verify
  bash scripts/ship.sh prod-only         main → prod: deploy + verify (code-only)
  bash scripts/ship.sh test-only         preprod → preprod: deploy + verify

the pre-push git hook also routes pushes through this script — there is
no path to a remote that bypasses it.
EOF
  exit 0
fi

case "$cmd" in
  preprod-to-main)
    # Must run from the preprod worktree (sync-to-prod.sh guards that)
    echo "═══ shipping preprod → main ═══"
    bash scripts/sync-to-prod.sh -y
    echo
    echo "═══ syncing main into prod worktree, then deploying ═══"
    cd /root/1ed.ge
    git pull /root/1ed-ge-preprod main --no-rebase
    bash scripts/deploy-prod.sh
    ;;

  main-to-preprod)
    # Must run from the preprod worktree (sync-from-prod.sh guards that)
    echo "═══ shipping main → preprod ═══"
    bash scripts/sync-from-prod.sh
    echo
    echo "═══ deploying preprod ═══"
    bash scripts/deploy-test.sh
    ;;

  prod-only)
    # Must run from the prod worktree
    if [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" != "main" ]; then
      echo "✗ refusing: prod-only must run from the main branch (got: $(git rev-parse --abbrev-ref HEAD 2>/dev/null))" >&2
      exit 1
    fi
    echo "═══ deploying prod (code-only change, no preprod step) ═══"
    bash scripts/deploy-prod.sh
    ;;

  test-only)
    # Must run from the preprod worktree
    if [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" != "preprod" ]; then
      echo "✗ refusing: test-only must run from the preprod branch (got: $(git rev-parse --abbrev-ref HEAD 2>/dev/null))" >&2
      exit 1
    fi
    echo "═══ deploying preprod (test-only refresh) ═══"
    bash scripts/deploy-test.sh
    ;;

  *)
    echo "✗ unknown command: $cmd" >&2
    echo "  valid: preprod-to-main | main-to-preprod | prod-only | test-only" >&2
    exit 2
    ;;
esac
