# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Period reviews — the Sat/Sun ritual, every horizon)

- **One period engine, one review surface.** `src/lib/periods.ts` (week = Mon–Fri trading
  week, month, quarter, half, year ranges + anchors) + `src/lib/period-stats.ts`
  (R/P&L/per-account/per-model/life aggregation over the day files) + a single
  `PeriodReview.astro` — adding a horizon is config, never a rebuild.
- **Clean, canonical URLs.** `/week /month /q1..q4 /h1/h2 /year` (current period) and
  `/week/2026-33`, `/month/2026-08`, `/q1/2026`, `/h1/2026`, `/year/2026` (any specific
  period) via one dynamic route `[periodType]/[...anchor]` (all SSR). Bare `/q1` = q1 of
  the current year (rolling); quarter/half anchors are canonical year-only
  (`/q1/2026-q1` → 404); malformed/nested anchors 404, never 500.
- **`/lookback`** — the aggregated hub of every period review (type filter, newest first,
  headline stats + reflection/comparison snippets).
- **Written per-period review notes** — new `reviews/` collection + `ReviewTab` in zen
  (type/anchor picker, MarkdownEditor write/preview), queued as pending changes like
  every other mutation.
- **AI factual comparison** — "comparison · from verified data": deepseek v4 flash 0731
  formats period-over-period stats + trend into bullets, generated ON DEMAND from the
  admin, editable before publish, stored `reviews/<type>-<anchor>.cmp.md`
  (glob-excluded from the collection); code-rendered fallback when the model fails —
  the page is never blank.
- **Reflection habit + public accountability.** Every Mon–Fri day needs an end-of-day
  reflection (strict 3h grace after midnight HKT); Sat/Sun only the week review. The
  homepage + zen show one compact nudge line when something is due (`trader has 2 days'
  pending end of day reflection · week 31 reflection missing`).
- **zen.** The private area is renamed zen — `/zen/<secret>` (old `/admin/<secret>`
  302-redirects), branded zen, pending reminders greet the owner on login. API paths
  stay `/api/admin/*`.
- **`src/lib/copy.ts`** — single source of every message string (trader / zen /
  reflection vocabulary, live line, pending line, period headers, section labels), the
  same way `strip.ts` owns market phrases.
- **No hardcoded 2-year/730 limits anywhere.** `projectDayNumber()` is uncapped;
  seed-review takes `--days=N`; copy stops framing the site as a two-year experiment.
  The site is the owner's life, not a project.

### Added (Market chronograph — the day at a glance)

- **Chronograph rail** on the market widget — a 00–24 HKT hairline day-ruler with
  hour ticks, event-severity dots (red/orange USD news + session markers), and a
  caret + live `HH:MM:SS` now-marker (no green dot — the marker tells time, not
  status). The rail, dots, and past-state are server-rendered; JS only moves the
  marker/clock and toggles dot classes.
- **mm:ss countdowns** — under 15 minutes the widget/ticker/footer countdowns
  switch from `12m` to `11:32` precision.
- **Every news row is iconed** (emoji fallback when a category has none) and
  **elapsed events are dimmed/struck** for posterity — a past-day archive renders
  fully struck, today's page is fresh on the SSR homepage and lags only until a
  rebuild on static pages.
- **One representative event per time slot** — same-time news rows collapse under
  `+N more at HH:MM` (grouped renderer keeps the severity kind).
- **`mon | 07-aug-2026` day headers** — `fmtDayW` adds the 3-letter weekday to
  day-facing display headers on the stream "today so far" box and the `/day`
  archive header (URL slugs keep `fmtDay`).
- **Homepage "the day" panel** — the day's facts + stream at a glance on `/`.
- **Lightbox hardening** — two null guards in the shared `<dialog>` script
  (missing `.lb-body`, non-Element click targets), and `/day` archive trade
  screenshots now join the lightbox (`data-lb` per trade panel, `target="_blank"`
  retained for no-JS).

### Changed (Moment images — 3-type stream + artefact-linked imagery)

- **Stream moments collapse to `trade | note | quote`** — the `media` moment
  type and the `pre-market` / `post-market` labels are deleted from the schema
  (`content.config.ts`), `src/lib/stream.ts`, the admin API (`days.ts`), the
  `/stream` filter, and the seed script. The `at` time already says when; no
  session labels needed.
