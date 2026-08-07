# Period Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A period-review section with clean URLs — `/week`, `/month`, `/q1`…`/q4`, `/h1`/`/h2`, `/year` (current, SSR) and `/week/2026-33`-style anchors (static) — each a posterized full review (R + P&L + per-account + per-model + life metrics + the period's written review note + journal/moments narrative), plus a written per-period review note surface. No hardcoded 2-year/730 limits anywhere.

**Architecture:** One pure period engine (`src/lib/periods.ts`) + one aggregation lib (`src/lib/period-stats.ts`) + one `PeriodReview.astro` surface + ONE dynamic route `src/pages/[periodType]/[[anchor]].astro` (static top-level pages take precedence; unknown slugs 404). Written notes live in a new `reviews/` content collection (MDX prose) with a small admin editor tab. Composes the existing single-sourced R math; zero-JS; horizon-agnostic (the owner's site is their life, not a two-year experiment).

**Tech Stack:** Astro 5 (static + per-route SSR), React admin (MarkdownEditor pattern), `node:test` + tsx (the runner added this session), existing tokens/primitives.

## Global Constraints

- **NO hardcoded 2-year/730 anything.** `projectDayNumber()` loses its 730 clamp; copy stops framing the site as a two-year experiment; the engine/aggregation scale indefinitely.
- **Public pages stay zero-JS** — server-rendered SVG/tokens; only the single Lightbox script is JS.
- **One engine + one renderer.** Adding a horizon is config, never a rebuild.
- **R is the centerpiece; math single-sourced** — period stats compose `ROf`/`riskOf` (`src/lib/stream.ts`), never re-implement R.
- **Week = Mon–Sun HKT.** Boundaries from plain `YYYY-MM-DD` strings (no TZ math).
- **Files are the database.** Review notes = git-backed Markdown in `src/content/reviews/`, written via admin (fs + gray-matter), queued as pending changes.
- **Unit tests exist now** (`npm test`) — the engine + aggregation MUST ship with tests.
- **Commit only own files** (`git add <exact paths>`, never `-A`; autosave cron owns `src/content/market-news/*.md`; never `.env`). No two agents build at once (controller typechecks centrally between waves).

---

### Task 1: De-hardcode the 2-year (logic + copy)

**Files:**
- Modify: `src/lib/dates.ts` (`projectDayNumber` clamp)
- Modify: any consumer of `projectDayNumber` (grep — the homepage day counter; remove any `/730` display)
- Modify: `scripts/seed-review.mjs` (`DAYS = 730` → CLI arg)
- Modify: `src/pages/index.astro`, `src/pages/about.astro`, `src/pages/rss.xml.ts`, `src/layouts/Base.astro` (copy de-emphasis)
- Test: `tests/dates.test.ts`

**Interfaces:**
- Produces: `projectDayNumber(now?: number): number` — no 730 cap; optional `now` param for testability. Nothing else changes.

- [ ] **Step 1: `src/lib/dates.ts`**

```ts
/** Day number since project start, uncapped — the site is the owner's life, not a 2-year experiment. */
export function projectDayNumber(now: number = Date.now()): number {
  return Math.max(1, Math.floor((now - PROJECT_START.getTime()) / 86400000) + 1)
}
```

(Remove `Math.min(730, …)`. Keep `PROJECT_START` — the day-zero anchor is fine; the 730 CAP is the hardcode to delete.)

- [ ] **Step 2: Consumers**

`grep -rn "projectDayNumber" src/` — find the homepage counter (and any other use). If it renders `/730` or a 730 total, remove the total (display just the day number, e.g. "day 127" or the existing format minus the cap). Match on code.

- [ ] **Step 3: `scripts/seed-review.mjs`**

Replace `const DAYS = 730` with a required CLI arg:

```js
// Filler-day count. Site logic must never hardcode a period length — pass --days=N explicitly.
const DAYS_ARG = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1])
if (!Number.isInteger(DAYS_ARG) || DAYS_ARG <= 0) {
  console.error('usage: node scripts/seed-review.mjs --days=N')
  process.exit(1)
}
const DAYS = DAYS_ARG
```

- [ ] **Step 4: Copy de-emphasis** (owner-flagged, wording vetoable — change the meaning, keep the voice)

- `src/pages/index.astro` description + hero: drop the leading "Two years," → "Everything public. Every trade, every account, every R — live and uncensored, the misses included." / "…the misses included. R is the only metric that matters."
- `src/pages/about.astro`: timeline item `{ d: 'now', t: 'two years of public trading' }` → `{ d: 'now', t: 'every day, public' }`; description "The two-year public proof:" → "The public proof:"; "so for two years, everything goes public." → "so everything goes public."
- `src/pages/rss.xml.ts` + `src/layouts/Base.astro` meta description: "A two-year public trading experiment." → "A public trading journal."

- [ ] **Step 5: `tests/dates.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectDayNumber } from '../src/lib/dates'

test('projectDayNumber starts at 1 on day zero', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z')), 1)
})
test('projectDayNumber is NOT capped at 730 (no two-year hardcode)', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z') + 900 * 86400000), 901)
})
test('projectDayNumber floors at 1', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z') - 86400000), 1)
})
```

(Check `PROJECT_START`'s exact value in dates.ts first — it may be `2026-08-05T00:00:00Z`; adjust the fixture to match.)

- [ ] **Step 6: Verify**

`npm test -- tests/dates.test.ts` → 3/3 pass. `grep -rn "730\|two-year\|two years\|2-year" src/ scripts/ --include='*.ts' --include='*.astro' --include='*.tsx' --include='*.mjs'` → only the `--days` usage/comment in seed-review remains.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dates.ts scripts/seed-review.mjs src/pages/index.astro src/pages/about.astro src/pages/rss.xml.ts src/layouts/Base.astro tests/dates.test.ts
git commit -m "feat: no two-year hardcodes — day counter uncapped, seed-review --days arg, copy de-emphasized"
```

---

### Task 2: The period engine — `src/lib/periods.ts` + tests

**Files:**
- Create: `src/lib/periods.ts`
- Test: `tests/periods.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (Tasks 3/5 rely on these exact signatures):

```ts
export type PeriodType = 'week' | 'month' | 'quarter' | 'half' | 'year'
export interface PeriodRange {
  type: PeriodType
  anchor: string            // '2026-33' | '2026-08' | '2026-q1' | '2026-h1' | '2026'
  label: string             // 'week 33' | 'aug 2026' | 'q1 2026' | 'h1 2026' | '2026'
  startIso: string          // inclusive YYYY-MM-DD (HKT date)
  endIso: string            // inclusive
  index: number             // 1-based within the year
  prev: PeriodRange
  next: PeriodRange
}
export function periodTypeFromSlug(slug: string): PeriodType | null   // 'q1'→'quarter', 'h1'→'half', valid type names pass through
export function slugFromType(type: PeriodType, index: number): string // 'quarter',1 → 'q1'
export function periodRange(type: PeriodType, representativeIso: string): PeriodRange
export function periodAnchor(type: PeriodType, iso: string): string
export function isoFromAnchor(type: PeriodType, urlAnchor: string, index?: number): string
export function periodRangesBetween(type: PeriodType, fromIso: string, toIso: string): PeriodRange[]
```

- [ ] **Step 1: Date helpers** (plain-ISO arithmetic, no TZ)

```ts
const DAY_MS = 86400000
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseIso(iso: string): Date { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
function toIso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(iso: string, n: number): string { return toIso(new Date(parseIso(iso).getTime() + n * DAY_MS)) }
function pad(n: number): string { return String(n).padStart(2, '0') }
function mondayOf(iso: string): string { const d = parseIso(iso); return toIso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS)) }
function isoWeekNumber(iso: string): number {
  const d = parseIso(iso)
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAY_MS)
  const y = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const week1Thu = new Date(jan4.getTime() + (3 - ((jan4.getUTCDay() + 6) % 7)) * DAY_MS)
  return 1 + Math.round((thursday.getTime() - week1Thu.getTime()) / (7 * DAY_MS))
}
function lastDayOfMonth(y: number, m: number): number { return new Date(Date.UTC(y, m, 0)).getUTCDate() }  // m = 1..12
function shiftMonth(iso: string, n: number): string { const [y, m] = iso.split('-').map(Number); return toIso(new Date(Date.UTC(y, m - 1 + n, 15))) }
```

- [ ] **Step 2: `periodRange`**

```ts
export function periodRange(type: PeriodType, representativeIso: string): PeriodRange {
  const [y, m] = representativeIso.split('-').map(Number)
  const base = (startIso: string, endIso: string, anchor: string, label: string, index: number): PeriodRange => {
    const rep = (dir: number): string => {
      switch (type) {
        case 'week': return addDays(startIso, dir * 7)
        case 'month': return shiftMonth(startIso, dir)
        case 'quarter': return shiftMonth(startIso, dir * 3)
        case 'half': return shiftMonth(startIso, dir * 6)
        case 'year': return `${y + dir}-06-15`
      }
    }
    return { type, anchor, label, startIso, endIso, index, prev: periodRange(type, rep(-1)), next: periodRange(type, rep(1)) }
  }
  switch (type) {
    case 'week': {
      const start = mondayOf(representativeIso)
      const weekNo = isoWeekNumber(start)
      return base(start, addDays(start, 6), `${y}-${pad(weekNo)}`, `week ${weekNo}`, weekNo)
    }
    case 'month': {
      const start = `${y}-${pad(m)}-01`
      return base(start, `${y}-${pad(m)}-${lastDayOfMonth(y, m)}`, `${y}-${pad(m)}`, `${MON[m - 1]} ${y}`, m)
    }
    case 'quarter': {
      const q = Math.floor((m - 1) / 3) + 1
      const sm = q * 3 - 2, em = q * 3
      return base(`${y}-${pad(sm)}-01`, `${y}-${pad(em)}-${lastDayOfMonth(y, em)}`, `${y}-q${q}`, `q${q} ${y}`, q)
    }
    case 'half': {
      const h = m <= 6 ? 1 : 2
      const sm = h === 1 ? 1 : 7, em = h === 1 ? 6 : 12
      return base(`${y}-${pad(sm)}-01`, `${y}-${pad(em)}-${lastDayOfMonth(y, em)}`, `${y}-h${h}`, `h${h} ${y}`, h)
    }
    case 'year':
      return base(`${y}-01-01`, `${y}-12-31`, `${y}`, `${y}`, 1)
  }
}
```

Note: `base`'s `prev`/`next` recursion uses `y` from the original representative — for year it's fine (rep(-1) = `${y-1}-06-15`); for week it uses `addDays(startIso, dir*7)` which lands in the adjacent week. This is correct but must be verified by the tests.

- [ ] **Step 3: Slug/anchor helpers**

```ts
export function periodTypeFromSlug(slug: string): PeriodType | null {
  if (slug === 'week' || slug === 'month' || slug === 'year') return slug
  if (/^q[1-4]$/.test(slug)) return 'quarter'
  if (/^h[12]$/.test(slug)) return 'half'
  return null
}
export function slugFromType(type: PeriodType, index: number): string {
  if (type === 'quarter') return `q${index}`
  if (type === 'half') return `h${index}`
  return type
}
export function periodAnchor(type: PeriodType, iso: string): string {
  return periodRange(type, iso).anchor
}
export function isoFromAnchor(type: PeriodType, urlAnchor: string, index?: number): string {
  const [yStr, ...rest] = urlAnchor.split('-')
  const y = Number(yStr)
  if (!Number.isInteger(y)) throw new Error(`bad anchor: ${urlAnchor}`)
  switch (type) {
    case 'year': return `${y}-01-01`
    case 'quarter': {
      const q = index ?? 1
      if (q < 1 || q > 4) throw new Error(`bad quarter index: ${q}`)
      return `${y}-${pad(q * 3 - 1)}-15`
    }
    case 'half': {
      const h = index ?? 1
      if (h < 1 || h > 2) throw new Error(`bad half index: ${h}`)
      return `${y}-${pad(h === 1 ? 4 : 10)}-15`
    }
    case 'month': {
      const mm = Number(rest[0])
      if (!Number.isInteger(mm) || mm < 1 || mm > 12) throw new Error(`bad month anchor: ${urlAnchor}`)
      return `${y}-${pad(mm)}-01`
    }
    case 'week': {
      const w = Number(rest[0])
      if (!Number.isInteger(w) || w < 1 || w > 53) throw new Error(`bad week anchor: ${urlAnchor}`)
      const jan4 = new Date(Date.UTC(y, 0, 4))
      const week1Mon = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS)
      return toIso(new Date(week1Mon.getTime() + (w - 1) * 7 * DAY_MS))
    }
  }
}
export function periodRangesBetween(type: PeriodType, fromIso: string, toIso: string): PeriodRange[] {
  const out: PeriodRange[] = []
  let cur = periodRange(type, fromIso)
  let guard = 0
  while (cur.startIso <= toIso && guard < 2000) {
    out.push(cur)
    cur = cur.next
    guard++
  }
  return out
}
```

- [ ] **Step 4: `tests/periods.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodRange, periodTypeFromSlug, isoFromAnchor, periodAnchor, periodRangesBetween } from '../src/lib/periods'

test('week = Mon–Sun containing the date', () => {
  // 2026-08-07 is a Friday; Mon 03-aug → Sun 09-aug
  const w = periodRange('week', '2026-08-07')
  assert.equal(w.startIso, '2026-08-03')
  assert.equal(w.endIso, '2026-08-09')
  assert.equal(w.label, 'week 32')          // verify: ISO week number of 2026-08-03 — adjust to the computed value
  assert.equal(w.anchor, '2026-32')
  assert.equal(w.prev.endIso, '2026-08-02')
  assert.equal(w.next.startIso, '2026-08-10')
})
test('month boundaries', () => {
  const m = periodRange('month', '2026-02-15')
  assert.equal(m.startIso, '2026-02-01')
  assert.equal(m.endIso, '2026-02-28')
  assert.equal(m.label, 'feb 2026')
  assert.equal(m.anchor, '2026-02')
})
test('quarter boundaries', () => {
  const q = periodRange('quarter', '2026-08-07')
  assert.equal(q.startIso, '2026-07-01')
  assert.equal(q.endIso, '2026-09-30')
  assert.equal(q.label, 'q3 2026')
  assert.equal(q.anchor, '2026-q3')
})
test('half boundaries', () => {
  const h1 = periodRange('half', '2026-03-15')
  assert.equal(h1.startIso, '2026-01-01')
  assert.equal(h1.endIso, '2026-06-30')
  const h2 = periodRange('half', '2026-10-15')
  assert.equal(h2.startIso, '2026-07-01')
  assert.equal(h2.endIso, '2026-12-31')
})
test('year boundaries + prev/next', () => {
  const y = periodRange('year', '2026-08-07')
  assert.equal(y.startIso, '2026-01-01')
  assert.equal(y.endIso, '2026-12-31')
  assert.equal(y.prev.startIso, '2025-01-01')
  assert.equal(y.next.startIso, '2027-01-01')
})
test('slug ↔ type', () => {
  assert.equal(periodTypeFromSlug('q2'), 'quarter')
  assert.equal(periodTypeFromSlug('h1'), 'half')
  assert.equal(periodTypeFromSlug('week'), 'week')
  assert.equal(periodTypeFromSlug('bogus'), null)
})
test('isoFromAnchor round-trips', () => {
  assert.equal(periodRange('week', isoFromAnchor('week', '2026-32')).anchor, '2026-32')
  assert.equal(periodRange('quarter', isoFromAnchor('quarter', '2026', 1)).anchor, '2026-q1')
  assert.equal(periodRange('month', isoFromAnchor('month', '2026-08')).anchor, '2026-08')
  assert.equal(periodAnchor('week', '2026-08-07'), periodRange('week', '2026-08-07').anchor)
})
test('ranges between spans a span', () => {
  const rs = periodRangesBetween('week', '2026-08-03', '2026-08-20')
  assert.ok(rs.length >= 2 && rs.length <= 4)
  assert.equal(rs[0].startIso, '2026-08-03')
})
```

(The week-number fixtures: verify 2026-08-03's ISO week number with the implementation and fix the expected value if the algorithm differs — the test must match the computed truth, not a guess.)

- [ ] **Step 5: Verify**

`npm test -- tests/periods.test.ts` → all pass. (The controller runs typecheck centrally.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/periods.ts tests/periods.test.ts
git commit -m "feat(periods): period engine — week/month/quarter/half/year ranges, anchors, prev/next (tested)"
```

---

### Task 3: Week = Mon–Fri + aggregation + deltas + trend

**Files:**
- Modify: `src/lib/periods.ts` (week `endIso` = start + 4 — Mon–Fri trading week)
- Modify: `tests/periods.test.ts` (Mon–Fri week fixtures)
- Create: `src/lib/period-stats.ts`
- Test: `tests/period-stats.test.ts`

**Interfaces:**
- Consumes: `PeriodRange` (Task 2, week amended); `ROf` from `./stream`; `DayData` from `./stream`.
- Produces (Tasks 4b/5/5b consume):

```ts
export interface PeriodStats {
  daysCount: number
  tradedDays: number
  trades: number
  sumR: number
  expectancyR: number
  winRate: number
  profitFactor: number
  pnlByAccount: { account: string; pnl: number }[]
  modelStats: { model: string; count: number; sumR: number }[]
  avgSleep: number | null
  avgMood: number | null
  habitAdherence: { habit: string; pct: number }[]
  avgScreenHours: number | null
}
export interface PeriodDelta { field: string; cur: number; prev: number; delta: number; pct: number | null }
export interface TrendPoint { label: string; sumR: number; winRate: number; trades: number }
export function aggregatePeriod(days: DayData[], range: PeriodRange, ctx: { habits: { id: string; kind: 'bool' | 'count'; target?: number }[]; accounts: { id: string; pointsValue: number }[] }): PeriodStats
export function periodDelta(prev: PeriodStats, cur: PeriodStats): PeriodDelta[]   // numeric fields: sumR, expectancyR, winRate, profitFactor, trades, tradedDays; pct null when prev is 0
export function trendSeries(type: PeriodType, days: DayData[], n: number, ctx: PeriodStatsCtx): TrendPoint[]  // last n periods ending at the latest in-range day
```

- [ ] **Step 1: Week Mon–Fri amendment (`src/lib/periods.ts` + tests)**

The owner locked: **trading days are strictly Mon–Fri, no exceptions** — the week period is the Mon–Fri trading week (the Sat/Sun ritual reviews the just-completed week; weekend day records fall outside every week and flow into month/quarter reviews).

In `src/lib/periods.ts`'s week case change `endIso: addDays(start, 6)` → `addDays(start, 4)`. `prev`/`next` keep stepping by 7 days (unchanged). The anchor/label/ISO-year logic from Task 2's fix stays.

Update `tests/periods.test.ts` week fixtures:
- `periodRange('week','2026-08-07')` → startIso `2026-08-03`, endIso `2026-08-07` (Fri), anchor `2026-32`, prev.endIso `2026-07-31`, next.startIso `2026-08-10`.
- Year boundary: `periodRange('week','2025-12-29')` → startIso `2025-12-29`, endIso `2026-01-02`, anchor `2026-01`. `periodRange('week','2027-01-01')` → startIso `2026-12-28`, endIso `2027-01-01`, anchor `2026-53`.
- `periodRangesBetween('week','2026-08-03','2026-08-20')` → exactly 3 (weeks Aug 3-7, 10-14, 17-21).

- [ ] **Step 2: `src/lib/period-stats.ts` — `aggregatePeriod`**

Filter days to `startIso..endIso`. R via `ROf` per trade. `sumR` = ΣR; `expectancyR` = sumR/trades; `winRate` = R>0 / trades; `profitFactor` = grossWin / |grossLoss| (∞ when no losses and grossWin>0, 0 when no trades). `pnlByAccount`: per execution `$pnl = trade.points × account.pointsValue × size` (pointsValue from ctx; unknown account → skip). `modelStats`: group by `trade.model` (tagged only). Life metrics: averages over in-range days with values (`sleep.hours`, `mood`, `device.iphoneHours + macHours`); `habitAdherence` per active habit: bool → pct of in-range days truthy; count → pct where `value >= target`.

- [ ] **Step 3: `periodDelta` + `trendSeries`**

`periodDelta(prev, cur)`: for each numeric field in `[sumR, expectancyR, winRate, profitFactor, trades, tradedDays]` → `{ field, cur, prev, delta: cur - prev, pct: prev !== 0 ? (cur - prev) / Math.abs(prev) : null }` (round pct to 3dp).

`trendSeries(type, days, n, ctx)`: walk `periodRangesBetween(type, earliestDayIso, latestDayIso)` from the END (latest), take the last `n` ranges; for each, `aggregatePeriod(days, range, ctx)` → `{ label: range.label, sumR, winRate, trades }`. Returned oldest→newest.

- [ ] **Step 4: `tests/period-stats.test.ts`** — DayData fixtures (a 2-day range, trades with executions + models, one sleep/mood/screen day, bool + count habits) asserting every metric + `screenshots: []` on every trade fixture (required by `DayTrade`). Add `periodDelta` tests (delta + pct, pct null on prev 0) and `trendSeries` tests (a multi-week fixture → the last n points oldest→newest).

- [ ] **Step 5: Verify** — `npm test -- tests/periods.test.ts tests/period-stats.test.ts` all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/periods.ts src/lib/period-stats.ts tests/periods.test.ts tests/period-stats.test.ts
git commit -m "feat(periods): Mon-Fri trading week + aggregation (R/PF/win-rate, per-account, per-model, life) + deltas + trend (tested)"
```

---

### Task 4: The review note — `reviews` collection + admin API + editor tab

**Files:**
- Modify: `src/content.config.ts` (reviews collection)
- Create: `src/pages/api/admin/reviews.ts`
- Create: `src/components/admin/tabs/ReviewTab.tsx`
- Modify: `src/components/admin/AdminApp.tsx` (add the tab)

**Interfaces:**
- Consumes: `PeriodType`/`periodAnchor`/`periodRangesBetween` (Task 2); `writeEntry`/`readEntry` from `src/lib/content`; `addChange` from `src/lib/changes`; `MarkdownEditor` + `ui` primitives.
- Produces:
  - `reviews` collection: schema `{ type: PeriodType, anchor: string, title?: string, date: string }`, MDX body; file `<type>-<anchor>.md` (e.g. `week-2026-32.md`).
  - `GET /api/admin/reviews?type=&anchor=` → `{ ok, review: { file, data, body } | null }` (fs read — the admin reads fresh, not via collections).
  - `POST /api/admin/reviews` — `{ type, anchor, title?, body }` → `writeEntry('reviews', `${type}-${anchor}.md`, data, body)` + `addChange('review', ...)` → `{ ok }`.
  - ReviewTab: a type + anchor picker (the periods with existing day data, from `periodRangesBetween` over the days), `MarkdownEditor` write/preview, save. Follow the existing admin tab patterns (read `LibraryTab.tsx` for the CRUD shape).

- [ ] **Step 1: content.config.ts** — add the collection (match the `journal` collection pattern: glob `reviews/*.md`, MDX body).

- [ ] **Step 2: API + tab** — read `src/pages/api/admin/{library,journal}.ts` + `LibraryTab.tsx` + `AdminApp.tsx` first; match the auth/save patterns. `Kind` in `src/lib/content.ts` must gain `'reviews'` (check the `Kind` union + the content-dirs list).

- [ ] **Step 3: Read-back verify** — grep the new pieces; `git status` shows only your files.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/pages/api/admin/reviews.ts src/components/admin/tabs/ReviewTab.tsx src/components/admin/AdminApp.tsx src/lib/content.ts
git commit -m "feat(reviews): per-period review notes — collection, admin API, editor tab"
```

---

### Task 4b: AI factual comparison — generation, storage, tab button

**Files:**
- Create: `src/lib/review-compare.ts`
- Modify: `src/content.config.ts` (reviews glob excludes `**/*.cmp.md`)
- Modify: `src/pages/api/admin/reviews.ts` (compare action + GET returns the comparison)
- Modify: `src/components/admin/tabs/ReviewTab.tsx` (generate button + editable comparison)

**Interfaces:**
- Consumes: `PeriodStats`/`PeriodDelta`/`TrendPoint`/`aggregatePeriod`/`periodDelta`/`trendSeries` (Task 3); `env.modelIngest()` (deepseek v4 flash 0731); `orChat` from `./ai`.
- Produces:
  - `comparePeriods(prev: PeriodStats, cur: PeriodStats, trend: TrendPoint[]): Promise<string>` — bullet-point markdown. The AI is a FORMATTER over verified numbers (no-gyaan): prompt = current stats + previous stats + trend series; bullet points, numbers only, deltas (WoW/MoM/QoQ/HoH/YoY), the trend read from the series, NO advice, NO speculation, NO numbers not present. Model `env.modelIngest()`, `orChat(..., json = false, maxTokens = 800)`. On failure the CALLER falls back to code-rendered bullets (`periodDelta` + `trendSeries` formatted as text) — the page is never blank.
  - Reviews API: `POST { action: 'compare', type, anchor }` → aggregate current + prev + trend (needs the day files + the period ranges) → `comparePeriods` (with the code-rendered fallback on failure) → `writeEntry('reviews', \`${type}-${anchor}.cmp.md\`, {}, comparison)` + `addChange('review', ...)` → `{ ok, comparison }`. GET returns the `.cmp.md` body too (`comparison`).
  - The `reviews` collection glob in `src/content.config.ts` must exclude comparison files: `glob({ pattern: ['**/*.md', '!**/*.cmp.md'], base: './src/content/reviews' })` (verify the astro glob loader supports the negation — if not, store the comparison as `.cmp.txt` and adjust the API/page reads).
  - ReviewTab: a "generate comparison" button (busy state) → calls the compare action → fills an editable comparison field (reuse the MarkdownEditor or a plain textarea — bullets) → save persists BOTH the note (`<type>-<anchor>.md`) and the comparison (`<type>-<anchor>.cmp.md`).

- [ ] **Step 1:** `src/lib/review-compare.ts` — the prompt + `comparePeriods` + the code-rendered fallback (`renderComparisonFallback(prev, cur, trend): string` exported for tests).
- [ ] **Step 2:** reviews API compare action + GET comparison + the collection glob exclusion.
- [ ] **Step 3:** ReviewTab generate button + editable comparison + save both.
- [ ] **Step 4:** Read-back verify (`grep` the new pieces) — commit only the 4 files: `git commit -m "feat(reviews): AI factual comparison — deepseek v4 flash, on-demand + editable, stored .cmp.md"`

---

### Task 5: The review surface + routes + nav (designer)

**Files:**
- Create: `src/components/period/PeriodReview.astro`
- Create: `src/pages/[periodType]/[[anchor]].astro`
- Modify: `src/layouts/Base.astro` (nav entry → `/week`)

**Interfaces:**
- Consumes: `periodTypeFromSlug`, `isoFromAnchor`, `periodRange`, `periodRangesBetween` (Task 2); `aggregatePeriod` + `PeriodStats` (Task 3); the `reviews` collection (Task 4); `MomentCard` + `fmtDayW` + the chronograph language; `getCollection('days'|'habits'|'journal'|'accounts'|'reviews')`.
- Produces: the review surface + one dynamic route.

- [ ] **Step 1: The route** `src/pages/[periodType]/[[anchor]].astro`

```astro
---
// Static top-level routes take precedence over this dynamic segment; validate the slug.
// /week → current period (SSR); /week/2026-33 → anchored (static via getStaticPaths).
export const prerender = false   // needed for the anchor-less current-period page; anchored paths use getStaticPaths

export function getStaticPaths() {
  // All anchored periods for every type, from the earliest existing day to today (HKT).
  // Return paths like /week/2026-32, /q1/2026 ... with the resolved props.
}
---
```

Implementation notes: fetch `getCollection('days')` once; for each type (week/month/quarter/half/year) compute `periodRangesBetween(type, earliestDayIso, todayHkt())`; emit `{ params: { periodType: slugFromType(type, range.index), anchor: range.anchor }, props: { type, range } }`. The `[[anchor]]` optional segment makes `/week` (no anchor) fall to the runtime SSR path — compute `periodRange(type, todayHkt())` there. 404 on `periodTypeFromSlug` null.

- [ ] **Step 2: The surface** `PeriodReview.astro`

Header: `{range.label} · {fmtDayW(startIso)} → {fmtDayW(endIso)}` + prev/next + a type switcher (week · month · q1–q4 · h1/h2 · year links to the current period of each). Stat grid (R centerpiece): sumR, expectancyR, winRate, profitFactor, trades, tradedDays. Per-account P&L table (sign-colored, `num-up`/`num-down`), per-model table. Life metrics: avg sleep, avg mood, habit adherence (list with pct), avg screen hours. Narrative: the review note prose (if any — read from the `reviews` collection by `periodAnchor`), the period's journal entries (title/summary, links to `/day/...`), and its stream moments (MomentCard list). Empty state when the period has no days: "no days logged in this period." Zero-JS, tokens/primitives only, match the design-system skill. Owner's life/lifestyle framing: nothing says "2 years".

- [ ] **Step 3: Nav** — add a `review` entry → `/week` in `src/layouts/Base.astro` (check the current nav structure + numbering; add the label in the same plain style, e.g. `[0N] review`).

- [ ] **Step 4: Read-back + smoke** — `grep` the new files; local server: `/week` renders (empty state or data), `/q1/2026` and `/week/2026-32` render, unknown slug 404s.

- [ ] **Step 5: Commit**

```bash
git add src/components/period/PeriodReview.astro "src/pages/[periodType]/[[anchor]].astro" src/layouts/Base.astro
git commit -m "feat(periods): review surface + /week /month /q1..q4 /h1..h2 /year routes + nav"
```

---

### Task 5b: /lookback — the aggregated reviews hub

**Files:**
- Create: `src/pages/lookback.astro`
- Modify: `src/layouts/Base.astro` (nav entry `[0N] lookback` → `/lookback`)

**Interfaces:**
- Consumes: `periodRangesBetween` (Task 2), `aggregatePeriod` (Task 3), the `reviews` collection (Task 4) + `.cmp.md` bodies (Task 4b, fs read).
- Produces: `/lookback` — the owner's aggregated archive of ALL period reviews: type filter chips (`all | week | month | quarter | half | year`, `?type=` like /stream), newest first; each row: `{label} · {fmtDayW(startIso)} → {fmtDayW(endIso)}`, headline stats (sumR, winRate, trades, tradedDays), the note snippet (first ~120 chars, when written) + the comparison snippet (first bullet, when generated), and a link to `/week/2026-32`-style anchors. Zero-JS, tokens/primitives, design system. SSR (`prerender = false` — fresh; notes/comparisons written Sat/Sun must appear immediately).
- The nav gains the second period entry here (Task 5 added `[review]`); add `[lookback]` in this task (sequential waves avoid the Base.astro conflict).

- [ ] **Step 1:** `/lookback` page — type filter, period rows (newest first) with stats + snippets + links, empty state ("no periods logged yet.").
- [ ] **Step 2:** nav entry.
- [ ] **Step 3:** Read-back + local smoke (`/lookback` renders with the filter chips; a period with a note shows its snippet).
- [ ] **Step 4:** Commit: `git add src/pages/lookback.astro src/layouts/Base.astro && git commit -m "feat(periods): /lookback — aggregated reviews hub (type filter, newest first)"`

---

### Task 6: Docs + final gate + build + deploy + verify live

**Files:**
- Modify: `CHANGELOG.md`, `AGENTS.md`, `MEMORY.md`, `docs/superpowers/specs/2026-08-07-period-reviews-design.md` (status shipped)

- [ ] **Step 1: Docs** — CHANGELOG Unreleased entry (period reviews + the no-2-year de-hardcode); AGENTS.md layout (periods.ts, period-stats.ts, PeriodReview.astro, reviews collection, the route) + note the day counter is uncapped; MEMORY session-log entry (commits + decisions: Mon–Sun, full review, written notes, no-2-year).

- [ ] **Step 2: Final gate (controller)** — `npm test` (all suites green) + `npm run typecheck` (0 errors) + `npm run build` (success).

- [ ] **Step 3: Deploy + verify LIVE** — `bash scripts/deploy.sh`; poll 200; curl `/week`, `/month`, `/q1/2026`, `/year/2026` → 200; unknown slug → 404; homepage hero no longer says "Two years".

---

## Self-review notes

- **Spec coverage:** §1 engine → T2; §2 aggregation → T3; §3 review notes → T4; §4 surface+routes+nav → T5; §5 data flow → T2/T3/T5; Global Constraints (zero-JS, single-source R, Mon–Sun, no-2-year) → all tasks; the no-2-year constraint → T1 (logic+copy) + the whole plan (horizon-agnostic).
- **Dependency order:** T1 + T2 + T4 parallel (write-disjoint: dates/copy / periods.ts / content.config+admin). T3 uses T2. T5 uses T2+T3+T4. T6 last. Waves: W1 = T1+T2+T4, W2 = T3, W3 = T5, W4 = T6. Controller typechecks between waves; one build per wave.
- **Type consistency:** `PeriodType`/`PeriodRange` (T2) consumed by T3 (`aggregatePeriod`) + T4 (anchor/file naming) + T5 (route + surface). `PeriodStats` (T3) only consumed by T5. `projectDayNumber(now?)` (T1) is a pure refactor of the existing function — consumers keep working.
- **Route safety:** `[periodType]` dynamic segment only matches slugs no static page owns (`/stream`, `/day`, `/admin` etc. take precedence in Astro); unknown top-level slugs → `periodTypeFromSlug` null → 404.
- **Plan-mandated risks to flag for reviewers:** (a) T2's `prev`/`next` recursion + ISO week-number algorithm are subtle — the tests are the proof, fixtures must match computed truth; (b) `getStaticPaths` in T5 iterates types × ranges — keep it bounded (existing days only, guard 2000); (c) the `reviews` collection is a new `Kind` — the admin fs path + collection schema must agree; (d) T1's copy changes are owner-flagged and vetoable — they change wording, not meaning.
