# AGENTS.md — 1ed.ge

Guidance for AI agents working in this repository. Read this first. It is the
single source of truth for how this project is built, run, and shipped.

## What this is

`1ed.ge` is a **public trading journal** — a two-year, everything-public
experiment on the road to a hedge fund. Every trade, every account, every
mood, every sleep hour, every screen-time screenshot, every miss is public.
The only private thing is the admin area at `/admin/<secret>`.

The centerpiece metric is **R** = points risked vs points made. All
performance math is risk-based. Everything is linked: mood, sleep, habits,
screen time, and trades all live in the same daily record.

## Stack

- **Astro 5** (static-first) + **@astrojs/node** (standalone SSR for the few
  server routes) + **Tailwind CSS v4** + TypeScript.
- React islands only on the admin page (client-side). Public pages ship zero JS.
- Content collections (glob loaders + Zod schemas) for all content.
- **OpenRouter** for AI: DeepSeek (`deepseek/deepseek-chat`) for structuring
  day notes + the coach + assist; Qwen2.5-VL (`qwen/qwen-2.5-vl-72b-instruct`)
  for reading trade screenshots and screen-time screenshots.
- `sharp` (image → webp), `gray-matter` (file I/O in the admin APIs).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Astro dev server on :4321 |
| `npm run build` | Production build → `dist/`. **Clears `node_modules/.astro` first** — do not remove that. |
| `npm run typecheck` | `astro check` — run after any code change |
| `npm run seed` | Idempotent: default accounts/habits/day-zero post |
| `npm run migrate` | One-time: merge legacy `trades/` + `habit-log/` into `days/` |
| `npm run start` | Serve `dist/` (`node dist/server/entry.mjs`) |
| `bash scripts/deploy.sh` | Docker compose up + install nginx vhost + git autocommit cron |

Always run `npm run typecheck` (and `npm run build` if it touches the site)
after changing code.

## Layout

```
astro.config.mjs            static output + node adapter; SSR routes opt out per-file
src/content.config.ts       collections: accounts, days, payouts, coach, journal, habits
src/content/days/<date>.md  THE daily record — mood, sleep, habits, device, trades+executions
src/content/accounts/       account lifecycle instances (eval → buffer → payout …)
src/content/payouts/        payout records (per account)
src/content/coach/          f-R-iend conversations (public on /coach)
src/content/journal/        prose (MDX), keyed by date
src/content/habits/         habit definitions
src/lib/content.ts          fs + gray-matter helpers for admin file I/O
src/lib/stats.ts            R/pnl/equity/drawdown engine (idea + per-account via executions)
src/lib/trends.ts           rolling windows + correlations (sleep/mood/habits/screen/session/setup)
src/lib/habits.ts           streak + heatmap computation
src/lib/ai.ts               OpenRouter clients: structureDayNotes, readScreenshot,
                            readScreenTime, coachReply, assist
src/lib/auth.ts             admin secret check + JSON responses
src/lib/env.ts              .env access (ADMIN_SECRET, OPENROUTER_API_KEY, models)
src/pages/                  public pages: / /journal /performance /tracker /trends
                            /accounts /coach /about /day/[date] + rss + sitemap
src/pages/admin/[secret]/   private admin (SSR), renders the React app
src/pages/api/admin/*.ts    admin API (SSR, auth via x-admin-secret header)
src/pages/media/[...file].ts SSR media file server (uploads in public/media)
src/components/admin/*      React admin (DayLog / Journal / Accounts / Coach / Media / Overview)
src/components/*.astro      shared UI + SVG charts (zero JS)
public/media/               uploaded images (webp) — git-tracked
scripts/seed.mjs, migrate.mjs, deploy.sh, start.sh
nginx/1ed.ge.conf           host nginx vhost
Dockerfile / docker-compose.yml   bind-mounts src/content + public/media
```

## Content model

Files are the database. The **day record is the spine** — mood, sleep, habits,
screen time, and trades all align to a date:

