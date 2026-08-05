---
description: Deploy the site to the VPS (docker + nginx + cron).
---

Run `bash scripts/deploy.sh` from the repo root. It seeds content, builds and
restarts the docker container, installs the nginx vhost, and (re)installs the
git autocommit cron. After it finishes, verify:

1. `docker ps` shows `1edge-site` Up.
2. `curl --resolve 1ed.ge:443:104.21.7.179 https://1ed.ge/` returns 200.

Report any failure. The admin secret comes from `.env` (never print it fully).