- **Images attach to artefacts.** Trades keep `trades[].screenshots[]` (rendered
  wherever the trade shows — archive panel AND trade moments); note/quote
  moments carry `images[]`.
- **Ephemeral capture zone.** The admin day screen reads pasted screenshots with
  the AI (text + vision) and **never uploads them** — truly gone. Screen-time
  values still come from the AI's read.
- **Cheap-model SEO alt text on upload.** New `AI_MODEL_ALT` env (default
  `qwen/qwen-2.5-vl-7b-instruct`) → `captionAlt()` in `src/lib/ai.ts` → sidecar
  `public/media/alts.json` written on upload, removed on delete
  (`src/lib/media-alt.ts`, `/api/admin/media`).
- **Native `<dialog>` lightbox** — `src/components/Lightbox.astro`, the site's
  single zero-JS exception on public pages. MomentCard renders thumbnails with
  `altFor()`; the day-archive screen-time screenshot grid is removed.
- **Test data wiped** — 730 days, 161 journals, accounts/payouts/coach, and
  media uploads are gone. The site starts empty until the owner logs real days.

### Added (Stream System — Phase 3: Public surfaces)
- **Posterized day archive** — `/day/<fmtDay(iso)>` is now a static archive, not a
  cockpit mirror: `DayFacts` strip (mood/sleep/screen/habits/trades/R) + the day's
  published `stream` moments (`MomentCard`) + trade panels that finally show the
  `model` Badge and `commentary` (both were invisible on public pages) + habits
  chips (count-habit aware, active-only) + screen-time proof + USD news + brief +
  reflection + coach. **The cockpit is deleted** — `src/components/cockpit/` (7
  files) is gone; the duplicated points/risk math died with it (R now comes from
  `ROf` in `src/lib/stream.ts` everywhere).
- **`/models` page** — the `models` collection's first public consumer. New
  `src/lib/models.ts` (`buildModelStats`: per-model count/sumR/avgR/winRate/bestR/
  worstR/lastIso across the 712 model-tagged trades) + `/models` rendering each
  model's premise, rules (owner-authored, verbatim), stat cards, and a recent-
  trades table linked to `/day/...`. Nav gains `[05] models` (accounts→06,
  about→07).
- **`/journal` rebuilt on primitives** — the index now uses the Phase-0
  `ui/*` primitives (Card/Badge/Tag/EmptyState/Icon/Separator) and a **lean
  search index**: the `dayText()` full-day-record dump is deleted (index
  142KB→91KB, −36%; page 287KB→277KB). Client-side search behavior preserved
  verbatim (title×3/meta×2/body×1 ranking, `/` focus, `Esc`, sticky month chips,
  `#back-top`, `__jumpDay`). This is the `ui/*` system's first production use.
- **Market day-ruler polish** (homepage) — the "now" marker is a pulsing
  green dot (`.now-dot`, glow ring, 2.2s pulse, reduced-motion safe); hour
  ticks are responsive: every 6h on mobile, 4h at `sm`, 2h at `lg`.

### Added (Stream System — Phase 2: Admin rework)
- **DayWorkspace on stream primitives** (`src/components/admin/tabs/DayWorkspace.tsx`)
  — the day screen now edits the new data model end to end: per-trade `model`
  tag + optional published `commentary`, a **draft reflection** (private,
  `draft.reflection` in the day record) with an explicit **publish reflection**
  button that writes `journal/<date>.mdx`, and a **moment composer** (draft
  moments → `publish →` → `stream`, AI polish that only edits the draft,
  trade/quote/media types). Journal POST moved out of the save path — publish is
  always the owner's explicit action.
- **Merge-on-paste** — `applyStructured` no longer wipes the day: `mergeStructured`
  keeps trades this run didn't touch, replaces trades that share a screenshot
  with the fresh parse, and appends text-only trades.
- **Library tab** (`src/components/admin/tabs/LibraryTab.tsx`) — habits
  (bool/count + target/category/order), trading models (premise + per-model
  rules), rules, and quotes CRUD against the new `/api/admin/library` route.
  Admin nav is now 6 tabs (overview/day/accounts/coach/media/library).
- **Markdown editor swap** — Milkdown Crepe **out**; `MarkdownEditor.tsx`
  (plain textarea + write/preview tabs, unified/remark/rehype rendering, raw
  HTML escaped) replaces `JournalEditor.tsx`. `@milkdown/crepe` removed from
  package.json + lockfile; `editor.css` deleted; axe exclusions dropped.
