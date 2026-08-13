# OpenChamber Infra — Handoff

> If you forget everything, run `cat /srv/PLAN.md`. This doc is the operator-facing summary.

## 1. Public URLs & Auth

| Hostname | Backend | Auth |
|---|---|---|
| `arjun.hk` / `www.arjun.hk` | arjun-static (nginx :8081) | **Public** |
| `1ed.ge` / `www.1ed.ge` | 1edge-prod (:4321) | **Public** |
| `test.1ed.ge` | 1edge-preprod (:4323) | **Public** (noindex) |
| `wa.1ed.ge` | walogger-prod (:8082) | Cloudflare Access (mail@bhavesh.net, mail@char.hk) |
| `test-wa.1ed.ge` | walogger-preprod (:8083) | Cloudflare Access (same) |
| `oc.bhavesh.hk` | OpenChamber (host :3000) | **Public** (legacy alias of oc-infra) |
| `oc-infra.bhavesh.hk` | OpenChamber (host :3000) | **Public** (canonical infra UI) |
| `coolify.bhavesh.hk` | Coolify UI (host :9040) | Cloudflare Access (mail@bhavesh.net) |
| `oc-dev.bhavesh.hk` | OpenChamber dev agent (:3005) | Cloudflare Access (mail@bhavesh.net) |
| `varun-oc.bhavesh.hk` | OpenChamber friend agent (:3001) | Cloudflare Access (mail@bhavesh.net, varunleo@gmail.com) |
| `manish-oc.bhavesh.hk` | OpenChamber friend agent (:3003) | Cloudflare Access (mail@bhavesh.net, southpawaesthetics@gmail.com) |
| `varun-app.bhavesh.hk` | *(not deployed — undefined app)* | Public (no backend → 502) |
| `manish-app.bhavesh.hk` | *(not deployed — undefined app)* | Public (no backend → 502) |

All ingress is via the Cloudflare tunnel `oc` (`4a82137a-…`, account `f04fa041640e4096493366f32948663a`).
External direct access to published container ports is blocked at the firewall (`DOCKER-USER` drop on `eth0`);
only the tunnel (loopback) and established sessions reach them.

## 2. Service topology

- **Coolify** `4.3.1` on the `coolify` docker network, now bound to `127.0.0.1:9040` (was `0.0.0.0:8000`).
  API: `http://127.0.0.1:9040/api/v1`. UI is NOT public; only via `coolify.bhavesh.hk` (Access).
- **OpenChamber instances** run as host systemd services (not Docker — no published image exists):
  - `openchamber.service` → :3000 (oc / oc-infra)
  - `openchamber-ocdev.service` → :3005 (data `/srv/oc-dev`)
  - `openchamber-varun-oc.service` → :3001 (data `/srv/varun-oc`, password `v@run`)
  - `openchamber-manish-oc.service` → :3003 (data `/srv/manish-oc`, password `m@nish`)
  - Friend instances are BYOK: each reads `OPENROUTER_API_KEY` from `/srv/<name>/.config/opencode/.env`.
- **App containers** (Coolify-managed): `1edge-prod`, `1edge-preprod`, `walogger-prod`, `walogger-preprod`, `arjun-static`.

## 3. Secrets (`/srv/secrets`, mode 0600)

| File | Used for | Rotate via |
|---|---|---|
| `coolify-api` | Coolify API | Coolify UI → Settings |
| `cloudflare-api-token` | CF DNS + Access (zone `bhavesh.hk` & `1ed.ge`; read on account Access) | CF dashboard → per-token |
| `cloudflare-tunnel-token` | `cloudflared` systemd service | CF dashboard → tunnel |
| `github-pat` | GitHub API + git push | GitHub → developer settings |
| `1edge-admin-secret` | 1edge `/zen` setup key | change in both 1edge app envs |
| `openrouter-api-key` | walogger-prod only | OpenRouter dashboard |
| `firebase_key.json` | walogger sync | Firebase console |
| `oc-passwords` | Coolify admin `mylo1tanic`, friend UIs `v@run`/`m@nish` | change in service `Environment=` |

**Note:** the `cfut_` Cloudflare token has *read* on account-scoped Access but *no write* — Access apps are created via the **zone** endpoint (`/zones/{zone}/access/apps`). To edit policy `path` scoping you still need an account-scoped token with `Access:Edit`.

## 4. Repos & branch protection

- `bhaveshdhaka/1ed-ge`, `bhaveshdhaka/walogger-v2`, `bhaveshdhaka/arjun.hk`
- `main` (and `preprod` for 1ed-ge/walogger-v2) require 1 review + passing `ci` + `enforce_admins`.
- **`walogger-v2` branch protection could NOT be set** — it is a *private* repo and the account is not GitHub Pro (API returns 403). Either upgrade to Pro or make it public to enable it. `1ed-ge` and `arjun.hk` are public and are protected.

## 5. Docker images

- `1edge` / `walogger` apps: `ghcr.io/bhaveshdhaka/<repo>:main`. A `:latest` tag is published by `docker-publish.yml` (`flavor: latest=auto`) on **push to main**. If `:latest` is missing, set `docker_registry_image_tag: main` explicitly when creating a Coolify app.
- OpenChamber: **no published Docker image exists** (`anomalyco/opencode` on Docker Hub has 0 tags). Instances run the host-installed `@openchamber/web` package via systemd.

## 6. Operational scripts (`/srv/scripts`)

- `audit-server-sec.sh` — dumps ufw/sshd/secrets/containers/tunnel status (run daily).
- `self-destruct.sh` — NUCLEAR; wipes `/srv/1edge*`, `/srv/walogger` and `docker rm -f` app containers after typing `yes destroy everything`.
- `ufw-docker-rules.sh` — reapplies the `DOCKER-USER` external-drop rules (persisted via `ufw-docker-rules.service`).
- `weekly-update.mjs` — Sunday 02:00 HKT cron; writes `1ed-ge/changelog/YYYY-MM-DD.md` and opens a PR.

## 7. Firewall

- `ufw`: default **deny incoming**, allow outgoing, allow `22/tcp` (SSH kept per operator choice).
- `DOCKER-USER`: drops NEW tcp from `eth0` (external) so published app ports are tunnel-only.
- Cloudflare Access enforces email OTP on the protected hostnames above.

## 8. Gotchas

- 1edge `/day/YYYY-MM-DD` route uses slug `/day/DD-mon-YYYY` (e.g. `/day/11-aug-2026`).
- 1edge-preprod must keep `PORT` unset (container bakes 4321) and `SITE_NOINDEX=1`.
- 1edge content is baked at build time — edit `/srv/1edge/content/*.md` then redeploy.
- **User action:** the real 12-aug 1edge day/journal/reflection was lost; re-enter via `https://1ed.ge/zen` (setup key in `1edge-admin-secret`).
