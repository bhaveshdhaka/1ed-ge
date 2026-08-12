#!/usr/bin/env bash
# verify-env.sh — assert the running env matches its declared type.
# Usage: bash scripts/verify-env.sh [prod|test]   (defaults to $SITE_ENV)
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=lib/env.sh
source scripts/lib/env.sh
load_env

expected="${1:-$SITE_ENV}"
if [ "$expected" != "prod" ] && [ "$expected" != "test" ]; then
  echo "✗ verify-env FAIL: arg must be 'prod' or 'test' (got: $expected)" >&2
  exit 1
fi

url="$SITE_URL"
if [ -z "$url" ]; then
  echo "✗ verify-env FAIL: SITE_URL unset in .env" >&2
  exit 1
fi

pass=0
fail=0
check() {
  if [ "$2" = "ok" ]; then
    echo "  ✓ $1"
    pass=$((pass + 1))
  else
    echo "  ✗ $1"
    fail=$((fail + 1))
  fi
}

echo "── verify-env: $expected @ $url ───────────────────────────────"

# Curl args: test env needs basic auth to pass the nginx auth_basic gate.
CURL_BASE=(curl -sS --max-time 10 -L)
if [ "$expected" = "test" ]; then
  CURL_AUTH=(-u trader:wonderland)
else
  CURL_AUTH=()
fi

# Loopback DNS bypass: the runner/server may not resolve the site hostname
# (Cloudflare-proxied). When SITE_RESOLVE="host:port:ip" is set, pin the
# connection via --resolve so verification hits the real origin without DNS.
CURL_RESOLVE=()
if [ -n "${SITE_RESOLVE:-}" ]; then
  CURL_RESOLVE=(--resolve "$SITE_RESOLVE")
fi

# 1. HTTP 200 on /
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${CURL_AUTH[@]}" "${CURL_RESOLVE[@]}" "$url/" || echo 000)
if [ "$HTTP_CODE" = "200" ]; then
  check "HTTP 200 on /" ok
else
  check "HTTP 200 on / (got $HTTP_CODE)" fail
fi

# 2. /robots.txt — inspect the wildcard (User-agent: *) block, not per-bot rules
ROBOTS=$(curl -s --max-time 10 "${CURL_AUTH[@]}" "${CURL_RESOLVE[@]}" "$url/robots.txt" || echo "")
# Extract the first wildcard block: from "User-agent: *" to the next blank line or EOF
WILDCARD_BLOCK=$(echo "$ROBOTS" | awk '/^User-agent: \*$/ {flag=1; next} flag && /^$/ {flag=0} flag' | head -20)
if [ "$expected" = "test" ]; then
  if echo "$WILDCARD_BLOCK" | grep -q "Disallow: /"; then
    check "/robots.txt wildcard block has Disallow: /" ok
  else
    check "/robots.txt wildcard block has Disallow: /" fail
  fi
else
  if echo "$WILDCARD_BLOCK" | grep -q "Disallow: /"; then
    check "/robots.txt wildcard block does NOT have Disallow: /" fail
  else
    check "/robots.txt wildcard block does NOT have Disallow: /" ok
  fi
fi

# 3. X-Robots-Tag header on /
HEADER=$(curl -sI --max-time 10 "${CURL_AUTH[@]}" "${CURL_RESOLVE[@]}" "$url/" 2>/dev/null | grep -i "x-robots-tag" || true)
if [ "$expected" = "test" ]; then
  if echo "$HEADER" | grep -qi "noindex"; then
    check "X-Robots-Tag header has noindex" ok
  else
    check "X-Robots-Tag header has noindex" fail
  fi
else
  if echo "$HEADER" | grep -qi "noindex"; then
    check "X-Robots-Tag header does NOT have noindex" fail
  else
    check "X-Robots-Tag header does NOT have noindex" ok
  fi
fi

# 4. meta noindex in HTML
HTML=$(curl -s --max-time 10 "${CURL_AUTH[@]}" "${CURL_RESOLVE[@]}" "$url/" || echo "")
if [ "$expected" = "test" ]; then
  if echo "$HTML" | grep -qi 'name="robots" content="noindex'; then
    check "HTML meta robots has noindex" ok
  else
    check "HTML meta robots has noindex" fail
  fi
else
  if echo "$HTML" | grep -qi 'name="robots" content="noindex'; then
    check "HTML meta robots does NOT have noindex" fail
  else
    check "HTML meta robots does NOT have noindex" ok
  fi
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "✓ verify-env PASS  ($pass checks)"
  exit 0
else
  echo "✗ verify-env FAIL  ($fail of $((pass+fail)) checks failed)"
  exit 1
fi
