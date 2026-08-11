---
description: Ship changes to production.
---
1. `npm run typecheck`
2. `npm run build`
3. `git add -A && git commit -m "<conventional message>"`
4. `bash scripts/ship.sh prod-only`

That's it. The deploy script handles everything else (changelog, build stamp, tokenomics, pending clear, crons, verify).
