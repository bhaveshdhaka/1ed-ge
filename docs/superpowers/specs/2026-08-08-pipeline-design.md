# The prod / test pipeline (design)

**Status: design — awaiting owner review.**

The owner's ask: "establish a robust simple pipeline that makes it clear what
needs to be synced to prod vs test. Test data remains in test. Prod data never
goes to test and vice versa. All google and related de-indexing is for test
environment only." The current state works but is fragile (manual worktree
sync, hand-managed nginx vhost outside the repo, a preprod `deploy.sh` that
would clobber prod if run). The pipeline below codifies the rules into
scripts and docs that fail loud on a violation.

## Goal

One pipeline with two envs (`prod` = 1ed.ge, `test` = test.1ed.ge), where:

- The env is declared **once**, in each worktree's `.env` (`SITE_ENV=prod` or
  `SITE_ENV=test`).
- The four destructive actions — **deploy**, **sync from main to preprod**,
  **sync from preprod to main**, **mutate content** — each go through a
  dedicated script that asserts the right env and refuses to run otherwise.
- The four de-index layers on test (`auth_basic`, `X-Robots-Tag` header,
  `robots.txt` 200, `SITE_NOINDEX` meta) live in the preprod repo so they
  ship with the code and can't drift.
- A one-command verification (`scripts/verify-env.sh`) asserts the running
  server matches its declared env (right URL, right port, right noindex
  signals, right day content).
- The whole thing is documented in one place (`docs/PIPELINE.md`) so a future
  agent or human can read the rules without spelunking through scripts.

## Non-goals (explicit yagni)

- No new docker container for the test env. The current preprod runs `node
  dist/server/entry.mjs` directly on port 4323 — simpler, and the test env
  doesn't need docker's isolation.
- No cron on the test env. The owner wants test content human-reviewed, not
  auto-swept. The 30-min autosave cron + the 8h market-news cron stay
  **prod-only**.
- No auto-sync. Both directions are explicit `bash scripts/...` invocations;
  the human (or future agent) runs them, sees the diff, and confirms.
- No change to the prod build path (docker compose + container `1edge-site`).
- No change to the four de-index layers. Keep all four (defence in depth).

## Design

### 1. The env-typing contract (the foundation)

**Files:** `scripts/lib/env.sh` (new), `scripts/where-am-i.sh` (new),
`.env.example` (update), both worktrees' `.env` (update, gitignored).

Each worktree's `.env` declares:

```bash
SITE_ENV=prod   # or: test
SITE_URL=https://1ed.ge   # or: https://test.1ed.ge
SITE_PORT=4321  # or: 4323
SITE_NOINDEX=0  # or: 1 (derived: 1 if SITE_ENV=test, 0 if prod)
HOST=0.0.0.0
```

`scripts/lib/env.sh` is the single helper that all pipeline scripts source:

