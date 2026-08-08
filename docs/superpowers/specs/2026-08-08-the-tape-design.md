# The Tape — merged period recap (design)

**Status: shipped — deployed + verified live (2026-08-08).**

The owner's ask: `/lookback` and the period `/review` surfaces are two pages doing
two halves of one job, and the names are "pedestrian or posh". Merge them into ONE
holistic page — a recap where the whole journey and any single period's full detail
live together. Name: **the tape** (owner-chosen; the brand wordmark is a tape).

## Goal

One page at the existing locked period URLs (`/week`, `/month`, `/q1..q4`, `/h1/h2`,
`/year` + canonical anchors): the deep-dive dossier of a period AND the chronological
arc of every period — "the tape" — above it. `/lookback` is absorbed and **deleted — the old URL 404s, no redirect** (owner
2026-08-08: fresh new slate, no old compatibility shims — build it right); the nav
entry becomes `[05] tape`; the words "review" and "lookback" leave the public copy.

## Principle (owner, 2026-08-08)

Progress is day by day, week by week — and slow. The UI must not make the trader
feel that. **Each day counts**, working toward the week, the month, the quarter.
The tape therefore renders progress as a **compounding arc** (a cumulative line
that builds), never as flat per-period marks, and the page carries a **to-date
ladder** (day · week · month · quarter · year) so the current accumulation is
always visible.

## Design (approved)

### 1. Page anatomy — the existing period route gains the tape

- **Header:** `/ the tape` + days-logged count (was "/ review").
- **Horizon switcher:** the 9 chips (week · month · q1..q4 · h1 h2 · year) stay —
  they choose which tape is shown (each links to the current period of that horizon).
- **THE TAPE** (new): the chronological arc of the selected horizon, drawn as a
  **compounding line** — a server-rendered SVG polyline of cumulative R from the
  first data period to now (zero-JS, the site's chart language):
  - One clickable point per period (an `<a>` to that period's canonical anchored
    URL, e.g. `/week/2026-33`); the line connects them — the journey building.
  - Point color by that period's sumR sign (green `#4ade80` / red `#f87171` /
    dim at 0); the line color by the cumulative sign.
  - The **current period is live**: the rightmost point carries the caret +
    "now" marker (the pulsing now-dot language), so the tape extends to the
    present, in progress.
  - Sparse labels along the tape + `title`/`aria-label` per point; native
    horizontal scroll (`overflow-x`) for long horizons.
- **The to-date ladder** (one line under the tape): `day +0.4R · week +2.3R ·
  month +5.1R · quarter +8.4R · year +21.6R` — cumulative R at each horizon
  containing today. Each day visibly feeds the week, the month, the quarter.
- The dossier below, unchanged: period line + prev/next → R centerpiece
  (sumR/expectancy/win rate/PF/trades/traded days) → per-account P&L → per-model →
  life metrics → days chips → trend table → reflection → AI comparison → journal
  entries → stream moments.

### 2. Tape behavior

- The ribbon re-renders per horizon (viewing `/week` → the weeks tape; `/q1/2026`
  → the quarters tape), oldest → newest left to right, current at the right end.
- Only periods with day data appear (same filter /lookback used: `daysCount > 0`).
  A current-but-empty period still renders the dossier empty state; it just has no
  bar yet.
- Empty state unchanged ("no days logged in this period.").

### 3. URL + nav fate

- **No new route.** The merged page lives at the existing
  `[periodType]/[...anchor]` route — all locked URL semantics preserved (bare `/q1`
  = current-year q1; canonical-only public anchors; malformed → 404).
- `/lookback` is **deleted — no redirect** (owner 2026-08-08: fresh new slate, no
  old compatibility shims — the URL simply 404s). The horizon chips replace the old
  `?type=` filter entirely.
- Nav (`src/components/Nav.astro`): `[05] review` → `[05] tape` (href `/week`);
  `[06] lookback` deleted; renumber models → 06, accounts → 07, about → 08.
- Public copy: the route `<title>` becomes `${range.label} — 1ed.ge` (drop
  "review"); the meta description keeps the numbers and drops "period review".
  `src/lib/copy.ts`: drop `VIEW_REVIEW` and `EMPTY_REVIEWS` if they become unused;
  add the page name (`TAPE = 'the tape'`) where surfaces need it.

### 4. Data + tests

- New pure, tested helpers in `src/lib/period-stats.ts`:
  - `buildTape(type, days, ctx, todayIso): { label, anchor, sumR, cumulative }[]`
    — chronological (oldest first), periods with data only; `cumulative` = the
    running sumR (the compounding arc the SVG draws).
  - `toDateLadder(days, todayIso, ctx): { label, sumR }[]` — day · week · month ·
    quarter · year cumulative R for the periods containing today.
- Tests: chronological order, data-only filter, sumR + cumulative values, and the
  ladder's horizon sums (extend `tests/period-stats.test.ts`).
- Route cost: the tape computes one `aggregatePeriod` per period of the horizon
  (~100 for 2 years of weeks) + the 5 ladder aggregates per request — the same
  cost /lookback already had (<50ms, accepted, documented).

### 5. Out of scope

- No writing on the public page (reflections/comparisons are written in zen's
  ReviewTab — the private editor for `reviews/` files stays; its internal
  "reviews" wording is fine, it names the file collection).
- No AI, no new metrics, no changes to the dossier content or the aggregate math.
- The trend table stays (it's the numbers; the tape is the shape).

## Files

- Modify: `src/components/period/PeriodReview.astro` (tape ribbon section + header
  title), `src/pages/[periodType]/[...anchor].astro` (`buildTape` + title/meta
  copy), `src/components/Nav.astro` (tape + renumber), `src/lib/copy.ts`
  (cleanup), `src/lib/period-stats.ts` (`buildTape`), tests.
- Delete: `src/pages/lookback.astro` (no redirect — `/lookback` 404s; fresh slate).

## Constraints

- Public pages stay zero-JS (the tape is SSR links + native scroll; the single
  Lightbox script is the only JS exception).
- One engine/one renderer preserved (`buildTape` composes `aggregatePeriod`).
- Commit only own files; no two agents build at once; typecheck + build gate;
  deploy + verify live after (ship-it rule).
