#!/bin/sh
set -e
cd /app
# rebuild so dist matches the content mounted at runtime
npm run build > /tmp/1edge-start-build.log 2>&1
exec node dist/server/entry.mjs