- `load_env` — sources the worktree's `.env` if `SITE_ENV` isn't already set
- `require_env <expected>` — exits non-zero with a clear, loud message if
  `SITE_ENV` doesn't match `<expected>`. The message names the script, the
  expected env, and the actual env ("refusing to run from /root/1ed.ge: this
  is the test deploy, but the worktree's .env says SITE_ENV=prod").
- Helpers `env_url`, `env_port`, `env_noindex` for downstream code.

`scripts/where-am-i.sh` is the one-liner humans/agents run to confirm:

```
$ bash scripts/where-am-i.sh
env:    prod
branch: main
worktree: /root/1ed.ge
url:    https://1ed.ge
port:   4321
noindex: 0
server: up (curl 200, 1234ms)
```

### 2. Deploy per env (replaces the broken `deploy.sh`)

**Files:** `scripts/deploy.sh` → split into `scripts/deploy-prod.sh` +
`scripts/deploy-test.sh`; `scripts/lib/env.sh` (above).

- `scripts/deploy-prod.sh`:
  1. `require_env prod` — refuses if `SITE_ENV != prod`
  2. Branch sanity: `git rev-parse --abbrev-ref HEAD` must be `main`
  3. Fetch USD market news (`scripts/market-news-fetch.mjs --no-build`)
  4. Build + start docker container: `docker compose up -d --build`
  5. Install prod nginx vhost: `sudo cp nginx/1ed.ge.conf /etc/nginx/sites-enabled/1ed.ge && sudo nginx -t && sudo systemctl reload nginx`
  6. Install autosave cron (30 min) for `/root/1ed.ge`
  7. Install market-news cron (8h) — `docker exec 1edge-site ...`
  8. **Never** runs any seed script. Prod is clean-slate.
  9. Final assertion: `bash scripts/verify-env.sh prod` (curl + headers).

- `scripts/deploy-test.sh`:
  1. `require_env test` — refuses if `SITE_ENV != test`
  2. Branch sanity: must be `preprod`
  3. Fetch USD market news
  4. Build: `npm run build`
  5. Start: `set -a; source .env; set +a; PORT=$SITE_PORT HOST=127.0.0.1 nohup node dist/server/entry.mjs > /tmp/preprod.log 2>&1 & echo $! > /tmp/preprod.pid`
  6. Install test nginx vhost: `sudo cp nginx/test.1ed.ge.conf /etc/nginx/sites-enabled/test.1ed.ge && sudo nginx -t && sudo systemctl reload nginx`
  7. **Never** installs any cron. Test content is human-committed.
  8. Optional: `bash scripts/seed.mjs` (idempotent, guarded — see §4) to
     refresh the four default accounts + habits + Day-Zero journal if the
     preprod worktree is fresh. Because the preprod's `.env` has
     `SITE_ENV=test`, the seed guard passes. On a non-fresh preprod this is
     a no-op (seed.mjs only writes missing files).
  9. Final assertion: `bash scripts/verify-env.sh test`.

The old `scripts/deploy.sh` is **deleted** (it was a footgun — same name on
both worktrees, different content, ambiguous which env it deploys).

### 3. Sync per direction (two scripts, opposite guards)

**Files:** `scripts/sync-from-prod.sh` (new, main → preprod),
`scripts/sync-to-prod.sh` (exists, harden).

- `scripts/sync-from-prod.sh`:
  1. `require_env test` — must run FROM the preprod worktree
  2. Branch sanity: must be on `preprod`
  3. `git fetch /root/1ed.ge main` (or `origin main`)
  4. Compute `preprod-only` files: `.env`, `nginx/test.1ed.ge.conf`,
     and any preprod-only diff in `scripts/seed-review.mjs` (date tweak).
     Stash them with `git stash push -m "preprod-only" -- <files>` so
     the merge won't conflict.
  5. `git merge origin/main --no-ff -m "sync: bring main to preprod (...)"`.
  6. `git stash pop` to restore the preprod-only files on top of the merge.
     If the pop conflicts, `git checkout --theirs <file>` for the listed
     preprod-only files (we want preprod's version, not main's, for these).
  7. Report what changed (file count, content-only vs code).
  8. No allowlist — preprod is a superset; prod code is a strict subset
     of preprod code (the sync is additive in preprod's direction).

- `scripts/sync-to-prod.sh` (existing, harden):
  1. Add `require_env test` at the top — must run FROM preprod
  2. Branch sanity: must be on `preprod`
  3. Keep the existing `ALLOWLIST_REGEX` content guard (the critical
     bit: preprod's `src/content/*` filler must never sync to main)
  4. Keep `--with-memory`, `--dry-run`, `-y` flags
  5. On success, print: "now run `bash scripts/deploy-prod.sh` to ship it"

### 4. Content-mutation guards (the data-bleed prevention)

**Files:** `scripts/seed.mjs` (update), `scripts/seed-review.mjs` (update).

Both scripts check `SITE_ENV` at the top and `process.exit(1)` with a loud
message if it's not `test`:

```
$ cd /root/1ed.ge && node scripts/seed.mjs
✗ refusing: scripts/seed.mjs only runs in the TEST env.
  SITE_ENV is unset or "prod" in this worktree's .env.
  This script writes the default accounts + habits + Day Zero journal.
  If you really want to seed in prod (you probably don't), set SITE_ENV=test first.
```

- `seed.mjs` — adds the `require_env test` guard at the top. The `writeIfMissing`
  semantics stay (idempotent). The default content (4 accounts, 6 habits,
  today's Day Zero journal) is for the empty prod when the owner first
  lands; the guard forces the owner to opt in.
- `seed-review.mjs` — adds the `require_env test` guard at the top. The
  script clears and rewrites `src/content/{days,journal,payouts,coach,accounts}`
  — the prod guard is non-negotiable.

A new `scripts/seed-prod.sh` thin wrapper (informational, refuses by default):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/env.sh
load_env
cat <<EOF
✗ seed-prod is not a thing.
  scripts/seed.mjs writes the default 4 accounts + 6 habits + Day Zero journal.
  It is meant for the test env (where it's idempotent) and for the owner's
  prod bootstrap (where you run it ONCE, then live in zen).
  If you really mean it (initial bootstrap only), run:
    SITE_ENV=test node scripts/seed.mjs
EOF
exit 1
```

### 5. Nginx vhost for test lives in the preprod repo

**Files:** `nginx/test.1ed.ge.conf` (new, committed on `preprod` only).

Move the vhost from `/etc/nginx/sites-available/test.1ed.ge` (hand-managed)
into the preprod repo. The preprod `deploy-test.sh` installs it via
`sudo cp nginx/test.1ed.ge.conf /etc/nginx/sites-enabled/test.1ed.ge`. This
kills the drift risk: the vhost is versioned, the deploy script is the only
way it lands on the server, and `scripts/verify-env.sh` confirms it.

The vhost content (kept identical to current):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name test.1ed.ge;

    auth_basic "test.1ed.ge — pre-prod sandbox";
    auth_basic_user_file /etc/nginx/.htpasswd-test;

    add_header X-Robots-Tag "noindex, nofollow" always;

    location = /robots.txt {
        default_type text/plain;
        return 200 "User-agent: *\nDisallow: /\n";
    }

    location / {
        proxy_pass http://127.0.0.1:4323;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The preprod branch already has the preprod-only `.env` and seed-review date
tweak in its diff. The new `nginx/test.1ed.ge.conf` joins them as a
preprod-only file tracked by `sync-from-prod.sh`'s preservation list.

### 6. Verification (the "did I set it up right?" check)

**Files:** `scripts/verify-env.sh` (new), `scripts/audit-pipeline.sh` (new).

`scripts/verify-env.sh [prod|test]`:

1. `require_env <arg>` (or defaults to `$SITE_ENV`)
2. Curl `SITE_URL/`:
   - HTTP 200 expected
   - If `test`: `X-Robots-Tag: noindex, nofollow` header MUST be present
   - If `test`: `<meta name="robots" content="noindex,nofollow">` MUST be in HTML
   - If `prod`: NO `noindex` meta, NO `X-Robots-Tag: noindex` header
3. Curl `SITE_URL/robots.txt`:
   - If `test`: MUST return `Disallow: /`
   - If `prod`: MUST NOT return `Disallow: /` (or the file MUST be absent)
4. Curl `SITE_URL/day/2026-08-05` (or another known day for this env):
   - HTML must contain the env's content marker (e.g., test day record's
     `notes` field, or the prod Day Zero journal's "Day Zero" string)
5. Print `✓ verify-env PASS` or `✗ verify-env FAIL: <reason>`

`scripts/audit-pipeline.sh`:

Runs `where-am-i.sh` + `verify-env.sh` + `git status -sb` + a check that
the worktree's `.env` has `SITE_ENV` set. The 10-second "is everything
wired up?" check before any deploy or sync.

### 7. Docs (the codification)

**Files:** `docs/PIPELINE.md` (new), `MEMORY.md` (update), `AGENTS.md`
(update).

`docs/PIPELINE.md` is the single source of truth:

- The env contract (`.env` keys, what each means)
- The four scripts (deploy-prod, deploy-test, sync-from-prod, sync-to-prod)
  with their guards and pre-flight checks
- The two seed scripts and their guards
- The verification scripts
- The de-index layers on test (4 layers, what each does)
- The teardown story (`git worktree remove /root/1ed-ge-preprod` +
  `sudo rm /etc/nginx/sites-{enabled,available}/test.1ed.ge` + kill pidfile
  + owner's job to remove the DNS record)
- The "what lives where" map (one column for prod, one for test, every
  surface: branch, worktree path, .env, port, URL, nginx vhost, cron,
  seed behaviour, de-index signals)

`MEMORY.md` and `AGENTS.md` are updated to reference `docs/PIPELINE.md` and
the new commands. The long preprod setup notes in MEMORY compress into a
pointer to the doc.

## File-by-file change list

**New (committed on `preprod`, may also land on `main` if no preprod-only content):**

- `scripts/lib/env.sh` — env helpers (`load_env`, `require_env`, etc.)
- `scripts/where-am-i.sh` — env snapshot printer
- `scripts/deploy-prod.sh` — prod deploy (replaces the prod-side of deploy.sh)
- `scripts/deploy-test.sh` — test deploy (replaces the broken preprod deploy.sh)
- `scripts/sync-from-prod.sh` — main → preprod sync
- `scripts/verify-env.sh` — env assertion curl script
- `scripts/audit-pipeline.sh` — 10-second "wired up?" check
- `scripts/seed-prod.sh` — informational refusal (never runs anything)
- `docs/PIPELINE.md` — the codification

**Updated:**

- `scripts/sync-to-prod.sh` — add `require_env test` + branch sanity at top
- `scripts/seed.mjs` — add `require_env test` guard (Node)
- `scripts/seed-review.mjs` — add `require_env test` guard (Node)
- `.env.example` — document `SITE_ENV`, `SITE_URL`, `SITE_PORT`, `SITE_NOINDEX`
- `MEMORY.md` — compress preprod setup into a `docs/PIPELINE.md` reference
- `AGENTS.md` — add a "Pipeline" section pointing to `docs/PIPELINE.md`
- `scripts/deploy.sh` — **deleted** (replaced by the two named deploy scripts)

**Preprod-only (committed on `preprod`, must not sync to `main`):**

- `.env` (already gitignored — keep gitignored)
- `nginx/test.1ed.ge.conf` (new, lives in the preprod branch only)
- `scripts/seed-review.mjs` date tweak (the preprod branch's existing diff;
  preserved by `sync-from-prod.sh`)

## Migration (one-time, the day this ships)

1. Write the spec doc + the new scripts.
2. On `main` (prod worktree):
   - Add `scripts/lib/env.sh`, `scripts/where-am-i.sh`, `scripts/deploy-prod.sh`,
     `scripts/sync-from-prod.sh` (with `require_env test` so it refuses to
     run on prod), `scripts/verify-env.sh`, `scripts/audit-pipeline.sh`,
     `scripts/seed-prod.sh`, `docs/PIPELINE.md`.
   - Update `scripts/sync-to-prod.sh`, `scripts/seed.mjs`,
     `scripts/seed-review.mjs` with the guards.
   - Update `.env.example`, `MEMORY.md`, `AGENTS.md`.
   - **Delete** `scripts/deploy.sh` (replaced by `deploy-prod.sh` +
     `deploy-test.sh`).
   - **Do NOT** add `nginx/test.1ed.ge.conf` (preprod-only).
   - **Do NOT** add `.env` (already gitignored).
   - Commit, deploy via the new `scripts/deploy-prod.sh`, verify live.
3. On `preprod` worktree:
   - Pull main via the new `scripts/sync-from-prod.sh`.
   - Add `nginx/test.1ed.ge.conf` (preprod-only).
   - Add `scripts/deploy-test.sh` (the preprod's existing `deploy.sh` is
     the broken one; replaced).
   - Add `SITE_ENV=test` + `SITE_URL=https://test.1ed.ge` + `SITE_PORT=4323`
     + `SITE_NOINDEX=1` to the preprod's `.env` (gitignored).
   - Restart the preprod server with the new `.env` sourced.
   - Verify via `scripts/verify-env.sh test`.
4. Smoke: confirm prod's `https://1ed.ge` still loads + has no noindex meta,
   confirm test's `https://test.1ed.ge` still loads with auth_basic + noindex
   + the sandbox content.

## Risks + mitigations

- **Risk:** someone edits the wrong `.env` and prod's `SITE_ENV` becomes
  `test`. **Mitigation:** `require_env prod` in `deploy-prod.sh` and
  `seed.mjs` will refuse; the loud error message names the worktree path.
  Cost: a deploy fails; the human looks, fixes the .env, re-runs. Better
  than silent wrong-env deploy.
- **Risk:** the preprod server is killed but the cron is still installed.
  **Mitigation:** the test env never installs a cron (this design removes
  the preprod's cron installation). Pre-existing crons under
  `/etc/cron.d/1edge-*` only sweep `/root/1ed.ge` (the prod path), so the
  preprod never gets accidentally swept.
- **Risk:** a future agent runs `seed-review.mjs` on prod and clobbers
  real content. **Mitigation:** the `require_env test` guard at the top
  refuses. The seed scripts have no destructive override — `SITE_ENV=prod
  bash scripts/deploy-prod.sh` works, but `SITE_ENV=prod node scripts/
  seed.mjs` fails.
- **Risk:** the preprod branch's `seed-review.mjs` date tweak is lost on
  sync. **Mitigation:** `sync-from-prod.sh` stashes preprod-only files
  before merge, pops after. The list is explicit (`.env`,
  `nginx/test.1ed.ge.conf`, `scripts/seed-review.mjs`).
- **Risk:** nginx vhost for test drifts. **Mitigation:** vhost lives in
  the preprod repo; `deploy-test.sh` is the only way it lands on the
  server. `verify-env.sh` asserts the live noindex headers.

## Out of scope (parked, not part of this design)

- Cloudflare Pages + CDN port (already in MEMORY roadmap)
- Multi-tenant test envs (one test env is enough)
- Automated CI that runs `verify-env.sh` on every commit
- A test env that mirrors prod's docker setup (intentionally simpler)
- The pending owner testing of the new day screen (separate workstream)

## Verification

After the migration:

- `cd /root/1ed.ge && bash scripts/where-am-i.sh` → `env: prod`, `url: https://1ed.ge`, `port: 4321`, `noindex: 0`
- `cd /root/1ed.ge && bash scripts/verify-env.sh prod` → `✓ verify-env PASS`
- `cd /root/1ed-ge-preprod && bash scripts/where-am-i.sh` → `env: test`, `url: https://test.1ed.ge`, `port: 4323`, `noindex: 1`
- `cd /root/1ed-ge-preprod && bash scripts/verify-env.sh test` → `✓ verify-env PASS`
- `cd /root/1ed.ge && node scripts/seed.mjs` → `✗ refusing: ... SITE_ENV is "prod" ...`
- `cd /root/1ed-ge-preprod && node scripts/seed.mjs` → runs idempotently
- `cd /root/1ed.ge && bash scripts/sync-from-prod.sh` → `✗ refusing: this is a preprod-only script ...`
- `cd /root/1ed.ge && bash scripts/sync-to-prod.sh` → `✗ refusing: must run from preprod worktree ...`
- `cd /root/1ed-ge-preprod && bash scripts/sync-to-prod.sh` → shows the diff, asks to confirm
- Live: `curl https://1ed.ge` → 200, no noindex meta, no X-Robots-Tag noindex
- Live: `curl -u trader:wonderland https://test.1ed.ge` → 200, meta `noindex,nofollow`, X-Robots-Tag `noindex, nofollow`, `/robots.txt` → `Disallow: /`

## What this does NOT change

- The preprod worktree structure (`/root/1ed-ge-preprod` on branch `preprod`).
- The docker compose setup on prod (port 4321, env_file, bind mounts).
- The four de-index layers on test.1ed.ge (kept identical).
- The 30-min autosave cron and 8h market-news cron on prod.
- The `Base.astro` `noindex` logic (`process.env.SITE_NOINDEX === '1'`).
- The preprod's direct `node dist/server/entry.mjs` execution (simpler than docker).
- The 6 QA-bug backlog in MEMORY (separate workstream — fixes go to preprod
  first, owner approves, then sync to prod).
- The preprod's pre-existing diffs from main (date tweak in
  `seed-review.mjs`, the preprod's `.env`) — these become explicit
  preprod-only files tracked by `sync-from-prod.sh`.
