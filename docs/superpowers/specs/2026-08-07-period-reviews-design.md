# Period Reviews — Design

**Status: approved (owner, 2026-08-07) → in implementation**

**Owner decisions locked in:** week = **Mon–Fri** (the trading week — trading days are
strictly Mon–Fri, no exceptions; the Sat/Sun ritual reviews the just-completed trading
week; weekend life data flows into month/quarter reviews); each review is a **full
review** (R + P&L + per-account + per-model + life metrics + the period's written review
note + journal/moments narrative); periods carry their own **written review note**; the
page also carries an **AI factual comparison** (deepseek v4 flash 0731) — period-over-
period stats (WoW/MoM/QoQ/HoH/YoY) + a trend, bullet points only, generated ON DEMAND
from the admin, EDITABLE before publish; the owner writes the reflection, the AI writes
the numbers. The site is the owner's life/lifestyle system — the architecture must scale
indefinitely, with zero two-year/730 assumptions: **one period engine + one review
surface**, never bespoke pages.

---

## Goal

A period-review section with clean URLs — `/week`, `/month`, `/q1`…`/q4`, `/h1`/`/h2`,
`/year` (current period, always fresh) and `/week/2026-33`-style anchors for any specific
period (static over the day files). Each page is a posterized review of the period: R
centerpiece + trading stats, per-account and per-model breakdowns, life metrics
(sleep/mood/habits/screen), the period's written review note + its journal entries + stream
moments as the narrative, and prev/next navigation. The Sunday `/week` page is the weekly
ritual; every longer horizon is the same surface with a bigger range.

## Global Constraints

- **Public pages stay zero-JS** — server-rendered SVG + tokens; only the single Lightbox
  script is JS.
- **One engine + one renderer.** Adding a horizon is config, never a rebuild. No bespoke
  per-period pages.
- **R is the centerpiece; math is single-sourced** — period stats compose `ROf`/`riskOf`
  (`src/lib/stream.ts`) and existing stats; never re-implement R.
- **Day record is the spine.** Periods aggregate `days/<date>.md` + `journal/<date>.mdx` +
  `accounts/` + `habits/`; the review note is a new `reviews/` collection.
- **Week = Mon–Fri HKT** (the trading week — Sat/Sun are never trading days, no
  exceptions). Other boundaries: month = calendar, quarter = q1–q4, half = h1/h2, year.
- **Files are the database.** Review notes are git-backed Markdown in `src/content/reviews/`,
  written via the admin (fs + gray-matter), queued as pending changes.
- **No hardcoded 2-year/730 limits anywhere.** The site is the owner's life and
  lifestyle, not a two-year experiment. Day counters, period ranges, and the review
  engine scale indefinitely. The `Math.min(730, …)` clamp in `projectDayNumber()`
  (`src/lib/dates.ts`) is removed; public copy no longer frames the site as a
  two-year project.
- **Unit tests exist now** (`node:test` + tsx, `npm test`) — the period engine + aggregation
  are pure logic and MUST ship with tests.
- **Commit only own files** (`git add <exact paths>`, never `-A`; autosave cron owns
  `src/content/market-news/*.md`; never `.env`). No two agents build at once.

## 1. The period engine — `src/lib/periods.ts` (pure, tested)

```ts
export type PeriodType = 'week' | 'month' | 'quarter' | 'half' | 'year'

export interface PeriodRange {
  type: PeriodType
  anchor: string            // '2026-33' | '2026-08' | '2026-q1' | '2026-h1' | '2026'
  label: string             // 'week 33' | 'aug 2026' | 'q1 2026' | 'h1 2026' | '2026'
  startIso: string          // inclusive, HKT (YYYY-MM-DD)
  endIso: string            // inclusive
  index: number             // 1-based index within the year (week 1..52/53, month 1..12, q 1..4, h 1..2, year 1)
  prev: PeriodRange
  next: PeriodRange
}

export function periodTypeFromSlug(slug: string): PeriodType | null   // 'q1' → 'quarter', 'h1' → 'half', else slug itself when valid
export function periodRange(type: PeriodType, representativeIso: string): PeriodRange  // representativeIso = any date inside the period
export function periodAnchor(type: PeriodType, iso: string): string   // period identifier: '2026-33' | '2026-08' | '2026-q1' | '2026-h1' | '2026'
export function isoFromAnchor(type: PeriodType, urlAnchor: string): string  // URL anchor → representative ISO inside the period:
                                                                       // week '2026-33' → the Monday of week 33; month '2026-08' → 2026-08-01;
                                                                       // quarter '2026' → 01-feb-2026; half '2026' → 01-apr-2026 (h1) / 01-oct (h2);
                                                                       // year '2026' → 2026-01-01. Throws on malformed anchors.
export function periodRangesBetween(type: PeriodType, fromIso: string, toIso: string): PeriodRange[]  // for getStaticPaths
```

