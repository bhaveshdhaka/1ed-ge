#!/usr/bin/env bash
# env.sh — the env-typing contract. Source this from every pipeline script.
#
# Reads the worktree's .env (gitignored) and exposes:
#   $SITE_ENV     "prod" or "test"
#   $SITE_URL     e.g. https://1ed.ge or https://test.1ed.ge
#   $SITE_PORT    e.g. 4321 (prod) or 4323 (test)
#   $SITE_NOINDEX "1" on test (noindex meta + headers), "0" on prod
#
# Use `require_env prod` (or `test`) at the top of any script that
# must run only in that env. Mismatched envs exit non-zero with a
# loud message — no silent wrong-env deploys.

set -euo pipefail

_ENV_LOADED=0

load_env() {
  if [ "$_ENV_LOADED" = 1 ]; then return 0; fi
  if [ -z "${SITE_ENV:-}" ]; then
    local env_file
    env_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.env"
    if [ -f "$env_file" ]; then
      set -a
      # shellcheck disable=SC1090
      . "$env_file"
      set +a
    fi
  fi
  # SITE_NOINDEX is derived; .env may override
  if [ -z "${SITE_NOINDEX:-}" ]; then
    case "${SITE_ENV:-}" in
      test) SITE_NOINDEX=1 ;;
      prod) SITE_NOINDEX=0 ;;
      *)    SITE_NOINDEX=0 ;;
    esac
  fi
  _ENV_LOADED=1
}

require_env() {
  local expected="$1"
  load_env
  local actual="${SITE_ENV:-<unset>}"
  local here
  here="$(pwd)"
  if [ "$actual" != "$expected" ]; then
    echo "✗ refusing: this script requires SITE_ENV=$expected" >&2
    echo "  but the worktree's .env says SITE_ENV=$actual" >&2
    echo "  worktree: $here" >&2
    echo "  fix: edit .env, or run from the $expected worktree" >&2
    exit 1
  fi
}

env_url()    { load_env; echo "${SITE_URL:-}"; }
env_port()   { load_env; echo "${SITE_PORT:-}"; }
env_noindex(){ load_env; echo "${SITE_NOINDEX:-0}"; }
