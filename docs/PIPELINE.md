# Pipeline — push → GitHub Actions → GHCR → Coolify → LIVE

The single source of truth for the prod / test pipeline. Read this first.
**Current.** If this contradicts other docs, this file + `deploy` reality win.

## The two envs (same server, Coolify)

| | prod | test |
|---|---|---|
| branch | `main` | `preprod` |
| Coolify app | 1edge-prod (`oqz7u0yho3lulqdt0ymwdibx`) | 1edge-preprod (`fyn2fhxrsltey8dr6k6plxg8`) |
| GHCR image | `ghcr.io/bhaveshdhaka/1ed-ge:main` | `ghcr.io/bhaveshdhaka/1ed-ge:preprod` |
| URL | https://1ed.ge | https://test.1ed.ge |
| port | 4321 | 4323 |
| `SITE_ENV` | `prod` | `test` |
| server | **Server B** (Coolify) | **Server B** (Coolify) — same box |

There is **no Server A** and no separate host for test. Both envs run as Coolify
docker-image apps on Server B behind the Cloudflare tunnel.

## How a change becomes live

```
agent push (or PR merge) → GitHub Actions docker-publish.yml
      → builds image → pushes GHCR tag :main / :preprod (+ sha + :latest on main)
      → POST https://coolify.bhavesh.hk/api/v1/applications/<uuid>/start
      → Coolify pulls the tag + recreates the container
      → app returns HTTP 200 at its public URL
```

- **CI (`ci.yml`)** runs typecheck + test + lint on PR **and** push to
  main/preprod. It is required by branch protection.
- **Direct push is allowed**: branch protection requires `ci` to pass but does
  **not** require a human review (0 required reviews), and force-push is
  disabled. Agents push autonomously; the pipeline + CI do the checks.
- **Coolify API token:** `/srv/secrets/coolify-api`; also `COOLIFY_TOKEN` in
  GitHub Actions secrets.
- Deploy trigger endpoint (used by the workflow): `POST /api/v1/applications/<uuid>/start`.

## Verify

- `https://1ed.ge` (prod) / `https://test.1ed.ge` (test) → HTTP 200.
- `curl` the URL and confirm your change is present; run `scripts/verify-env.sh prod|test`.
- If Coolify didn't redeploy, check the Coolify dashboard / deploy log.

## The de-index layers on test

`SITE_NOINDEX=1` is set for test (noindex signals in the built HTML / robots
route). There is **no** HTTP basic auth on test — it's reachable over the
tunnel publicly (it is noindexed).

## Ship discipline (this is ONE pipeline; main + preprod behave the same)

1. Work on a branch. Run `npm run typecheck && npm run test && npm run lint`.
2. Push the branch (`main` or `preprod`) → CI runs.
3. If CI fails, fix + re-push. No human approval step.
4. Merge/push → `docker-publish.yml` → GHCR → Coolify → live.
5. Verify live.

Apply identical expectations to both `main` and `preprod` — they're the same
pipeline, same CI, same Coolify apps, no confusion.