```yaml
date: "2026-08-05"
mood: 3                      # 1-5
sleep: { hours: 6.5, quality: 3 }
habits: { quiet-time: true, ... }
device:                      # screen-time (iPhone/Mac), fully public + linked
  iphoneHours: 5.2
  socialHours: 2.4
  macHours: 4.5
  notes: "..."
  screenshots: []            # pasted Screen Time screenshots
trades:                      # one idea, executions per account
  - market: MNQ
    direction: long
    session: ny-am
    setup: ORB
    entry: 20800.5
    stop: 20795
    exit: 20812.5
    points: 12               # signed; computed if absent
    riskPoints: 5.5          # computed = |entry - stop| if absent
    executions: [{ account: lucid-50k-a, size: 1 }, { account: tpt-25k-a }]
```

- **R** is computed, never stored: `R = points / riskPoints` (price-based,
  identical across executions). Per-account `$ pnl = points × pointsValue × size`
  (MNQ `pointsValue` = 2).
- **Accounts** = lifecycle instances: `stage` in `eval | buffer | payout |
  failed | paused`, with a `stages[]` history. Failures spawn a new instance;
  old ones stay forever.
- **Payouts** reduce an account's equity (net P&L = gross − payouts), so
  drawdown/buffer math stays honest.

## Admin + publish flow (important)

1. Admin (React) calls `POST /api/admin/<resource>` with the
   `x-admin-secret` header (must equal `ADMIN_SECRET`).
2. The API writes files directly with `fs`/`gray-matter`
   (`src/lib/content.ts`) — **not** through content collections (collections
   are cached; fs reads are always fresh).
3. Save → client calls `POST /api/admin/rebuild` → runs `npm run build`
   (~8s). Static pages are served from `dist/client` on disk, so the node
   standalone server picks up new builds in place — no restart needed.

## Conventions & rules

- **Everything public except the admin.** Never weaken this. No cherry-picking.
- **Never commit secrets.** `.env` (ADMIN_SECRET, OPENROUTER_API_KEY) is
  gitignored. `.env.example` documents the shape.
- **Public pages must stay zero-JS.** No React/JS on public routes. All charts
  are server-rendered SVG.
- **Content-layer cache:** Astro stores the collection data store at
  `node_modules/.astro/`. `npm run build` clears it so deleted files actually
  disappear from the static build. Keep that `rm -rf node_modules/.astro`
  in the build script.
- Astro 5.18 removed `output: "hybrid"`. Use `output: "static"` and opt into
  SSR per-route with `export const prerender = false`.
- The server's system resolver does **not** resolve `1ed.ge`. When testing
  locally use `curl --resolve 1ed.ge:443:104.21.7.179 https://1ed.ge/`.
- nginx `/media/` proxies to node (a filesystem `alias` fails because
  `/root` is mode 700).
- Style: monospace, off-black (`#0a0a0c`), green `#4ade80` = up, red `#f87171`
  = down, low-contrast dim text, terminal aesthetic. Nav labels are plain
  (`[00] home`) — **no `~` in the menu**. Match Tailwind tokens in
  `src/styles/global.css`.

## Versioning

- Semantic versioning (`vX.Y.Z`).
- `CHANGELOG.md` follows Keep a Changelog. Update it on meaningful changes.
- Code changes are committed by hand with conventional prefixes
  (`feat:` / `fix:` / `chore:` / `docs:`).
- Content is auto-committed by a cron every 30 min
  (`chore(content): autosave …`); do not fight it.
- Tag releases: `git tag v0.2.0`.

## Future moves

- Move to Cloudflare Pages + CDN: everything is file-based (content in git),
  so it ports cleanly — swap the adapter, keep the content layer.
- Safari/iOS polish: viewport-fit + apple meta already in the head; a fuller
  pass (safe-area insets, touch targets, PWA) is tracked in `MEMORY.md`.
