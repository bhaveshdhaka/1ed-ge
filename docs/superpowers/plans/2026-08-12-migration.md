# 1ed.ge + WhatsApp Logger v2 — Two-Server Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move 1ed.ge production and WhatsApp Logger v2 off Server A onto Server B (202.73.4.149), unify the codebase (DATA_PATH env-driven content), and replace the self-deploy worktree pipeline with a PR-gated GitHub + Actions CI/CD model with a locked-down agent.

**Architecture:** Six independent sub-plans (A–F), each producing a working, testable state. A (codebase) → B (GitHub + lockdown) → C (Server B infra) → D (CI/CD) → E (walogger v2) → F (cleanup). A, B, D, E touch Server A; C, E, F touch Server B. Prod stays live on A until D2 + DNS flip.

**Tech Stack:** Astro 5.18, Docker/Compose, GitHub + self-hosted Actions runners (one per server), ESLint (eslint-plugin-astro + custom rule), import.meta.glob, Python FastAPI (walogger v2), Cloudflare (DNS, Origin CA, Access).

## Global Constraints

- **Server A** = `/root/1ed.ge` (branch `main`) + `/root/1ed-ge-preprod` (branch `preprod`, worktree — to be removed in A4). Site: test.1ed.ge on :4323 (node), prod 1ed.ge on :4321 (docker). This session runs here.
- **Server B** = `202.73.4.149` (`hk-03-dev`, Debian 13). Hosts friend slices `/srv/slices/{manish,varun}` (untouchable — production for friends), nginx :443, UFW (22/80/443). **Never modify `/srv/slices`, the `slice-*`/`pg-*` containers, `slices.conf` vhosts, or `bhavesh.hk.*` certs. No OpenCode on B (removed in F2).**
- **Data model:** content moves out of git → `DATA_PATH` (Server A test: `/var/data/test/content`; Server B prod: `/srv/1edge/content`). `MEDIA_PATH` and `DATA_DIR` follow the same env pattern (precedent: `PASSKEY_DATA_DIR` in `src/lib/passkeys.ts:4`).
- **Master truth for WhatsApp:** Firebase Firestore (v1 writes there). v2 on B runs `sync.py` Firestore→SQLite itself. **Never modify `/opt/whatsapp-logger` (v1).**
- **Auth:** Cloudflare Access in front of `wa.1ed.ge` + `test-wa.1ed.ge`. TLS = Cloudflare Origin CA on both servers.
- **No direct pushes to `main`/`preprod`** — branch protection (server-side, hard gate) + local pre-push hook (defense-in-depth, bypassable) + OpenCode `permission` map.
- **Locked-down agent:** non-root `agent` user on A; PAT scoped to feature branches + PRs only; `ADMIN_SECRET` moves to B's `.env.production`; OpenCode keeps only `OPENROUTER_API_KEY`.
- **Content snapshot first:** before untracking `src/content/`, copy it to the env DATA_PATH on both servers (A: `/var/data/test/content`, B: `/srv/1edge/content`).
- **Crons:** B = `*/5` status + `0 */8` market + deploy-time. A = daily tokenomics (`0 2 * * *`). `1edge-design-review` deleted. walogger-v2 A-side cron removed after E5.
- **Runner isolation:** Server B `deploy` user scoped to `/srv/1edge/` + `/srv/walogger/` only — cannot read/write `/srv/slices/`.
- **No OpenCode on Server B:** root CLI removed in F2 (validated revision). B operates strictly as a headless host managed by the `deploy` runner user. All development occurs exclusively on Server A.
- **OpenCode permission schema (exact):** `permission` (singular), map of tool → effect; `bash` supports command-pattern keys: `{ "bash": { "*": "ask", "git push main": "deny", "git push preprod": "deny", "docker*": "deny", "sudo*": "deny", "ssh*": "deny", "systemctl*": "deny" } }`.
- **Conventional commits** for every task (`feat:`/`fix:`/`chore:`/`docs:`/`refactor:`) — git-cliff + changelog depend on them.
- **No hand-edit of `changelog/*.md`** (auto-generated).
- **Public pages zero-JS**, no arbitrary Tailwind values (ESLint enforces), typecheck + tests + build must pass before any commit.

---

## PLAN A — 1ed.ge codebase simplification (Server A)

### Task A1: Env-driven content + data paths (DATA_PATH)

