#!/usr/bin/env bash
# design-lint.sh — scan .astro files for arbitrary Tailwind values.
# Logs violations to data/design-violations.json.
# Run on every deploy (called from post-deploy.mjs).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/data/design-violations.json"
TMP="$OUT.tmp"

# Read existing violations
EXISTING='[]'
if [ -f "$OUT" ]; then
  EXISTING=$(cat "$OUT")
fi

# Scan for arbitrary Tailwind values
NEW='[]'
SCAN=$(grep -rnE 'text-\[|bg-\[|border-\[' src/pages/ src/components/ --include='*.astro' 2>/dev/null | grep -v node_modules || true)

if [ -n "$SCAN" ]; then
  NEW=$(echo "$SCAN" | while IFS=: read -r file line content; do
    value=$(echo "$content" | grep -oE '(text|bg|border)-\[[^]]+\]' | head -1)
    if [ -n "$value" ]; then
      printf '{"file":"%s","line":%s,"value":"%s","at":"%s","status":"pending"}\n' \
        "$file" "$line" "$value" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
  done | jq -s '.' 2>/dev/null || echo '[]')
fi

# Merge: existing + new, deduplicate by file+line+value, keep latest
MERGED=$(echo "$EXISTING" "$NEW" | jq -s '
  add
  | group_by(.file + ":" + (.line|tostring) + ":" + .value)
  | map(last)
  | sort_by(.at)
  | reverse
' 2>/dev/null || echo '[]')

mkdir -p "$(dirname "$OUT")"
echo "$MERGED" > "$TMP"
mv "$TMP" "$OUT"

COUNT=$(echo "$MERGED" | jq 'length' 2>/dev/null || echo 0)
PENDING=$(echo "$MERGED" | jq '[.[] | select(.status == "pending")] | length' 2>/dev/null || echo 0)
echo "design-lint: $COUNT total violations, $PENDING pending"
