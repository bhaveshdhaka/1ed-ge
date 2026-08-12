# Coolify + GHCR Deploy — Server B setup

The deploy now runs: **merge to main → GHCR image → Coolify pulls + runs it.**
No self-hosted runner, no rsync, no `/srv/1edge` compose juggling.

- Image: `ghcr.io/bhaveshdhaka/1ed-ge:main` (published by `.github/workflows/docker-publish.yml`)
- Runs on Server B via Coolify.

## Prerequisites

1. A GitHub **personal access token** (or fine-grained) with `read:packages` scope
   so Coolify can pull from GHCR. GHCR is private to your account by default.
2. Coolify installed and running on Server B (their install script / Docker).
3. persisted volumes on Server B (`/srv/1edge/content`, `media`, `data`) already
   populated — the live data. Coolify does **not** store these inside the image.

## 1. Add the GHCR registry in Coolify

- Settings → Registries → **Add registry**
- Name: `ghcr`
- Registry provider: **GitHub Container Registry (ghcr.io)**
- Username: `bhaveshdhaka`
- Password / token: the GitHub token (must have `read:packages`)
- Test → Save

> The image is public if you flipped the package to public — then no token is
> needed. Keep it private + a token for control. Public is fine since the site
> and repo are already public.

## 2. Create the application

- Resources → **+ New** → Application → **Public Repository (Image)**
- **Image / tag:** `ghcr.io/bhaveshdhaka/1ed-ge:main`
- Registry: the `ghcr` registry added above
- Domain: `1ed.ge` (Coolify will manage the proxy, or point nginx at the app)
- Port: the app listens on **4321**

## 3. Environment variables (Runtime → Environment Variables)

These go **inside** the container. Note: the values are the **container** paths
(`/app/...`) because the SSR server resolves them inside the container. The
volume mounts below then bind that path to the host's `/srv/1edge/...`.

```env
SITE_ENV=prod
SITE_URL=https://1ed.ge
SITE_PORT=4321

DATA_PATH=/app/src/content
MEDIA_PATH=/app/public/media
DATA_DIR=/app/data

ADMIN_SECRET=CHANGE_ME
OPENROUTER_API_KEY=sk-or-...
# optional model overrides:
# AI_MODEL_STRUCTURE=deepseek/deepseek-chat
# AI_MODEL_VISION=qwen/qwen-2.5-vl-72b-instruct
# AI_MODEL_ASSIST=deepseek/deepseek-chat
# AI_MODEL_ALT=qwen/qwen-2.5-vl-7b-instruct
# AI_MODEL_INGEST=deepseek/deepseek-v4-flash-0731
```

## 4. Persistent storage (Volumes)

Runtime → **Persistent Storage** → add three mounts:

| Container path      | Host path           | Notes |
|---------------------|---------------------|-------|
| `/app/src/content`  | `/srv/1edge/content` | The content collection (days, journal, accounts, etc.) |
| `/app/public/media` | `/srv/1edge/media`   | Uploaded webp images |
| `/app/data`         | `/srv/1edge/data`    | status.json, build.json, tokenomics.json, passkeys |

Coolify default app container is often root (good — `start.sh` rebuilds the
static site at boot and needs write access to `dist/` + the mounted volumes).

## 5. Deploy & verify

1. Coolify "Deploy". Watch the logs: Coolify pulls `:main`, then the container
   boots and `start.sh` runs `npm run build` (bakes the mounted content into the
   static build) before serving on 4321.
2. Verify:
   ```
   curl -s -o /dev/null -w "%{http_code}" https://1ed.ge/            # 200
   curl -s https://1ed.ge/status | grep -o 'fresh[^<]*\|container[^<]*up'
   curl -s https://1ed.ge/design  | grep -o 'UI drift backlog'
   ```
3. `/status` needs the status-snapshot cron writing `/srv/1edge/data/status.json`
   — install `scripts/install-server-b-crons.sh` on Server B (it now sets
   `DATA_PATH=/srv/1edge/content DATA_DIR=/srv/1edge/data`).

## Auto-deploy on merge

In the app: **Settings → Deploy** → enable **"Watch / pull image tags"** /
"Auto Deploy" on the `main` tag. Every merge to main publishes a new `:main`
image; Coolify pulls and redeploys automatically. No manual step.

## Rollback

Coolify keeps previous deployment versions. If a bad image ships:
- App → **Rollback** to the previous deployment.
- Or pin the tag to a specific digest / an older SHA tag
  (`docker/metadata-action` also publishes `<sha>` tags like
  `ghcr.io/bhaveshdhaka/1ed-ge:<shorthash>`).

## Retiring the old deploy

Once Coolify is serving the site correctly, delete `.github/workflows/deploy.yml`
(and the Server B `deploy` runner config) so the old self-hosted deploy stops
firing. The site stays live on Coolify — no downtime.

## Key files

| File | Purpose |
|------|---------|
| `.github/workflows/docker-publish.yml` | Build + push GHCR image on merge to main |
| `Dockerfile` | Image definition (root, rebuild-at-start) |
| `scripts/start.sh` | Boot: rebuild static site, then serve on 4321 |
| `scripts/install-server-b-crons.sh` | Server B status + market crons (set DATA_PATH/DATA_DIR) |