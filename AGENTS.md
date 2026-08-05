# AGENTS.md — 1ed.ge

Guidance for AI agents working in this repository. Read this first. It is the
single source of truth for how this project is built, run, and shipped.

## What this is

`1ed.ge` is a **public trading journal** — a two-year, everything-public
experiment on the road to a hedge fund. Every trade, every account, every
journal entry and every habit is public. The only private thing is the admin
area at `/admin/<secret>`.

The centerpiece metric is **R** = points risked vs points made. All
performance math is risk-based.

## Stack

- **Astro 5** (static-first) + **@astrojs/node** (standalone SSR for the few
  server routes) + **Tailwind CSS v4** + TypeScript.
- React islands only on the admin page (client-side). Public pages ship zero JS.
- Content collections (glob loaders + Zod schemas) for all content.
- **OpenRouter** for AI: DeepSeek (`deepseek/deepseek-chat`) for structuring
  notes/assist, Qwen2.5-VL (`qwen/qwen-2.5-vl-72b-instruct`) for reading trade
  screenshots.
- `sharp` for image compression (uploads → webp), `gray-matter` for file I/O in
  the admin APIs.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Astro dev server on :4321 |
| `npm run build` | Production build → `dist/` |
| `npm run typecheck` | `astro check` — run after any code change |
| `npm run seed` | Idempotent: creates default accounts/habits/day-zero post |
| `npm run start` | Serve `dist/` (`node dist/server/entry.mjs`) |
| `bash scripts/deploy.sh` | Docker compose up + install nginx vhost + git autocommit cron |

Always run `npm run typecheck` (and `npm run build` if it touches the site)
after changing code.

## Layout

```
astro.config.mjs            static output + node adapter; SSR routes opt out per-file
src/content.config.ts       collections: accounts, trades, journal, habits, habit-log
src/content/...             all content as Markdown/MDX frontmatter (git-backed)
src/lib/content.ts          fs + gray-matter helpers for admin file I/O
src/lib/stats.ts            R/pnl/equity/drawdown engine (build-time)
src/lib/habits.ts           streak + heatmap computation
src/lib/ai.ts               OpenRouter clients + prompts
src/lib/auth.ts             admin secret check + JSON responses
src/lib/env.ts              .env access (ADMIN_SECRET, OPENROUTER_API_KEY, models)
src/pages/*.astro           public pages (static): / /journal /performance /tracker /about
src/pages/admin/[secret]/   private admin (SSR), renders the React app
src/pages/api/admin/*.ts    admin API routes (SSR, auth via x-admin-secret header)
src/pages/media/[...file].ts SSR media file server (uploads live in public/media)
src/components/admin/*      React admin app (Trades / Journal / Tracker / Media / Overview)
src/components/*.astro      shared UI + SVG charts (zero JS)
public/media/               uploaded images (webp) — git-tracked
scripts/seed.mjs            seed defaults
scripts/deploy.sh           server deploy
nginx/1ed.ge.conf           host nginx vhost
Dockerfile / docker-compose.yml   containerized app; bind-mounts src/content + public/media
```

## Content model

Files are the database. One Markdown file per entity, keyed as:

- `accounts/<slug>.md` — firm, size, sizeLabel, drawdownLimit, trailing, contract,
  pointsValue (MNQ = $2/pt), riskPerTrade, status, started/ended.
- `trades/<date>-NNN.md` — date, account, market, session, direction, setup,
  entry, stop, target, exit, riskPoints, points, confidence, screenshots[], note.
- `journal/<date>.mdx` — day, summary, tags, mood, featuredImage + MDX body.
- `habits/<slug>.md` — name, emoji, color, description.
- `habit-log/<date>.md` — `values: { <habit-slug>: bool }`, optional note.

**R** is computed, never stored: `R = points / riskPoints`,
`pnl = points * pointsValue`. All charts derive from these.

## Admin + publish flow (important)

1. Admin (React) calls `POST /api/admin/<resource>` with the
   `x-admin-secret` header (must equal `ADMIN_SECRET`).
2. The API writes files directly with `fs`/`gray-matter`
   (`src/lib/content.ts`) — **not** through content collections (collections
   are cached; fs reads are always fresh).
3. Save → client calls `POST /api/admin/rebuild` → runs `npm run build` in the
   background (~8s). Static pages are served from `dist/client` on disk, so the
   node standalone server picks up new builds in place — no restart needed.

## Conventions & rules

- **Everything public except the admin.** Never weaken this. No cherry-picking.
- **Never commit secrets.** `.env` (ADMIN_SECRET, OPENROUTER_API_KEY) is
  gitignored. `.env.example` documents the shape.
- **Public pages must stay zero-JS.** No React/JS on anything under `/`,
  `/journal`, `/performance`, `/tracker`, `/about`. Interactive admin only.
- Astro 5.18 removed `output: "hybrid"`. Use `output: "static"` and opt into
  SSR per-route with `export const prerender = false`.
- The server's system resolver does **not** resolve `1ed.ge`. When testing
  locally use `curl --resolve 1ed.ge:443:104.21.7.179 https://1ed.ge/`.
- nginx `/media/` proxies to node (a filesystem `alias` fails because
  `/root` is mode 700).
- Style: monospace, off-black (`#0a0a0c`), green `#4ade80` = up, red `#f87171`
  = down, low-contrast dim text, terminal aesthetic. Match existing Tailwind
  theme tokens in `src/styles/global.css`.

## Versioning

- Semantic versioning (`vX.Y.Z`).
- `CHANGELOG.md` follows Keep a Changelog. Update it on meaningful changes.
- Code changes are committed by hand with conventional prefixes
  (`feat:` / `fix:` / `chore:` / `docs:`).
- Content is auto-committed by a cron every 30 min
  (`chore(content): autosave …`); do not fight it.
- Tag releases: `git tag v0.1.0`.

## Future moves

- When moving to Cloudflare Pages + CDN: everything is file-based (content in
  git), so it ports cleanly — swap the adapter, keep the content layer.
