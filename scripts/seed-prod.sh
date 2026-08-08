#!/usr/bin/env bash
# seed-prod.sh — informational refusal. Never runs anything.
set -euo pipefail
cat <<EOF
✗ seed-prod is not a thing.

  scripts/seed.mjs writes the default 4 accounts + 6 habits + Day Zero journal.
  It is meant for the test env (where it's idempotent) and for the owner's
  prod bootstrap (where you run it ONCE, then live in zen).

  If you really mean it (initial bootstrap only), run:
    SITE_ENV=test node scripts/seed.mjs
EOF
exit 1