**Files:**
- Modify: `src/lib/content.ts:5-7`, `src/content.config.ts` (15 glob bases), `src/lib/passkeys.ts:4-6`, `src/lib/changes.ts:4`, `src/lib/live.ts:5`, `src/lib/market-news.ts:22`, `src/pages/api/admin/intentions.ts:10`, `src/pages/api/admin/status.ts:26`, `src/pages/api/admin/rebuild.ts:11`, `src/pages/api/admin/market.ts:12`, `src/pages/status.astro:70-83,139`, `src/pages/build.astro:25-28,71,77,140,155,252-260`, `scripts/seed.mjs:16`, `scripts/seed-review.mjs:18`, `scripts/migrate.mjs:8`, `scripts/market-news-fetch.mjs:19`, `scripts/status-snapshot.mjs:104`, `docker-compose.yml:13`, `.env.example`
- Create: `src/lib/paths.ts`

**Interfaces:**
- Consumes: existing `process.cwd()`-relative content paths (recon report §2, §5).
- Produces: `src/lib/paths.ts` exporting `ROOT`, `CONTENT`, `MEDIA`, `DATA_DIR` — resolved from `process.env.DATA_PATH`/`MEDIA_PATH`/`DATA_DIR` (absolute) else defaults `src/content`/`public/media`/`data`.

- [ ] **Step 1: Write `src/lib/paths.ts`**

```ts
import path from 'node:path'

export const ROOT = process.cwd()
export const CONTENT = process.env.DATA_PATH ? path.resolve(process.env.DATA_PATH) : path.join(ROOT, 'src/content')
export const MEDIA = process.env.MEDIA_PATH ? path.resolve(process.env.MEDIA_PATH) : path.join(ROOT, 'public/media')
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data')
```

- [ ] **Step 2: Repoint `src/lib/content.ts`** — replace `ROOT`/`CONTENT`/`MEDIA` definitions with imports from `./paths`. Keep `dirOf`, `listMds`, `readEntry`, `writeEntry`, `deleteEntry`, `listMedia` signatures unchanged.
- [ ] **Step 3: Repoint `src/content.config.ts`** — all 15 `glob({ pattern, base: './src/content/<kind>' })` → `glob({ pattern, base: path.join(CONTENT, '<kind>') })` where `CONTENT` is imported from `./lib/paths`. `reviews` keeps the `'!**/*.cmp.md'` glob-exclude.
- [ ] **Step 4: Repoint runtime `data/` readers** — `changes.ts`, `live.ts`, `passkeys.ts` (drop `PASSKEY_DATA_DIR`, use `DATA_DIR`), `api/admin/{status,rebuild,market}.ts`, `status.astro` (both candidates), `build.astro` (build.json/tokenomics/changelog/app.css/ui dir/content counts/media count) — all to the `paths` constants (or `DATA_DIR`). `intentions.ts:10` → `path.join(CONTENT, 'intentions')`.
- [ ] **Step 5: Repoint scripts** — `seed.mjs`, `seed-review.mjs`, `migrate.mjs`, `market-news-fetch.mjs` (OUT), `status-snapshot.mjs:104` — read `process.env.DATA_PATH` (fall back to `src/content`), and write `data/` via `process.env.DATA_DIR` (fallback `data`).
- [ ] **Step 6: docker-compose + .env.example** — volume `./src/content:/app/src/content` → `${DATA_PATH:-./src/content}:/app/src/content`; add `DATA_PATH`, `MEDIA_PATH`, `DATA_DIR` docs to `.env.example`.
- [ ] **Step 7: Snapshot content (decision: yes)** — on A: `mkdir -p /var/data/test && cp -a src/content /var/data/test/content && cp -a public/media /var/data/test/media`
- [ ] **Step 8: Verify** — `npm run typecheck` (0 errors), `npm run test` (193 pass), `npm run build` (clean). Then smoke with DATA_PATH set: `DATA_PATH=/var/data/test/content MEDIA_PATH=/var/data/test/media npm run build` → confirm `/day/<date>`, `/stream` render.
- [ ] **Step 9: Commit** — `feat(pipeline): env-driven content/data paths (DATA_PATH)`

### Task A2: ESLint gate (replaces design-lint.sh)

