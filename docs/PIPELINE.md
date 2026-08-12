# Pipeline — GitHub PR → Actions → deploy

The single source of truth for the prod / test pipeline. Read this first.

## The two envs

| | prod | test |
|---|---|---|
| branch | `main` | `preprod` |
| server | **Server B** (`202.73.4.149`, docker) | **Server A** (`142.91.108.254`, host node) |
| URL | https://1ed.ge | https://test.1ed.ge (basic auth) |
| port | 4321 (docker) | 4323 (host node) |
| `SITE_ENV` | `prod` | `test` |
| `SITE_NOINDEX` | `0` | `1` |
| nginx vhost | `1ed.ge` (on B) | `test.1ed.ge` (on A) |
| data | `/srv/1edge/content` (on B) | `/var/data/test/content` (on A) |
| Actions runner | `server-b` (deploy user) | `server-a` (agent user) |
| deploy workflow | `deploy.yml` | `deploy-test.yml` |

## The env-typing contract

Each env's `.env` (gitignored) declares:

```bash
SITE_ENV=prod   # or: test
SITE_URL=https://1ed.ge   # or: https://test.1ed.ge
SITE_PORT=4321  # or: 4323
DATA_PATH=/srv/1edge/content   # or: /var/data/test/content
MEDIA_PATH=/srv/1edge/media    # or: /var/data/test/media
DATA_DIR=/srv/1edge/data       # or: /var/data/test/data
HOST=0.0.0.0
```

`SITE_NOINDEX` is derived (`1` if `SITE_ENV=test`, else `0`). Override only if you know why.

Content lives **outside git** at `DATA_PATH` (env-driven). `src/lib/paths.ts` resolves `ROOT`/`CONTENT`/`MEDIA`/`DATA_DIR` from these env vars, falling back to in-repo paths.

## The ship path (agent + owner)

**Agent ships via PR only.** The agent never pushes to `main`/`preprod` directly, never touches Server B, never holds prod secrets.

1. Create a `feat/*` branch.
2. `npm run typecheck && npm run test && npm run lint` (the pre-push hook gates this).
3. Push the branch (pre-push hook runs the checks; direct pushes to main/preprod are refused).
4. Open a PR. CI (`ci.yml`) runs typecheck + test + lint on the PR.
5. Merge → GitHub Actions deploys:
   - merge to `main` → `deploy.yml` on the `server-b` runner → prod on B
   - merge to `preprod` → `deploy-test.yml` on the `server-a` runner → test on A

## The scripts

| Script | Where it runs | What it does |
|---|---|---|
| `scripts/where-am-i.sh` | any | Print the env snapshot (env, branch, port, url, server status) |
| `scripts/verify-env.sh [prod\|test]` | any | Curl the running env, assert noindex signals + content match |
| `scripts/audit-pipeline.sh` | any | 10-second wired-up check (where-am-i + verify-env + git status) |
| `scripts/seed.mjs` | test only | Idempotent default seed (4 accounts + 6 habits + Day Zero). Refuses in prod. |
| `scripts/seed-review.mjs --days=N` | test only | Generate sandbox days + journal + coach + payouts. Refuses in prod. |
| `scripts/post-deploy.mjs` | deploy | Changelog + build stamp + tokenomics + clear pending |
| `scripts/tokenomics.mjs` | A cron | Extract OpenCode token/cost stats → `$DATA_DIR/tokenomics.json` |
| `scripts/status-snapshot.mjs` | B cron | Write `$DATA_DIR/status.json` |
| `scripts/market-news-fetch.mjs` | B cron | Fetch USD market news → `$DATA_PATH/market-news` |

## The four de-index layers on test (defence in depth)

1. nginx `auth_basic` — `trader` / `wonderland` (htpasswd at `/etc/nginx/.htpasswd-test`)
2. nginx `add_header X-Robots-Tag "noindex, nofollow" always;`
3. nginx `location = /robots.txt` returns `200 "User-agent: *\nDisallow: /\n"`
4. `Base.astro` emits `<meta name="robots" content="noindex,nofollow">` when `process.env.SITE_NOINDEX === '1'`

## Daily workflow

### I want to ship a code change

```bash
git checkout -b feat/my-change
# ... make changes ...
git add -A && git commit -m "feat: ..."
git push -u origin feat/my-change     # pre-push hook runs typecheck+test+lint
# open a PR → merge → CI deploys
```

### I want to check everything is wired up

```bash
bash scripts/audit-pipeline.sh
```

### I want to verify prod is live

```bash
bash scripts/verify-env.sh prod
```

## What the pipeline GUARANTEES

- **Agent never ships directly.** Direct pushes to `main`/`preprod` are refused by the pre-push hook (`.githooks/pre-push`) AND by remote branch protection (GH006). The path is a PR.
- **CI gates every merge.** `ci.yml` runs typecheck + test + lint on every PR and push to main/preprod.
- **Prod and test are on separate servers.** Prod on B (docker, `server-b` runner), test on A (host node, `server-a` runner). No cross-contamination.
- **Content is env-driven.** `DATA_PATH`/`MEDIA_PATH`/`DATA_DIR` point prod at `/srv/1edge/*` and test at `/var/data/test/*`. Content never lives in the deploy checkout.
- **All de-indexing is test-only.** The 4 de-index layers live on the test env. Prod has none.
- **Wrong-env actions fail loud.** Every guard script (`require_env <expected>`) exits non-zero with a 3-line message naming the script, expected env, actual env.

## What the pipeline does NOT do

- Does not auto-sync branches. Each env deploys from its own branch via Actions.
- Does not seed prod. Prod is clean-slate until the owner enters real data via zen.
- Does not run crons on test. Test content is human-committed.
- Does not run a docker container on test. The preprod uses `node dist/server/entry.mjs` directly on port 4323 (simpler).

## Server B — the "don't touch" list

Server B (`202.73.4.149`, `hk-03-dev`) hosts friend slices. **Never modify:**
- `/srv/slices` (friend data, mode 700, owned by uid 1000)
- `slice-manish`, `slice-varun`, `pg-manish`, `pg-varun` containers
- `/etc/nginx/sites-enabled/slices.conf` + `bhavesh.hk.*` certs

The `deploy` user (uid 1001) runs the `server-b` Actions runner and is isolated from `/srv/slices` (cannot read it).

## See also

- `docs/superpowers/specs/2026-08-08-pipeline-design.md` — the design spec
- `docs/superpowers/plans/2026-08-12-migration.md` — the two-server migration plan
- `AGENTS.md` — agent guidance
- `MEMORY.md` — session memory
