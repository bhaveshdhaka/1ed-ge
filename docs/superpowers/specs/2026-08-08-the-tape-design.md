# The Tape — merged period recap (design)

**Status: approved (owner, 2026-08-08) → in implementation**

The owner's ask: `/lookback` and the period `/review` surfaces are two pages doing
two halves of one job, and the names are "pedestrian or posh". Merge them into ONE
holistic page — a recap where the whole journey and any single period's full detail
live together. Name: **the tape** (owner-chosen; the brand wordmark is a tape).

## Goal

One page at the existing locked period URLs (`/week`, `/month`, `/q1..q4`, `/h1/h2`,
`/year` + canonical anchors): the deep-dive dossier of a period AND the chronological
arc of every period — "the tape" — above it. `/lookback` is absorbed: the old URL
301-redirects to `/week`; the nav entry becomes `[05] tape`; the words "review" and
"lookback" leave the public copy.

## Design (approved)

### 1. Page anatomy — the existing period route gains the tape

- **Header:** `/ the tape` + days-logged count (was "/ review").
- **Horizon switcher:** the 9 chips (week · month · q1..q4 · h1 h2 · year) stay —
  they choose which tape is shown (each links to the current period of that horizon).
- **THE TAPE** (new): a horizontal ribbon of every period of the selected horizon
  that has data — a chronograph-style ticker in the site's rail language:
  - One small vertical bar per period; bar height ∝ |sumR| relative to the largest
    |sumR| in the tape, capped 28px, min 4px; green (`#4ade80`) when sumR > 0,
    red (`#f87171`) when < 0, dim when 0.
  - The current period is marked (caret + brighter bar).
  - Sparse labels (a label under every 4th–6th bar) + `title`/`aria-label` on every
    bar; native horizontal scroll (`overflow-x`).
  - Every bar is an `<a>` to that period's canonical anchored URL (e.g.
    `/week/2026-33`, `/q1/2026`) — zero-JS, plain SSR links.
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
- `/lookback` → **301 redirect to `/week`** (replace the current `lookback.astro`
  page content with the redirect; the `?type=` query is dropped — the horizon chips
  replace it).
- Nav (`src/components/Nav.astro`): `[05] review` → `[05] tape` (href `/week`);
  `[06] lookback` deleted; renumber models → 06, accounts → 07, about → 08.
- Public copy: the route `<title>` becomes `${range.label} — 1ed.ge` (drop
  "review"); the meta description keeps the numbers and drops "period review".
  `src/lib/copy.ts`: drop `VIEW_REVIEW` and `EMPTY_REVIEWS` if they become unused;
  add the page name (`TAPE = 'the tape'`) where surfaces need it.

### 4. Data + tests

- New pure, tested helper in `src/lib/period-stats.ts`:
  `buildTape(type, days, ctx, todayIso): { label, anchor, sumR }[]` — chronological
  (oldest first), periods with data only, `sumR` per period via `aggregatePeriod`.
- Tests: a multi-period fixture asserting chronological order, the data-only
  filter, and the sumR values (extend `tests/period-stats.test.ts`).
- Route cost: the tape computes one `aggregatePeriod` per period of the horizon
  (~100 for 2 years of weeks) per request — the same cost /lookback already had
  (<50ms, accepted, documented).

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
- Replace: `src/pages/lookback.astro` (→ 301 redirect to `/week`).

## Constraints

- Public pages stay zero-JS (the tape is SSR links + native scroll; the single
  Lightbox script is the only JS exception).
- One engine/one renderer preserved (`buildTape` composes `aggregatePeriod`).
- Commit only own files; no two agents build at once; typecheck + build gate;
  deploy + verify live after (ship-it rule).