**Files:**
- Create: `eslint.config.mjs`, `eslint/rules/no-arbitrary-tailwind.mjs` (or inline in config)
- Modify: `package.json` (devDeps + `lint` script), `src/pages/status.astro` (remove design-review card + reader)
- Delete: `scripts/design-lint.sh`, `scripts/design-review.mjs`, `/etc/cron.d/1edge-design-review` (host, via `sudo rm`)

**Interfaces:**
- Consumes: the arbitrary-tailwind pattern from `design-lint.sh:19` (`text-[|bg-[|border-[`).
- Produces: `npm run lint` (exit non-zero on violations); custom rule `no-arbitrary-tailwind` flagging `text-[`/`bg-[`/`border-[` in `.astro` files.

- [ ] **Step 1: Add deps** — `npm i -D eslint eslint-plugin-astro` (eslint-plugin-tailwindcss cannot parse `.astro`; the custom rule covers the token rule).
- [ ] **Step 2: Write `eslint.config.mjs`**

```js
import astro from 'eslint-plugin-astro'
import noArbitraryTailwind from './eslint/rules/no-arbitrary-tailwind.mjs'

export default [
  { ignores: ['dist/**', 'node_modules/**', '.astro/**'] },
  ...astro.configs.recommended,
  {
    plugins: { custom: { rules: { 'no-arbitrary-tailwind': noArbitraryTailwind } } },
    files: ['**/*.astro'],
    rules: { 'custom/no-arbitrary-tailwind': 'error' },
  },
]
```

- [ ] **Step 3: Write the rule** (`eslint/rules/no-arbitrary-tailwind.mjs`) — create `meta` (type problem, fixable no), `create(context)` with a visitor on `Attribute`/`Literal`/`JSXText`-style nodes that matches `/(?:text|bg|border)-\[[^\]]+\]/` in class-like attributes and reports `error`.
- [ ] **Step 4: package.json** — add `"lint": "eslint src/ --ext .astro"` (or flat-config path) + devDeps.
- [ ] **Step 5: Delete design-review machinery** — `git rm scripts/design-lint.sh scripts/design-review.mjs`; `sudo rm /etc/cron.d/1edge-design-review`; remove the `/status` design-review card + `design-review.json` reader (`status.astro:139`, card at `:339-355`).
- [ ] **Step 6: Verify** — `npm run lint` → 0 violations (tree is clean today per the grep); `npm run typecheck` green; `npm run test` green.
- [ ] **Step 7: Commit** — `feat(pipeline): ESLint gate for design rules (replaces design-lint)`

### Task A3: Dynamic traceability via import.meta.glob

**Files:**
- Modify: `src/pages/build.astro` (hardcoded `stack`/`traceability`/`primitives` arrays)

**Interfaces:**
- Consumes: the doc-comment reader pattern at `build.astro:155-160`; `import.meta.glob` (build-time Vite transform).
- Produces: auto-discovered page/component list on `/build`; no manual array maintenance.

- [ ] **Step 1: Replace hardcoded arrays** — `const pages = import.meta.glob('/src/pages/**/*.astro', { eager: true })`; build the traceability table from keys + doc-comment extraction; keep the `ui/` primitives scan (already glob-based).
- [ ] **Step 2: Verify** — `npm run build` → `/build` lists every page + component; spot-check a few entries.
- [ ] **Step 3: Commit** — `refactor(build): auto-discover pages/components via import.meta.glob`

### Task A4: Eliminate worktrees/hooks/ship

**Files:**
- Delete: `scripts/ship.sh`, `scripts/sync-to-prod.sh`, `scripts/sync-from-prod.sh`, `scripts/sync-branches.sh`, `scripts/deploy-prod.sh`, `scripts/deploy-test.sh`, `scripts/install-hooks.sh`, `scripts/seed-prod.sh`, `.githooks/pre-push`, `cliff.toml` (moves to D)
- Modify: none (unset `core.hooksPath`)
- Keep: `scripts/status-snapshot.mjs`, `scripts/market-news-fetch.mjs`, `scripts/seed.mjs`, `scripts/verify-env.sh`, `scripts/post-deploy.mjs` (repurposed in D)

**Interfaces:**
- Consumes: current worktree pair (`/root/1ed.ge` main, `/root/1ed-ge-preprod` preprod).
- Produces: single checkout on `main` at `/root/1ed.ge`; `preprod` branch kept (env differentiates test); no hooks, no ship.

