#!/usr/bin/env bash
# install-hooks.sh — install the version-controlled git hooks into this worktree.
# Sets core.hooksPath to .githooks so `git push` reads the hook from the repo.
# Run once per worktree after cloning.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
HOOKS_DIR="$REPO_ROOT/.githooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "✗ refusing: $HOOKS_DIR not found" >&2
  exit 1
fi

# Make all hooks executable
chmod +x "$HOOKS_DIR"/*

# Set the hooksPath in this worktree's git config
git config core.hooksPath "$HOOKS_DIR"

echo "✓ installed hooks from $HOOKS_DIR"
echo "  core.hooksPath = $(git config --get core.hooksPath)"
echo "  test: bash scripts/ship.sh --help 2>&1 | head -2"
echo "        git push  (will refuse on main/preprod)"
