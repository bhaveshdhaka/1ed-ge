---
description: Ship changes to production (or test).
---
1. `npm run ci` (typecheck + lint + test + build + ui-audit) — fix anything that fails.
2. `git add -A && git commit -m "<conventional message>"`
3. `git push origin main` (prod) or `git push origin preprod` (test).
4. Verify live: `curl -N https://dash.bhavesh.hk/events` (wait for `status=finished`),
   then confirm HTTP 200 on the public URL.

CI is the gate — if it fails, fix and re-push.