URL ↔ range flow: `/q1/2026` → `periodTypeFromSlug('q1')` + `isoFromAnchor('quarter','2026')` →
`periodRange('quarter', iso)` → `anchor '2026-q1'`, `label 'q1 2026'`. File names for review
notes use `periodAnchor` (`quarter-2026-q1.md`). Rules: week = **Mon–Fri** (the trading
week — trading days strictly Mon–Fri, no exceptions; the Sat/Sun ritual reviews the
just-completed Mon–Fri week; weekend day records fall outside every week and flow into
month/quarter reviews); month = calendar month; quarter = q1 (Jan–Mar)…q4; half =
h1 (Jan–Jun)/h2; year = calendar year. `prev`/`next` step by one period.

## 2. Aggregation — `src/lib/period-stats.ts` (pure, tested)

```ts
export interface PeriodStats {
  daysCount: number          // days in range with a day record
  tradedDays: number
  trades: number
  sumR: number
  expectancyR: number        // sumR / trades
  winRate: number            // wins / trades (R > 0)
  profitFactor: number       // grossWin / grossLoss (R-based)
  pnlByAccount: { account: string; pnl: number }[]      // $, via executions × pointsValue
  modelStats: { model: string; count: number; sumR: number }[]
  avgSleep: number | null
  avgMood: number | null
  habitAdherence: { habit: string; pct: number }[]      // active habits only
  avgScreenHours: number | null
}

export function aggregatePeriod(
  days: DayData[],
  range: PeriodRange,
  ctx: { habits: { id: string; kind: 'bool' | 'count'; target?: number }[]; accounts: { id: string; pointsValue: number }[] },
): PeriodStats
```

Composes `ROf`/`riskOf` for R; `pointsValue` from account config for $ P&L; the habits
heatmap rules for adherence (bool: pct of days true; count: pct of days ≥ target).

## 3. The review note — `src/content/reviews/` collection + admin surface

- New collection `reviews` in `src/content.config.ts`: glob `src/content/reviews/*.md` with
  schema `{ type: PeriodType, anchor: string, title?: string, date: string }` + MDX body
  (prose — the written week-in-review). File name = `<type>-<anchor>.md` (e.g.
  `week-2026-33.md`).
- Admin: a small "period review" editor — reuse the `MarkdownEditor` component + a new
  `src/pages/api/admin/reviews.ts` (GET a review by type+anchor, POST save via
  `writeEntry('reviews', ...)` + `addChange`). The editor surface lives in the admin
  (a compact section; matching the existing editor patterns). AI-draft-from-period is a
  future nicety, not v1.
- Public: `PeriodReview.astro` renders the note (prose) when present; otherwise a quiet
  empty state.

## 4. The review surface + routes

- **`src/components/period/PeriodReview.astro`** — one posterized review surface:
  - Header: period label + date range via `fmtDayW` (`mon | 03-aug-2026 → sun | 09-aug-2026`),
    prev/next period links, and a period-type switcher (week · month · q1–q4 · h1/h2 · year).
  - R centerpiece: sumR, expectancy, win rate, profit factor, trades, traded days.
  - Per-account P&L table; per-model table (reuse `buildModelStats` shape or aggregate).
  - Life metrics: avg sleep, avg mood, habit adherence %, avg screen hours.
  - Narrative: the period's review note (if any) + the period's journal entries
    (title/summary/draft links) + its stream moments (MomentCard list).
  - A period mini-timeline (day ruler over the range) — reuse the chronograph language.
  - Zero-JS; tokens + primitives only.
- **Routes** — ONE dynamic route file `src/pages/[periodType]/[[anchor]].astro`:
  - Static top-level routes (`/stream`, `/calendar`, …) take precedence, so the dynamic
    segment only catches period slugs; validate `periodType` against the enum else 404.
  - `[[anchor]]` absent → current period (`todayHkt()`), `prerender = false` (fresh).
  - `[[anchor]]` present → `getStaticPaths()` over `periodRangesBetween` of the existing
    day files (first day → today), static.
  - `/week` is the nav entry: add `[0N] review` to the nav → `/week`.
- Every period type has the same URL shape: `/week`, `/week/2026-33`, `/month/2026-08`,
  `/q1/2026`, `/h1/2026`, `/year/2026` — 10 thin pages via the one dynamic route.

