# Pipeline — prod / test

The single source of truth for the prod / test pipeline. Read this first.

## The two envs

| | prod | test |
|---|---|---|
| branch | `main` | `preprod` |
| worktree | `/root/1ed.ge` | `/root/1ed-ge-preprod` |
| URL | https://1ed.ge | https://test.1ed.ge (basic auth) |
| port | 4321 (docker) | 4323 (host node) |
| `SITE_ENV` | `prod` | `test` |
| `SITE_NOINDEX` | `0` | `1` |
| nginx vhost | `1ed.ge` | `test.1ed.ge` |
| seed | never auto-seeds | idempotent default seed |
| crons | 30-min autosave + 8h market-news | **none** |
| data | owner's real days | sandbox filler |

## The env-typing contract

Each worktree's `.env` (gitignored) declares:

```bash
SITE_ENV=prod   # or: test
SITE_URL=https://1ed.ge   # or: https://test.1ed.ge
SITE_PORT=4321  # or: 4323
HOST=0.0.0.0
```

`SITE_NOINDEX` is derived (`1` if `SITE_ENV=test`, else `0`). Override only if you know why.

Every pipeline script sources `scripts/lib/env.sh` and calls `require_env <expected>` to assert the right env. Wrong env → loud refusal (3-line message naming the script, expected env, actual env, worktree path).

## The scripts

| Script | Where it runs | What it does |
|---|---|---|
| `scripts/where-am-i.sh` | any | Print the env snapshot (env, branch, worktree, port, url, server status) |
| `scripts/deploy-prod.sh` | prod worktree | Build docker, install prod nginx, install prod crons, verify live |
| `scripts/deploy-test.sh` | preprod worktree | Build, start node on 4323, install test nginx, optional seed, verify live |
| `scripts/sync-from-prod.sh` | preprod worktree | Pull main → preprod (stashes preprod-only files across merge) |
| `scripts/sync-to-prod.sh` | **prod** worktree | Push preprod → main, but **blocks src/content/** (the sandbox filler must never land on prod). Must run from the prod worktree (main checked out) — its `git checkout FETCH_HEAD -- files && git commit` lands on the current branch |
| `scripts/verify-env.sh [prod\|test]` | any | Curl the running env, assert noindex signals + content match |
| `scripts/audit-pipeline.sh` | any | 10-second wired-up check (where-am-i + verify-env + git status) |
| `scripts/seed.mjs` | preprod worktree | Idempotent default seed (4 accounts + 6 habits + Day Zero). Refuses in prod. |
| `scripts/seed-review.mjs --days=N` | preprod worktree | Generate sandbox days + journal + coach + payouts. Refuses in prod. |
| `scripts/seed-prod.sh` | any | Loud refusal (never runs anything) |

## The four de-index layers on test (defence in depth)

1. nginx `auth_basic` — `trader` / `wonderland` (htpasswd at `/etc/nginx/.htpasswd-test`)
2. nginx `add_header X-Robots-Tag "noindex, nofollow" always;`
3. nginx `location = /robots.txt` returns `200 "User-agent: *\nDisallow: /\n"`
4. `Base.astro` emits `<meta name="robots" content="noindex,nofollow">` when `process.env.SITE_NOINDEX === '1'`

## Daily workflow

### I want to ship a code change from main to preprod

```bash
cd /root/1ed-ge-preprod
bash scripts/sync-from-prod.sh    # pull main → preprod
bash scripts/deploy-test.sh       # rebuild + restart
```

### I want to ship a code change from preprod to main

```bash
cd /root/1ed.ge
bash scripts/sync-to-prod.sh      # run from PROD — show the diff, ask to confirm
bash scripts/deploy-prod.sh       # rebuild docker, install crons, verify
```

### I want to refresh the preprod sandbox

```bash
cd /root/1ed-ge-preprod
bash scripts/deploy-test.sh       # rebuild + restart (seed.mjs is idempotent)
# OR for a fresh sandbox:
node scripts/seed-review.mjs --days=180
```

### I want to check everything is wired up

```bash
cd /root/1ed.ge          # or /root/1ed-ge-preprod
bash scripts/audit-pipeline.sh
```

## What the pipeline GUARANTEES

- **Test data never lands on prod.** `sync-to-prod.sh` has a content allowlist that excludes `src/content/*`. The preprod's sandbox filler is never in the diff.
- **Prod data never lands on test.** The preprod worktree's `src/content/*` is its own git history; main's `src/content/*` (when the owner has real data) never merges into preprod because the sync direction is `sync-to-prod.sh` (one way, content-guarded) and the preprod worktree is on a separate branch.
- **All de-indexing is test-only.** The 4 de-index layers live in the preprod repo (nginx vhost + Base.astro reading `SITE_NOINDEX`). Prod's nginx vhost + Base.astro have none of them.
- **Wrong-env actions fail loud.** Every guard script (`require_env <expected>`) exits non-zero with a 3-line message naming the script, expected env, actual env, and worktree path.

## What the pipeline does NOT do

- Does not auto-sync. Both directions are explicit.
- Does not seed prod. Prod is clean-slate until the owner runs `seed.mjs` once (with `SITE_ENV=test`) during initial bootstrap.
- Does not run crons on test. Test content is human-committed.
- Does not run a docker container on test. The preprod uses `node dist/server/entry.mjs` directly on port 4323 (simpler).

## Preprod-only files (never sync to main)

- `.env` (already gitignored)
- `nginx/test.1ed.ge.conf` (committed on the `preprod` branch)
- `scripts/seed-review.mjs` (the preprod branch has a date tweak so days end today)

`sync-from-prod.sh` stashes these across the merge and `git checkout --theirs`'s them on conflict.

## Teardown (if ever)

```bash
# 1. stop the preprod server
[ -f /tmp/preprod.pid ] && kill $(cat /tmp/preprod.pid) && rm /tmp/preprod.pid

# 2. remove the nginx vhost
sudo rm /etc/nginx/sites-{enabled,available}/test.1ed.ge
sudo nginx -t && sudo systemctl reload nginx

# 3. remove the worktree
cd /root/1ed.ge
git worktree remove /root/1ed-ge-preprod

# 4. (owner) remove the test.1ed.ge DNS record
```

## See also

- `docs/superpowers/specs/2026-08-08-pipeline-design.md` — the design spec
- `docs/superpowers/plans/2026-08-08-pipeline.md` — the implementation plan
- `AGENTS.md` — agent guidance
- `MEMORY.md` — session memory
