# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Stream System — Phase 3: Public surfaces, first chunks)
- **Homepage de-cockpitted** — `/` is now an SSR page: permanent intro hero
  (what this is, R is the only metric, everything public) + today's facts strip
  + today's published stream. The cockpit mirror (rails, static quotes,
  self-talk) no longer renders publicly.
- **`/stream` added** — SSR rolling feed of all published moments, latest-first
  across days, zero-JS `?type=` category filter, "today so far" digest, live
  moniker (admin heartbeat). New nav entry `[01] stream`.
- **Stream primitives** — `src/lib/stream.ts` (`resolveMoments`/`flattenStream`/
  `dayFacts`/`momentMeta`) + zero-JS `src/components/stream/{MomentCard,DayFacts}`.
- **Live presence** — `src/lib/live.ts` reads the admin heartbeat
  (`/tmp/1edge-live.json`, 5-min window); `/stream` and `/` show trader-live state.

### Changed (Stream System — CME is the master clock)
- **Day status now follows CME equity-index futures, not NYSE cash.** New
  `cmeDay()` in `src/lib/market.ts` — the US-centric CME calendar (totally
  closed only on New Year's, Good Friday, Juneteenth, July 4, Thanksgiving,
  Christmas + weekends; MLK/Presidents/Memorial/Labor are normal CME days).
  `scheduledDayMarker`/`marketMarker` are CME-based; CME early-close days
  (day after Thanksgiving, Christmas Eve, New Year's Eve) read `1:15pm ct`.
- **CME closed ⇒ everything closed.** `marketEvents` suppresses NYSE/TSE/LSE
  session bands entirely on CME-total-close days; cash bands still render on
  CME early-close days.
- **Footer live ticker** (`MarketLive.astro`) is driven by the CME event stream
  (open/halt/reopen), not the NYSE 9:30–16:00 ET session.

### Added (Stream System — Phase 1: Data model + credible review data)
- **Content schema extended** (`content.config.ts`): day records gain `stream: []`
  (approved moments: `pre-market|post-market|trade|note|quote|media` with `at`/
  `tradeIdx`) and `draft:` (private reflection + draft moments, never rendered
  publicly); trades gain `model` tags + optional `commentary`; `habits` accept
  `bool|number`; new `models` collection (name/premise/rules/status/order);
  account lifecycle adds `funded` (`eval → funded → buffer → payout`).
- **Trading models shipped** — `src/content/models/`: orb-drive, pullback-
  continuation, vwap-reclaim, liquidity-breakdown, each with owner-authored
  model rules (two-level rules: overall `rules/` + per-model).
- **Habits v2** — schema supports `kind: bool|count`, `target`, `category`,
  `order`, `active`. 14 habits across health/trading/discipline/mind seeded
  (count habits store numbers). Colors moved off the old bright palette.
- **Review data regenerated** (`scripts/seed-review.mjs` rewritten) — a
  self-consistent two-year dataset: positive edge (expectancy +0.28R, PF 1.57,
  55% WR), **no trades on US holidays** (verified against the site's own
  `marketDay()`), losses honor the stop (~1R, rare small slippage, wins
  uncapped), **every trade tagged with a model**, journal prose generated from
  actual day data (no "one trade" vs two, no "long" vs short, no `++`), account
  lifecycle **derived from the simulated equity** so payouts can never exceed
  net (lucid-25k-a: +$3137 gross → $1500 paid in `payout`; tpt-25k-a:
  −$1280, **failed** 2026-11-02 with a matching post-mortem post), one day-zero
  only. One execution assignment drives both the day files and the account
  math (single source of truth).

### Added (Stream System — Phase 0: Design System Foundation)
- **Tokenized design system.** `src/styles/global.css` → `src/styles/app.css`:
  summit palette moved into the Tailwind v4 `@theme` block (dead theme-override
  mechanism removed), full type scale (`text-3xs`…`text-5xl` + `text-quote`),
  weight/leading/tracking tokens, tokenized `::selection` and timeline bands.
  Purged ~60 lines of dead CSS (`.mono-up`, `.ck-drop`, `.sticky-subnav`,
  `@keyframes blink`, `.hero-fade`, phantom `--font-display`, `--glow`,
  `--accent2`, `--chart-empty`). `:where(h1..h4)` zero-specificity base.
- **Zero-JS Astro UI primitives** — `src/components/ui/`: `Button`, `Card`,
  `Badge`, `Table`, `StatCard`, `Tag`, `Separator`, `Dot`, `Quote`, `Field`,
  `Input`, `Textarea`, `EmptyState`, `Icon` (Lucide inline SVG), `Flag`.
- **Admin React primitives** — `src/components/ui/react/`: Radix `Dialog`,
  `Tooltip`, `Select`, `Tabs`, `Checkbox`, `Toast` + cva `Button` + `cn`
  (`clsx` + `tailwind-merge`). Admin `ui.tsx` re-skinned on tokens.
- **Design-system skill** — `.opencode/skills/design-system/SKILL.md`: the
  token/primitive/zero-JS/owner-content contracts agents must follow (no
  arbitrary `text-[..px]`, no hardcoded colors, no raw buttons, no AI
  rules/quotes/gyan).
- **Deps added:** `@radix-ui/react-*` (dialog/tooltip/select/tabs/checkbox/
  toast), `class-variance-authority`, `tailwind-merge`, `lucide-react`,
  `lucide-static`.
- **fix(a11y):** 8–9px timeline labels brightened to `--color-soft` — WCAG AA
  restored (was the one regression the new e2e caught).
- Docs: Stream System design spec
  (`docs/superpowers/specs/2026-08-07-stream-system-design.md`) + Phase 0 plan.


- **The day page is now the cockpit** — `/` and `/day/<date>` render a
  three-column command center: ambient top strip with a **24h HKT timeline**
  (session bands for CME/TSE/LSE/NYSE, now-marker, hazard dots), a left rail
  (rules · quotes · habits · self-talk · coach link), a center **writing
  surface** (title, data cells, prose, flat-line), and a right rail (extract
  drop zone · today's record · hazard line). Zero-JS, server-rendered.
- **Muted palette + mono-only type** — bright green/red → muted sage/clay;
  Newsreader dropped; JetBrains Mono everywhere. WCAG-AA contrast verified.
- **Homepage = today** — the dashboard salad is gone; `/` is the cockpit for
  the current day.
- **Nav 9 → 6** — `today · journal · calendar · performance · accounts ·
  about`. `/tracker` + `/trends` merged into `/performance`, pages deleted.
- **New content collections** `rules` + `quotes` (left-rail grounding) and a
  `cockpit.json` config (self-talk).
- **New timeline lib** `src/lib/timeline.ts` — pure 24h HKT ruler builder from
  the sessions engine.
- **Hazard dots** — 6px clay dots at event times (dim; the 30-minute pulse
  arrives with the live layer, P2).
- Test suite green: 68/68 e2e (fixed a stale SSR-journal-search test to match
  the client-side search), a11y 0 violations, `astro check` 0 errors.

### Added
- **Statement-driven accounts (P3)** — paste a prop-firm statement screenshot in
  the admin → AI (vision) proposes `firm / size / equity / buffer / stage /
  payout / note`, you review in a confirm panel, then "apply" writes it: fills
  the account, appends a stage change to its lifecycle history, and logs any
  detected payout. No manual trade typing — matches the screenshot-first rule.
- **Daily pre-market brief (P4)** — the admin Overview has a "daily brief" card:
  "AI draft" builds a deterministic snapshot (today's sessions + red/orange news
  with HKT times + your most recent day's R/mood/sleep) and the LLM writes a
  ~120-word brief from it — the AI only writes prose, every number is verified.
  Save stores `src/content/brief/<date>.md`; rendered on the homepage and the
  day page. Public pages show it only when a brief exists for that date.
- **Holiday refinements** — Japan substitute-holiday rule now handles chains
  (e.g. Golden Week May 3 Sunday → May 6), verified across 2026–2028; UK
  Christmas/Boxing weekend shifts verified.

### Added
- **Market widget v2 (session ticker)** — redesigned as a professional market
  box: mono typography (kills the serif `h2` bug), per-market **flags**
  (🇺🇸 🇯🇵 🇬🇧, 📈 futures), **HH:MM:SS countdowns ticking every second**
  (`tabular-nums`, no jitter), rows **re-sorted live by next event time in
  HKT**, and a **day timeline** bar (00–24 HKT with per-market session spans +
  a moving "now" marker). Labels only say `to close / to open / to reopen` —
  no "maintenance halt" text. All times HKT, DST-aware.
- **Context-aware market markers** — the green ● open now appears **only when
  the market is actually open now**. Other dates show a scheduled indicator
  (`○ open 21:30→04:00 hkt` for a future trading day, `✕ closed · holiday/
  weekend`, `◐ early close`), so future day pages / calendar rows never fake a
  live "open". `src/lib/sessions.ts` `scheduledDayMarker()`.
- **News de-noised** — same-time events **collapse into one row** (e.g.
  `🛒 20:30 · Inflation Rate YoY · Core Inflation MoM`), each row gets a
  relevant **emoji** per release type (🛒 CPI/inflation, 🛢️ crude/EIA,
  💼 jobs/payrolls, 🗣️ Fed, 🏠 housing, 🛍️ retail, …). `newsEmoji()` +
  `groupNewsByTime()` in `src/lib/market-news.ts`.
- **Calendar cleaned up** — day cards now lead with the news (grouped, emojis),
  a compact session-window line (`🇺🇸 21:30→04:00 · 🇯🇵 08:00–14:00 · …`) via
  `daySessionWindows()`, and no `+1d`/verbose event rows.
- **Market widget (one-glance market box)** — `src/components/MarketWidget.astro`,
  embeddable anywhere (homepage, day pages, calendar, admin-ready). Shows live
  US status + countdown, per-market sessions with live countdowns, and today's
  news. All times HKT, DST-aware.
- **Session engine (`src/lib/sessions.ts`)** — deterministic CME/TSE/LSE/NYSE
  session times in HKT with full DST handling via `Intl`:
  - CME futures daily maintenance halt 05:00–06:00 HKT (summer) / 06:00–07:00
    (winter), weekend close + Sunday reopen.
  - NYSE 21:30→04:00+1 (EDT) / 22:30→05:00+1 (EST); half-day close 13:00 ET.
  - TSE 08:00–10:30 · 11:30–14:00 HKT (lunch break), Japan holidays.
  - LSE 15:00→23:30 (BST) / 16:00→00:30+1 (GMT), UK bank holidays.
  Verified against DST transition dates (Jan/Oct/Mar) and weekend breaks.
- **Week-view `/calendar`** — the next 8 days in HKT: session times per market,
  market status marker, and red/orange news. Linked in the nav ([02]).
- **Zero-inference news rule** — every news row now displays verbatim from the
  source that reported it, labeled `[TV]` / `[FF]`, with `✦` when the other
  source independently confirms the same time-slot (±2 min). No level/title
  merging — if the sources disagree you see both rows. Applies to the day page
  strip, the widget, the calendar, and the admin market card.
- **Live market status with countdown** — every public page footer, the homepage
  and day pages (and the admin) show the US market state in real time:
  `● open — closes in 3h 12m` / `✕ closed · holiday/weekend`, half-day close at
  1:00pm ET. The countdown ticks client-side from a deterministic US-bank-holiday
  + early-close schedule (`src/lib/market.ts` `marketSchedule()`), the same
  rules the static ●/◐/✕ markers use.
- **USD news calendar (red/orange) in HKT** — `src/content/market-news/<date>.md`
  holds high-impact (red) and medium (orange) USD events with HKT times.
  Primary source: TradingView economic calendar (importance `1`→red, `0`→orange);
  secondary: Faireconomy this-week JSON. An event is `verified` only when the
  other source has a match in the same ±2min UTC bucket. Fully deterministic —
  no AI in the data pipeline. Day pages show a `USD news · HKT` strip, the
  homepage shows today's first red event, and the admin day workspace has a
  market card with `↻ refresh news` (`POST /api/admin/market` runs fetch+rebuild).
- **`scripts/market-news-fetch.mjs`** — fetches both sources, merges, writes the
  day files, prunes older than 14 days, rebuilds. Runs on deploy and via an
  **8h cron** (`docker exec 1edge-site …`).
- **Unified day page** — `/day/<dd-mon-yyyy>` is now one page per date covering
  every kind of content (days ∪ journal ∪ coach): data → habits → screen proof →
  trades → /reflection → /coach, with hairline empty states ("no journal entry /
  no coaching session this day") and `← /journal · /coach →` breadcrumbs.
- **US market status** (`src/lib/market.ts`) — deterministic holidays (observed
  day shifts, Good Friday via Easter), early closes, weekends. Day pages + the
  homepage show `● open / ◐ early close / ✕ closed · holiday`.
- **Journal search rewritten client-side** — `/journal` embeds an inline JSON
  index (title/meta incl. linked day-record text/body) and filters instantly:
  tokenize AND with word-boundary prefix, digit→substring, ranked
  title+3/meta+2/body+1, flat clone-list while searching. `/` focuses, `Esc`
  clears. Sticky month-chip strip (h-scroll) + back-to-top ↑ after 400px.
  The old `/api/journal/search` endpoint is deleted.
- **`src/lib/dates.ts`** — `fmtDay('2026-08-03') → '03-aug-2026'`, `parseDay`
  reverse, `isIsoDay`.

### Changed
- **Public day URLs are now `dd-mon-yyyy`** — every `/day/<iso>` link repointed
  (home, journal, rss, performance, tracker, admin preview, day nav, RebuildBar,
  day workspace "view live"). The old `/journal/<id>` post pages are gone (the
  site isn't launched yet — no redirects, no legacy routes).
- **Tracker last-7 grid** — only days with a record link to `/day/<fmt>`; the
  rest render dimmed non-links (no more 404 hops).

### Changed
- **Brand: one fixed wordmark instead of per-theme marks.** The logo is now a
  font-only lockup — JetBrains Mono **1** + Syne **edge** + trailing soft `_`,
  pure monochrome, with a slow tape-scan sheen and a once-flash/pulse on the
  underscore (the "baseline tape" concept, v06). Same logo on every theme, in
  the nav, and in the admin header. Nav wordmark bumped 18px → 22px.
- Generated graphics now rasterize via **sharp/librsvg** (scripts/lib/brand.mjs)
  instead of headless Chromium, which mis-rasterized large text here. Shared
  helpers drive `favicon.svg` (vector, embedded fonts — also the master logo),
  PWA icons, and `og.png`.

### Added
- **Summit-only** — aurora and mono are gone. One fixed identity (starry sky,
  mountain ridge, Newsreader display over mono data, ice-blue accent). The admin
  design tab, `/api/admin/theme`, and the theme-preview route are removed; the
  site ships a single skin.
- **Theme-aware data viz** — chart SVGs (EquityCurve, RHistogram, Heatmap,
  CorrTable) use CSS-variable tokens (`--color-up/down`, `--chart-grid`,
  `--chart-alt`) instead of hardcoded hex.
- **Heatmap DOM optimization** — empty (null) habit cells no longer render a
  `<rect>` (365×6 cells → only the days actually logged), a large perf win on
  /tracker.
- **Hero entrance** — a soft 0.7s fade + 6px rise on the homepage hero.

### Changed
- Charts/UI a11y: scrollable table wrappers on /performance, /trends,
  /accounts, /about are now keyboard-focusable (`tabindex`), fixing
  `scrollable-region-focusable` axe violations on mobile.
- e2e: admin tests wait for React hydration before pressing keyboard shortcuts;
  theme SVG counts and pending-change state are handled robustly; 68/68 green.
- lighthouserc: `chromePath` moved to `collect.chromePath` (was silently ignored
  inside `settings`); LHCI now finds Chrome and runs clean.
- Nav/admin logo is a shared `Brand.astro` (the fixed 1edge wordmark);
  `ThemeBackground.astro` renders the summit background in `Base.astro`.
- `theme-color` meta follows the summit palette.
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