## 5. Data flow

`getCollection('days')` (+ habits + journal + accounts) → filter by `startIso`..`endIso` →
`aggregatePeriod` → `PeriodReview.astro`. SSR for the current period (fresh each request),
static for anchored past periods (rebuilt on deploy/content change — same as the day
archive). The review note is read via the `reviews` collection (or fs for the admin).

## Out of scope (v1)

- AI-drafted review notes (future nicety).
- `/all` (lifetime view) — the engine handles it later as a one-line addition.
- Notifications/email of the weekly review.
- The `ingest` feature (separate approved plan — queued behind this).

## 6. AI factual comparison (owner-locked, 2026-08-07)

The period page ALSO carries an AI-generated factual comparison — the owner writes the
reflection, the AI writes the numbers.

- **Division of labor:** the deterministic stats (aggregatePeriod) ALWAYS render and are
  never AI-dependent. The AI comparison is a **stored, on-demand, editable** artifact per
  period: `reviews/<type>-<anchor>.cmp.md` (plain markdown bullets), generated by a
  "generate comparison" action in the admin ReviewTab (the Sat/Sun ritual), editable
  before publish, regenerable (overwrite).
- **The AI is a formatter over verified numbers** (the site's no-gyaan rule): model =
  `deepseek/deepseek-v4-flash-0731` (reuse `AI_MODEL_INGEST`). Input = current
  `PeriodStats` + previous-period `PeriodStats` + a deterministic `trendSeries`
  (computed in code: last N periods of sumR/winRate/trades). Prompt: bullet points,
  numbers only, deltas (WoW/MoM/QoQ/HoH/YoY), the trend read from the series, NO advice,
  NO speculation, NO numbers not present in the input.
- **Storage:** the `reviews` collection glob MUST exclude `**/*.cmp.md` (negative glob);
  comparison files are read/written via fs (admin + the period page reads at build/SSR).
- **Fallback:** if the model call fails, the page still shows the code-rendered
  comparison bullets (periodDelta + trend rendered as text) — never a blank section.

## Out of scope (v1) — amended

- Auto-generation on period end (on-demand only, owner-locked).
- Email/notification of the weekly review.
- `/all` (lifetime view) — the engine handles it later as a one-line addition.
- The `ingest` feature (separate approved plan — queued behind this).

## 7. Reflection habit + public accountability (owner-locked, 2026-08-07)

The owner's nightly ritual: a short end-of-day reflection (how the day went, plan/outlook
for the next day, lessons learned) — a WRITING HABIT, not trade logging. The system holds
him publicly accountable, gently.

- **Day reflection is REQUIRED every Mon–Fri, even on zero-trade days.** It is the day's
  journal post (the day screen's "publish reflection" → `journal/<date>.mdx`). Sat/Sun are
  relaxed — no day reflection due; the only weekend obligation is the week review.
- **Grace: strict 3 hours after midnight HKT.** Day X's reflection is due by 03:00 HKT on
  day X+1. No more. After that it counts as pending.
- **Period reflections** (week/month/quarter/half/year) = the review notes
  (`reviews/<type>-<anchor>.md`). A COMPLETED period with no note is pending after its
  grace (week due Mon 03:00 HKT after the Mon–Fri week; month/quarter/etc. due 3h after
  the period ends).
- **The accountability engine** (`src/lib/accountability.ts`, pure + tested):
  `accountabilityStatus(days, journalDates, reviews, now)` → `{ pendingDays, pendingPeriods }`
  where `pendingDays` = count of Mon–Fri days past their grace with no journal post, and
  `pendingPeriods` = completed periods past grace with no review note. Facts only.
- **Homepage nudge — ONE compact line** in the live-moniker zone: online → "trader is
  live"; offline → "offline · last seen N days ago" (durable last-online stamp, gitignored
  state file in the bind-mounted media dir — /tmp resets on restart and would lie); plus
  the pending line when due ("trader has 2 days' pending end of day review · week 31
  reflection missing"). Not acrimonious.
- **zen.** The private admin area is renamed **zen** — URL `/zen/<secret>` (was
  `/admin/<secret>`; redirect the old path), UI labels say zen, and **zen shows the same
  pending reminders** (so the nudge greets him on login, not just on the public homepage).
  The internal API paths (`/api/admin/*`) stay as-is (private, not user-facing).

## Out of scope (v1) — amended again

- Fortnight cadence (owner decision: skip — the engine makes it a one-line add later).
- Email/notification of the weekly review.
- `/all` (lifetime view).
- The `ingest` feature (separate approved plan — queued behind this).
