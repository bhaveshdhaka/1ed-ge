# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Mobile nav** — zero-JS hamburger menu on phones replaces the horizontally-scrolling link row; 44px tap targets everywhere (coarse-pointer media query).
- **Day X/730 counter** on the homepage with a progress bar.
- **Journal search + month grouping** — `/journal` is now server-rendered with `?q=` full-text search (title/summary/tags/body/date), a date-jump input, sticky month headers, and a month quick-nav.
- **Prev/next day navigation** on public `/day/[date]` with a "day N of M" indicator.
- **PWA** — `manifest.webmanifest`, service worker (network-first), PNG icons, apple-touch-icon.
- **Admin keyboard shortcuts** — `1–5` tabs, `⌘S`/`⌘⇧S` save / save & rebuild, `⌘←`/`⌘→` prev/next day, `t` today, `?` shortcuts help overlay.
- **Direct-click editing** — evidence-first day values (mood/sleep/screen-time) are edited by clicking the value itself; the tiny ✎ affordance is gone. `Esc` cancels.
- **Day browser upgrade** — native date picker + mini 12-week calendar heatmap + recent days replace the endless flat sidebar list.
- **Expand/collapse all trades** toggle.
- **RebuildBar rework** — collapses to a slim "published" strip when idle; expands with draft changes, elapsed-time progress while building, and a "view →" publish link when a day goes live.
- **Draft vs published indicator** on the day workspace and rebuild bar.
- **Accounts lifecycle stepper** — `eval → buffer → payout` visual flow + failed/paused; the inline new-account form replaces three `prompt()` dialogs.
- **Coach quick prompts** + a collapsible "data f-R-iend sees" trend-snapshot panel.
- **Media library** — search by filename, grouped by date folder, "copied ✓" feedback.
- **Sticky section navigation** on `/performance` and the day workspace.
- **Admin preview route** — `/admin/<secret>/preview/<date>` renders saved-but-unbuilt days and journal reflections server-side (remark/rehype).

### Changed
- Overview "log the day"/"write reflection" merged into one "open today's workspace" action.
- `waitForBuild()` / named event bus topics in the admin API client.
- Safe-area insets on the footer; `prefers-reduced-motion` disables the CRT scanlines and blinking cursor.

### Performance & accessibility pass
- **Logo** — the blinking terminal cursor is replaced by a subtle animated "edge" mark
  (a gradient vertical line that draws in, gently breathes, and glows on hover). No JS.
- **Favicon** — fun 📈 emoji favicon; PWA icons regenerated from it in full color.
- **Brand: `1ed.ge` → `1edge`** — the visible wordmark is now **1edge** (no TLD), with a
  gradient "1", a soft glow, and a gradient edge-line that draws in on load, shimmers
  subtly, and glows on hover. Applied to nav, admin header, footer, and the OG image.
  The blinking `▋` cursor is gone from the hero (`$ whoami` → `> the edge is all we need.`)
  and the tracker.
- **Contrast** — `--color-dim` (#8a8a92) and `--color-faint` (#7e7e86) brightened to pass
  WCAG AA (axe: 295 → 0 critical/serious violations on public pages).
- **Tracker page weight** — 284K → ~40K by dropping the per-cell heatmap `<title>`
  tooltips (2,190 nodes) for a single accessible summary; scroll region is
  keyboard-focusable and charts now carry `aria-label`s.
- **Missing `og.png`** — generated a 1200×630 social card (edge identity).
- **Admin a11y** — date + file inputs labelled, Milkdown editor gets an accessible name.
- **Verification stack** — Playwright E2E (public + admin + axe-core a11y on desktop &
  mobile, 46 tests), Lighthouse CI with a zero-JS budget on public pages, `test:*`
  scripts, and `scripts/audit-a11y.mjs` / `scripts/icon-gen.mjs` / `scripts/og-gen.mjs`.
- `tsconfig` excludes test/report artifacts so `astro check` stays fast and memory-safe.

## [0.4.0] - 2026-08-05

### Added
- **One "day" admin workspace** — the Day Log and Journal tabs merge into a
  single screen per date: capture → day summary → reflection → one Save /
  Save & rebuild.
- **Evidence-first review surface** — the day's structured data renders
  read-only from the AI build (mood, sleep, habits, screen-time, trades); a
  subtle ✎ flips a single value to edit only when the AI erred. No field grids
  by default.
- **Screen-time from the screenshot only** — no manual hour inputs; paste the
  Screen Time screenshot, the AI reads total/social/Mac hours + a note, values
  display with the screenshot as proof (✎ override remains for the rare miss).
- **Compact trade rows** — each trade shows `+R · pts · accounts` with its chart
  thumbnail; expand only to correct fields.
- **AI suggests the reflection** — `structureDayFull` now also returns a journal
  title/summary/tags/first-draft; an **"AI draft from today"** action
  (`draftReflection`) writes a first-draft reflection from the day's data.
- **Public journal posts embed the day strip** — mood · sleep · screen · trades/R
  pulled from the day record above the prose.

### Changed
- Journal schema dropped `mood` (the day record owns structured fields); journal
  is prose + optional title/summary/tags/featuredImage only.
- Admin nav is now overview · day · accounts · coach · media.

## [0.3.0] - 2026-08-05

### Added
- **Save ≠ rebuild** — admin mutations queue a pending change; a sticky
  RebuildBar on every tab lists what will take effect, offers a rebuild button,
  flashes "N changes live" on completion, and keeps a short rebuild history.
- **Day browser** in the Day Log tab — browse every logged day, click to edit,
  prev/next navigation, and **hard-delete** any day (with confirm).
- **Clipboard paste anywhere** — images pasted from the iPhone/Mac clipboard
  route into the day input (global paste sink); dedicated zones still handle
  per-trade and screen-time pastes.
- **AI-first whole-day input** — one "paste your day" zone (free text + any
  screenshots). `structureDayFull` reads everything in full context and returns
  mood, sleep, inferred habits, screen-time, trades with per-account executions,
  plus which screenshot index belongs where (screen-time vs trade charts).
  Qwen2.5-VL for image days, DeepSeek for text-only; identical schema/tone.
- **Screen-time screenshot-first** — paste iPhone/Mac Screen Time screenshot(s),
  the AI reads total/social/Mac hours + a note and attaches the screenshot;
  manual fields remain secondary.
- **Milkdown Crepe journal editor** — replaced the hand-rolled TipTap wrapper
  with the open-source markdown WYSIWYG editor (toolbar, slash menu, tables,
  code blocks, image paste → webp upload). AI title/summary/polish moved beside
  the editor.
- Clearer confirmation toasts; unsaved-changes guard when switching days.

### Changed
- Day/Journal/Accounts/Coach saves no longer auto-rebuild — the user controls
  when to rebuild ("save & rebuild" buttons provided for the quick path).

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
