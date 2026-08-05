# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-05

### Added
- **Day-log model** — one file per day (`days/<date>.md`) unifies mood, sleep,
  habits, screen-time (`device`) and trades, so everything is linked to one date.
- **Trades = ideas with per-account executions** — the same setup on 2–3
  accounts is one log entry; points/R are idea-level, `$ pnl` computed per
  account (`points × $2 × size`).
- **Account lifecycle** — accounts are instances with
  `eval → buffer → payout` (+ `failed`/`paused`) and a full `stages[]` history.
  Failures stay in the record forever.
- **Payout tracking** — payout records per account; net P&L = gross − payouts,
  so drawdown/buffer stays honest.
- **Mood + sleep tracker** merged into the day record and correlated with
  trading in trends.
- **Screen-time logging** — iPhone/Mac hours + social portion + pasted Screen
  Time screenshots, public per day; Qwen2.5-VL reads the screenshots to fill
  the numbers.
- **Public `/day/[date]`** — the full structured day: mood, sleep, habits,
  screen-time proof screenshots, and trades with per-account executions.
- **Public `/trends`** — rolling 7/30/90d windows, monthly, and correlations:
  R by sleep / mood / habits-done / screen-time / session / setup, plus flags.
- **Public `/accounts`** — every account instance live: stage, drawdown buffer,
  net P&L, payout history.
- **Public `/coach`** — f-R-iend, the data-driven coach. Reads the live trend
  snapshot + remembers prior advice, asks questions, makes suggestions.
- **Admin v2** — unified Day Log editor (mood/sleep/habits/screen-time/trades
  with executions, AI day structuring, screenshot reading), Accounts manager
  (lifecycle + payouts), Coach chat, plus journal/media/overview.
- Nav labels cleaned (`[00] home`, no `~`); iOS/Safari meta + tap-highlight.
- Content-layer cache fix: `npm run build` clears `node_modules/.astro` so
  deleted content actually disappears from the static build.

### Changed
- Replaced the per-trade `trades/` + `habit-log/` collections with the unified
  `days/` model (`scripts/migrate.mjs` for legacy data).

## [0.1.0] - 2026-08-05

### Added
- Astro 5 static-first site with Tailwind v4 monospace "hacker" theme.
- Public pages: `/` home, `/journal` archive + posts, `/performance` dashboard,
  `/tracker` habit tracker, `/about`; RSS feed + sitemap + SEO/JSON-LD groundwork.
- Content collections with Zod schemas: accounts, trades, journal, habits, habit-log.
- Risk-based performance engine (`src/lib/stats.ts`): R-multiple math, equity
  curves (R and $), win rate, profit factor, expectancy, max drawdown, and
  per-account tracking against each prop firm's drawdown limit.
- Private admin at `/admin/<secret>`: Overview, Trades (AI structuring + chart
  screenshot reading), Journal (TipTap editor with image paste + AI assist),
  Tracker (6 daily habits + backfill), Media (upload/compress/delete).
- OpenRouter AI pipeline: DeepSeek for structure/assist, Qwen2.5-VL for reading
  trade screenshots; model selection via `.env`.
- Image pipeline: clipboard/drag upload → `sharp` → webp (max 1920px).
- Save → auto-rebuild flow: content writes then `npm run build` (~8s); static
  pages update in place without a server restart.
- Deployment: `Dockerfile`, `docker-compose.yml` (bind-mounts content + media),
  nginx vhost, git autocommit cron, `scripts/deploy.sh`, `scripts/seed.mjs`.
- Seeded defaults: 4 prop accounts (TakeProfitTrader / Lucid, 25k/50k,
  $1k/$2k drawdown), 6 habits, day-zero journal post.
- Domain live at `https://1ed.ge` behind Cloudflare (proxied DNS, Flexible SSL).