- [ ] **Step 1: Delete ship/hook/deploy machinery** — `git rm` the scripts; `rm -rf .githooks`; `git config --unset core.hooksPath` (both worktrees).
- [ ] **Step 2: Collapse to one checkout** — move/copy the preprod-only files into the main checkout (`.env` test values already live in `/root/1ed.ge`? No — see Step 3); remove the worktree: `git worktree remove /root/1ed-ge-preprod`.
- [ ] **Step 3: Env-split by branch** — on `main`: `.env` keeps `SITE_ENV=test` + `DATA_PATH=/var/data/test/content` until DNS flip, then `prod` values; the `preprod` **branch** holds code only (identical code, no worktree).
- [ ] **Step 4: Verify** — `npm run typecheck && npm run test && npm run build`; `git worktree list` shows only `/root/1ed.ge`.
- [ ] **Step 5: Commit** — `chore(pipeline): remove worktree/hook/ship machinery`

---

## PLAN B — GitHub + branch protection + agent lockdown (Server A)

### Task B1: Private GitHub repo + PAT

- [ ] **Step 1** — Create private repo `1ed-ge` (via `gh` or web); add remote `origin`; push `main` + `preprod` branches.
- [ ] **Step 2** — Create fine-grained PAT for the agent user: repo `1ed-ge`, permissions `contents:write` on `refs/heads/feat/*` + PRs only (NOT main/preprod). Store in `/home/agent/.config/opencode/` 0600 file referenced via `{file:...}` in config — never printed.
- [ ] **Step 3: Verify** — `git push -u origin main` succeeds; agent's PAT cannot push to `main` (test with a dry attempt on a throwaway branch pushed to `refs/heads/main` — expect refusal).
- [ ] **Step 4: Commit** — `chore(pipeline): add GitHub remote + scoped PAT (docs/.env.example note)`

### Task B2: Branch protection

- [ ] **Step 1** — In GitHub repo settings: protect `main` + `preprod`: require PR, require status checks (ci.yml — added in D1), block force-push, no direct pushes.
- [ ] **Step 2: Verify** — from the agent user: `git push origin main` refused by remote; a PR cannot merge until CI passes (after D1).

### Task B3: Hard local gate (pre-push hook)

- [ ] **Step 1** — Re-create `.githooks/pre-push`: on any push, run `npm run typecheck && npm run test && npm run lint` (~4s); if non-zero, abort. Still refuse pushes to `main`/`preprod` (branch-block preserved). `git config core.hooksPath .githooks`.
- [ ] **Step 2: Verify** — push to a `feat/*` branch: hook runs checks, passes; introduce a lint violation → push aborts.
- [ ] **Step 3: Commit** — `chore(pipeline): pre-push gate runs typecheck+test+lint`

### Task B4: OpenCode permission lockdown

**Files:**
- Modify: `.opencode/opencode.json` (project, git-tracked)

- [ ] **Step 1** — Add the `permission` map (exact schema from Global Constraints). Back up at `/etc/opencode/opencode.json` (root-writable managed layer).
- [ ] **Step 2: Verify** — in a test session, `git push main` is denied by the permission layer; `sudo`/`docker`/`ssh`/`systemctl` denied; `ask` prompts for `git push*`.
- [ ] **Step 3: Commit** — `chore(pipeline): lock down opencode tool permissions`

### Task B5: Credential trim (non-root agent) — REVISED (validated 2026-08-12)

- [ ] **Step 1** — Create non-root `agent` user; move OpenCode workspace there; **keep `agent` in the `docker` group** (legit A-side ops: usenet stack `/root/usenet-stack/`, `/opt/` services); replace blanket passwordless sudo with a **scoped sudoers allowlist** (systemctl for openchamber/nginx + A-service management only — not root).
- [ ] **Step 2** — Delete `~/.ssh/id_ed25519` + `authorized_keys` (agent keeps only the GitHub PAT).
- [ ] **Step 3** — Split `.env`: `OPENROUTER_API_KEY` stays for the agent; `ADMIN_SECRET` removed from A's agent-visible env (moves to B's `.env.production` in C2).
- [ ] **Step 4** — **OpenChamber systemd runs as `agent`**: edit `/etc/systemd/system/openchamber.service` → `User=agent`, `Group=agent`; `systemctl daemon-reload` + restart; verify oc.1ed.ge still serves and any OpenCode session spawned through the web UI runs as `agent` (not root).
- [ ] **Step 5: Verify** — as `agent`: `sudo -l` shows only scoped commands; `docker ps` works (docker group); `ssh` has no key; openchamber processes owned by `agent`; `ps` on spawned sessions shows non-root.
- [ ] **Step 6: Commit** — `chore(pipeline): agent credential trim (non-root, docker group, scoped sudo, openchamber as agent)`

