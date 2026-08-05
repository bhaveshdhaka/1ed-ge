# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project scaffolding: `AGENTS.md`, `MEMORY.md`, `.opencode/` config, commands,
  and content-editor agent; `.editorconfig`; versioned `CHANGELOG.md`.

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