- **API layer** — `days.ts` POST persists `stream`/`draft`/trade
  `model`+`commentary` and GET returns a `models` list; `content.ts` `Kind`
  extended with `models`/`rules`/`quotes`; new `/api/admin/library` (CRUD) and
  `/api/admin/ping` (heartbeat → `touchLive`, feeds the public "trader is live"
  moniker).
- **Safety** — dirty-guard on admin tab switch (unsaved day work warns before
  leaving), 30s live heartbeat while the admin is open, loud rebuild-failure
  banner (`role="alert"`) in `RebuildBar`, 60s `AbortSignal.timeout` on all AI
  calls, `role="status"`/`aria-live` on toasts, aria labels on nav.

### Added (Context-aware market narrative strip)
- **`src/lib/strip.ts`** — single source of truth for every market phrase the site
  speaks (homepage strip, footer, live ticker). Precomputes absolute-time narrative
  segments per market (CME Globex / Tokyo TSE / London LSE / New York NYSE) with
  conversational countdown phrases (`open · maintenance in`, `on lunch break ·
  back in`, `is live · closing in`, `opens in`, …) plus `fmtHuman` durations
  (`3h 12m` / `1d 03:00`). **Phrases are name-less on purpose** — the surface
  supplies the market name so rows never read "New York · NYSE New York opens in".
  The browser only picks the segment containing "now" and ticks — no phrase logic
  duplicated client-side.
- **Correct market terminology** — the market is **CME Globex** (equity-index
  futures), never "MNQ futures" as a market name (MNQ is the Micro E-mini
  Nasdaq-100 *ticker*, not a market). Widget row + footer + live ticker all say
  `CME Globex`; footer states "CME Globex is the master clock".
- **`NewsBlock.astro`** (zero-JS, shared) — one row per USD event: colored severity
  dot (never the words red/orange), time, full title, `[TV]`/`[FF]` source badge,
  `✦` when verified. Used in the widget details, the footer, `/calendar` and the
  day-page news block.
- **`MarketFooter.astro`** — site-wide footer market narrative on every public page
  (Base layout): CME Globex master line + per-band next transition + next-event
  countdown + `{Name} speaking` line (speaker name matched from red/orange titles
  only), all ticking every second. Expandable `<details>` reveals the full band
  narrative + all news rows. Replaces the old one-line footer ticker.
- **Homepage market strip** — `MarketWidget` embedded under the hero on `/`
  (hero → market strip → today facts → today's stream), and a trader-live moniker
  on `/ today's stream` (same as `/stream`).
- **`newsHeadline(red, orange)`** in `src/lib/market-news.ts` — first red (else
  orange) event summary for the calendar/day-page collapsed chips.

### Changed (Context-aware market narrative strip)
- **`MarketWidget.astro`** reworked onto `strip.ts` segments: narrative rows with
  ticking countdowns + session windows from `daySessionWindows(today)` (fixes TSE
  `08:00–10:30` lunch-break window bug, CME hardcoded `~24h` → `halt 05:00–06:00`),
  next-event + speaker lines with countdowns, news in `<details>` via `NewsBlock`.
  The stacked 24h multi-market bar + country legend are gone — replaced by a single
  hairline day-ruler (00–24 ticks + now-marker); the rows carry all session info
  (no legend to squint at, no repeated country names).
- **`MarketLive.astro`** (footer/ambient live marker) now speaks the CME Globex
  narrative (`● CME Globex open · maintenance in 3h 12m` / `◐ CME Globex on
  maintenance · back in` / `✕ CME Globex closed · reopens in 1d 03:00`) from the
  same `strip.ts` segments.
- **`/calendar` + day-page cockpit news** — `red {time}`/`orange {time}` chips and
  crude grouped lists replaced with `newsHeadline` summary + `NewsBlock` rows. No
  words "red"/"orange" in the UI; severity is shown by the dot color.
- `MarketWidget` CME row label + legend: "MNQ futures" / "futures closed" →
  "CME Globex" / "CME Globex maintenance".
- **TSE afternoon session corrected to 15:30 JST** (was 15:00) — the day window
  now reads `08:00–14:30` HKT; the lunch break and resumption countdowns follow.

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