### Task B6: Agent instructions rewrite

- [ ] **Step 1** — Rewrite `AGENTS.md` + `.opencode/` to the locked contract: create `feat/*` branch → typecheck/test/lint → push (hook gates) → open PR. Deploy happens on merge via CI; agent never ships, never touches Server B, never holds prod secrets.
- [ ] **Step 2: Verify** — doc review only; confirm the contract matches the mechanical gates (B2/B3/B4).
- [ ] **Step 3: Commit** — `docs(pipeline): agent PR-only workflow contract`

---

## PLAN C — Server B infrastructure + hardening

### Task C1: Docker + prod Actions runner

- [ ] **Step 1** — Server B: confirm docker/compose (present, 26.1.5); install the GitHub Actions runner for `1ed-ge` repo, registered as a **repo-scoped** runner, running as new `deploy` user.
- [ ] **Step 2: Verify** — runner shows idle-green in GitHub; `deploy` user can run `docker ps` (its own scope) but `sudo -l` shows only the deploy commands.

### Task C2: /srv volumes + .env.production

- [ ] **Step 1** — Create `/srv/1edge/{content,media,data}` + `/srv/walogger/data`; chown to `deploy`.
- [ ] **Step 2** — Snapshot content from main's git history: `git archive main src/content | tar -x -C /srv/1edge/content` (or copy from A). Same for `public/media`.
- [ ] **Step 3** — Write `/srv/1edge/.env.production`: `SITE_ENV=prod`, `SITE_URL=https://1ed.ge`, `SITE_PORT=4321`, `ADMIN_SECRET`, `OPENROUTER_API_KEY` + AI model overrides, `DATA_PATH=/srv/1edge/content`, `MEDIA_PATH=/srv/1edge/media`, `DATA_DIR=/srv/1edge/data`. 0600, root-owned.
- [ ] **Step 4: Verify** — files exist, perms correct, secrets not in git.

### Task C3: nginx vhosts + Cloudflare Origin CA + DNS

- [ ] **Step 1** — Cloudflare account: add `1ed.ge` + `wa.1ed.ge` records → `202.73.4.149` (proxied), origin certs (same pattern as `bhavesh.hk.pem`), save to `/etc/ssl/certs/1ed.ge.pem` + key.
- [ ] **Step 2** — nginx vhosts: `1ed.ge` → `http://127.0.0.1:4321`, `wa.1ed.ge` → `http://127.0.0.1:8000` (both with the CF origin cert + `X-Forwarded-Proto`). Add to `/etc/nginx/sites-enabled/` — **leave `slices.conf` untouched**.
- [ ] **Step 3: Verify** — `nginx -t`; from B itself curl `https://1ed.ge/` via the CF-resolved IP path; confirm slices still resolve (nginx restart doesn't disturb).
- [ ] **Step 4: Commit** — `docs(infra): server B vhosts + origin certs (nginx config documented in repo)`

### Task C4: Server B crons

- [ ] **Step 1** — `/etc/cron.d/1edge-status`: `*/5 * * * * deploy cd /srv/1edge && /usr/bin/node /srv/1edge/app/scripts/status-snapshot.mjs >/dev/null 2>&1 || true` (writes `/srv/1edge/data/status.json`).
- [ ] **Step 2** — `/etc/cron.d/1edge-market`: `0 */8 * * * deploy cd /srv/1edge && node scripts/market-news-fetch.mjs --no-build >> /tmp/1edge-market.log 2>&1 || true` (writes into `/srv/1edge/content/market-news`).
- [ ] **Step 3: Verify** — run both once; confirm outputs land in the /srv volumes (not in the deploy checkout).

### Task C5: Server B hardening

- [ ] **Step 1** — SSH: `PermitRootLogin prohibit-password`, key-only for root; install + enable `fail2ban` (ssh jail).
- [ ] **Step 2** — Runner/user isolation: `deploy` user in `docker` group but with a systemd `sudoers` allowlist limited to `docker compose -f /srv/1edge/docker-compose.yml *` and `node /srv/1edge/...` — verify it **cannot** read `/srv/slices` (perm check) or touch slices containers.
- [ ] **Step 3** — UFW: confirm 22/80/443 only.
- [ ] **Step 4: Verify** — from `deploy`: `ls /srv/slices` → permission denied; `docker ps` shows only its own compose project (or none); fail2ban status shows the ssh jail active.
- [ ] **Step 5: Commit** — `docs(infra): server B hardening (runner isolation, ssh, fail2ban)`

### Task C6: Friend slices verification

- [ ] **Step 1** — after all C tasks: `docker ps` shows `slice-manish`, `slice-varun`, `pg-manish`, `pg-varun` unchanged (Up, same ports); `slices.conf` intact; `bhavesh.hk.*` certs untouched; nginx reload healthy.
- [ ] **Step 2** — Document the "don't touch" list in `docs/` (or AGENTS.md B-side note).

---

## PLAN D — CI/CD (`.github/workflows/`)

### Task D1: ci.yml (PR gate)

- [ ] **Step 1** — Create `.github/workflows/ci.yml`: on `pull_request` + `push` to main/preprod: `npm ci` → `npm run typecheck` → `npm run test` → `npm run lint`. `concurrency` group; fail-fast.
- [ ] **Step 2: Verify** — push a `feat/*` with a failing test → CI red, merge blocked; fix → green.

### Task D2: deploy.yml (merge → main, B runner)

- [ ] **Step 1** — `.github/workflows/deploy.yml`: `on: push: branches: [main]`, `runs-on: [self-hosted, server-b]`. Steps: checkout → `git cliff --output changelog/<date>.md` → `node scripts/market-news-fetch.mjs --no-build` → `docker build --build-arg GIT_COMMIT_SHA=... --build-arg BUILD_DATE=...` → `docker compose up -d --build` (cwd `/srv/1edge`) → `bash scripts/verify-env.sh prod` → `node scripts/status-snapshot.mjs`.
- [ ] **Step 2: Verify** — merge a trivial commit to main → prod deploys on B, verify-env passes, HTTP 200.

### Task D3: deploy-test.yml (merge → preprod, A runner)

- [ ] **Step 1** — Second self-hosted runner on Server A (repo-scoped, `server-a` label). `.github/workflows/deploy-test.yml`: `on: push: branches: [preprod]`, `runs-on: [self-hosted, server-a]`: checkout → build (`DATA_PATH=/var/data/test/content`) → restart test server (:4323) → `verify-env.sh test`.
- [ ] **Step 2: Verify** — merge to preprod → test.1ed.ge redeploys.

### Task D4: tokenomics extraction + A-side cron

- [ ] **Step 1** — Extract the SQLite query from `post-deploy.mjs:163-268` into `scripts/tokenomics.mjs` (env: `OPENCODE_DB` default `~/.local/share/opencode/opencode.db`; out: `$DATA_DIR/tokenomics.json`).
- [ ] **Step 2** — A-side cron `/etc/cron.d/1edge-tokenomics`: `0 2 * * * root cd /root/1ed.ge && node scripts/tokenomics.mjs >/dev/null 2>&1 || true` (writes A's data dir). `/build` reads it from the mount.
- [ ] **Step 3: Verify** — run once; `/build` shows tokenomics; no bot commits.
- [ ] **Step 4: Commit** — `feat(pipeline): tokenomics.mjs + daily cron`

### Task D5: gut shell orchestrators to Actions

- [ ] **Step 1** — Reduce `deploy-prod.sh`/`deploy-test.sh`/`post-deploy.mjs` to leaf-only steps (changelog, build stamp, market fetch, status snapshot, verify); remove ship/sync/hook references. Keep leaf scripts callable from Actions steps.
- [ ] **Step 2: Verify** — full loop works via D1–D3 without any manual `ship.sh`.
- [ ] **Step 3: Commit** — `refactor(pipeline): Actions-native deploy (leaf scripts only)`

---

## PLAN E — WhatsApp Logger v2 (dockerize + migrate)

### Task E1: Containerize v2 (own Dockerfile, no v1 venv)

**Files:**
- Create: `/srv/walogger/` repo files: `Dockerfile`, `requirements.txt`, `docker-compose.yml`, `.env.example`
- Modify (in the v2 repo): `db.py:10-12` (BASE_DIR/DB_PATH/STATE_PATH → env `WALOGGER_DATA_DIR`), `scheduler.py:14` (VENV_PYTHON → container python), `sys.path` inserts in `server.py:16`/`summarizer.py:19`/`sync.py:12`/`translate.py:9` (→ relative or env), `start.sh` (if kept)

**Interfaces:**
- Consumes: v2 source at `/opt/whatsapp-logger-v2` (git repo, no remote); `requirements.txt` from imports: fastapi, uvicorn, jinja2, requests, firebase-admin.
- Produces: `walogger-v2` docker image; env `WALOGGER_DATA_DIR` (default `/data` in-container); DB at `$WALOGGER_DATA_DIR/local_whatsapp.db`.

- [ ] **Step 1** — Write `requirements.txt` (fastapi, uvicorn, jinja2, requests, firebase-admin).
- [ ] **Step 2** — Parameterize paths: `db.py` BASE_DIR → `os.environ.get('WALOGGER_DATA_DIR', '/data')`; DB_PATH/STATE_PATH join it; remove `sys.path.insert('/opt/whatsapp-logger-v2')` (rely on cwd) in all 5 files; `scheduler.py` VENV_PYTHON → `sys.executable`; `sync.py` firebase key path → `$WALOGGER_DATA_DIR/firebase_key.json`.
- [ ] **Step 3** — Write `Dockerfile`: `FROM python:3.11-slim`, copy source + templates, `RUN pip install -r requirements.txt`, `ENTRYPOINT` runs `sync.py` + `summarizer.py` on a schedule + `uvicorn server:app --host 127.0.0.1 --port 8000`.
- [ ] **Step 4** — Write `docker-compose.yml`: build `.`, ports `127.0.0.1:8000:8000` only, volumes `./data:/data` + `./firebase_key.json:/data/firebase_key.json:ro`, env `WALOGGER_DATA_DIR=/data`, `OPENROUTER_API_KEY`.
- [ ] **Step 5: Verify (local on A, test)** — `docker compose up` → curl `127.0.0.1:8000/api/stats` works without v1's venv; `sync.py` builds DB from Firestore.
- [ ] **Step 6: Commit** — `feat(walogger-v2): containerize with own Dockerfile (no v1 venv)`

### Task E2: Firestore-direct DB on B

- [ ] **Step 1** — On B: `/srv/walogger/data/` (already C2), mount `firebase_key.json` (copy from A's `/opt/whatsapp-logger-v2/firebase_key.json` — same Firestore project).
- [ ] **Step 2: Verify** — `sync.py` in the container pulls Firestore → builds `/srv/walogger/data/local_whatsapp.db`; `summarizer.py` runs; dashboard reads it. **v1 on A untouched.**

### Task E3: walogger-v2 GitHub pipeline

- [ ] **Step 1** — Push v2 repo to private GitHub `walogger-v2`; branch protection `main`+`preprod` (PR + CI required).
- [ ] **Step 2** — `.github/workflows/ci.yml` (lint/py test if any) + `deploy.yml` (merge→main, B runner → `docker compose -f /srv/walogger/docker-compose.yml up -d --build`) + `deploy-test.yml` (merge→preprod, A runner → test-wa.1ed.ge).
- [ ] **Step 3: Verify** — merge to main → wa.1ed.ge live on B; merge to preprod → test-wa.1ed.ge live on A.

### Task E4: Security — bind 127.0.0.1 + Cloudflare Access

- [ ] **Step 1** — Both servers: container binds `127.0.0.1:8000` only (compose already); nginx vhosts proxy `wa.1ed.ge`/`test-wa.1ed.ge` → :8000.
- [ ] **Step 2** — Cloudflare Access: application for `wa.1ed.ge` + `test-wa.1ed.ge` (email OTP/SSO policy). Port 8000 never public.
- [ ] **Step 3: Verify** — unauthenticated `curl https://wa.1ed.ge/` → CF Access challenge; authenticated → dashboard. No `0.0.0.0:8000` listener on either host.

### Task E5: Decommission A-side v2

- [ ] **Step 1** — After E4 verified: remove A root crontab entries (`* * * * * scheduler.py`, `@reboot uvicorn`), kill the `:8000` uvicorn (`pkill -F` pidfile or the recorded pid — never `pkill -f pattern` self-match), remove `/opt/whatsapp-logger-v2` cron/log refs.
- [ ] **Step 2: Verify** — no listener on A:8000; v1 container + Firestore writes still running; walogger_v2 logs stop growing.
- [ ] **Step 3: Commit** — `chore(walogger-v2): decommission A-side scheduler (moved to B)`

---

## PLAN F — Cleanup

### Task F1: Server A dormant projects

- [ ] **Step 1** — Confirm no active use: `plane`, `clash`, `support-bot`, `backup-plane` (no containers, no vhosts after F3) → `rm -rf /opt/plane /opt/clash /opt/support-bot /opt/backup-plane`.
- [ ] **Step 2** — Remove dead `memo.1ed.ge` nginx vhost (nothing on :5230); `nginx -t && reload`.
- [ ] **Step 3: Verify** — `docker ps` clean; nginx healthy; disk freed.

### Task F2: Server B cleanup — REVISED (validated 2026-08-12)

- [ ] **Step 1** — Delete `/root/transport-site` (your call: not important).
- [ ] **Step 2** — **Remove root-level OpenCode on B**: `rm -rf /root/.opencode /root/.config/opencode` (+ any `~/.cache`/npm leftovers tied to it). Verify `which opencode` → nothing and `/root/.opencode` gone; no agent can be invoked on B.
- [ ] **Step 3** — Update the B-side docs note that previously said "root CLI kept" → "no OpenCode on B; all dev on A."

### Task F3: Post-cutover

- [ ] **Step 1** — Flip DNS: `1ed.ge` → Server B (Cloudflare record update); verify live 200 + `verify-env.sh prod` from B.
- [ ] **Step 2** — A: remove the `1edge-site` docker container/compose once prod is stable on B; keep test.1ed.ge (:4323), usenet stack, oc.1ed.ge, v1, agent.
- [ ] **Step 3** — Update `docs/PIPELINE.md`, `AGENTS.md`, `MEMORY.md` to the new model (GitHub PR → Actions → deploy; DATA_PATH; runner isolation; slices untouchable).

---

## Sequencing & gates

Execute in order: **A1→A4** (each commits + tests green, site keeps working) → **E1** (dockerize v2, independent) → **B1→B6** (agent locked down — do before any further prod work) → **C1→C6** (B ready, hardened, slices untouched) → **D1→D5 + E3** (CI/CD for both apps) → **E4/E5** (walogger security + A decommission) → **F1→F3** (cleanup + DNS flip + docs).

**Gate:** prod 1ed.ge stays live on A until D2 + DNS flip (F3). **Gate:** never touch `/srv/slices`, `slice-*`/`pg-*` containers, `slices.conf`, `bhavesh.hk.*` on B. **Gate:** `npm run typecheck && npm run test && npm run build` before every commit.

## Self-review notes

- Spec coverage: A (simplify: DATA_PATH ✓, ESLint ✓, glob ✓, worktrees-gone ✓); B (GitHub ✓, branch protection ✓, hooks ✓, permissions ✓, credentials ✓, agent contract ✓); C (infra ✓, volumes ✓, nginx/CF ✓, crons ✓, hardening ✓, slices ✓); D (ci ✓, deploy ✓, test-deploy ✓, tokenomics ✓, leaf scripts ✓); E (dockerize ✓, firestore-direct ✓, pipeline ✓, security ✓, decommission ✓); F (A cleanup ✓, B cleanup ✓, cutover ✓). All owner decisions captured: firestore-direct (E2), CF Access (E4), CF Origin CA (C3), B hardening (C5), transport-site delete (F2), OpenChamber as agent + docker group/scoped sudo (B5 revision), Server B root OpenCode removed (F2 revision).
- Placeholder scan: every task has concrete file paths, code or commands, verify steps, commit messages. No TBD/TODO.
- Type consistency: `paths.ts` exports `ROOT`/`CONTENT`/`MEDIA`/`DATA_DIR` used identically across A1 tasks; `WALOGGER_DATA_DIR` consistent across E1/E2; `no-arbitrary-tailwind` consistent across A2/B3/D1; runner labels `server-a`/`server-b` consistent across D2/D3.
