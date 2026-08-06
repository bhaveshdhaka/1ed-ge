# P1 — Day Cockpit Shell + IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the day page into the three-column cockpit (ambient timeline, grounding rail, writing surface), make `/` = today, shrink the nav, and merge the analytics pages — as a zero-JS static shell (live layer, AI loop, extract come in P2/P3).

**Architecture:** Astro 5 static build. The cockpit is composed of new components under `src/components/cockpit/`; a pure `src/lib/timeline.ts` computes the 24h ruler from the existing `marketEvents()` in `src/lib/sessions.ts`. `src/pages/day/[date].astro` and `src/pages/index.astro` both render a shared `CockpitPage`. Everything stays server-rendered — no JS added to public pages.

**Tech Stack:** Astro 5, Tailwind v4, TypeScript, `astro check`, Playwright (e2e).

## Global Constraints

- **Repo rules (non-negotiable):** every task ends by running `npm run typecheck` and, when the task touches the site, `npm run build`. Commit with a conventional prefix. Deploy only after ALL P1 tasks pass — per AGENTS.md "ship it".
- **Zero external JS on public pages.** No `script[src]` on public pages; inline scripts already in use (`MarketLive`) are fine. Do not add React to public pages.
- **No DB.** Content collections + files only. No new runtime deps.
- **Muted palette:** no bright `#4ade80`/`#f87171` as the default up/down. Muted sage/clay only. The word "red" must never appear for news hazards.
- **Nav = 6 destinations:** today `/`, journal `/journal`, calendar `/calendar`, performance `/performance`, accounts `/accounts`, about `/about`. No `~` in labels.
- **All times HKT.** US/CME/NYSE-futures-centric; TSE/LSE only as session awareness.
- **Site not launched** — deleting `/tracker` and `/trends` needs no redirect routes.
- Existing test files must be updated in the same commit as the route/nav change they assert (see `e2e/public.spec.ts`, `e2e/a11y.spec.ts`).

---

### Task 1: Muted palette + mono-only typography

**Files:**
- Modify: `src/styles/global.css` (palette tokens, remove Newsreader display font, remove `@import`)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS tokens `--color-sage` (#6ea88a), `--color-clay` (#b06a5e); `--color-up`/`--color-down`/`--color-warn` muted; `--font-display` = mono everywhere.

- [ ] **Step 1: Edit the `@theme` block** — mute the semantic colors and add sage/clay:

```css
@theme {
  --font-mono: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, 'Menlo', Consolas, monospace;
  --font-display: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, 'Menlo', Consolas, monospace;

  --color-bg: #0a0a0c;
  --color-panel: #111114;
  --color-raise: #17171c;
  --color-line: #26262c;
  --color-line2: #33333b;
  --color-ink: #d8d8dc;
  --color-soft: #a2a2aa;
  --color-dim: #8a8a92;
  --color-faint: #7e7e86;
  --color-up: #6ea88a;      /* muted sage — no more parrot green */
  --color-down: #c2725e;    /* muted terracotta — no more bright red */
  --color-warn: #d9a441;    /* muted amber */
  --color-accent: #8ab4ff;
  --color-purp: #c4b5fd;
  --color-sage: #6ea88a;
  --color-clay: #b06a5e;
}
```

- [ ] **Step 2: Remove the Newsreader import** (line 2) and the summit display-font override:

```diff
- @import '@fontsource-variable/newsreader';
```

In the `[data-theme='summit']` block, delete:
```css
  --font-display: 'Newsreader Variable', Georgia, 'Times New Roman', serif;
```

- [ ] **Step 3: Mute the summit override colors** so they match the base tokens:

```css
  --color-up: #6ea88a;
  --color-down: #c2725e;
  --color-warn: #d9a441;
```

- [ ] **Step 4: Verify build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: both pass. No visual test asserts color values.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css
git commit -m "style: muted palette (sage/clay) + mono-only typography, drop newsreader"
```

---

### Task 2: Rules + quotes collections and cockpit config

**Files:**
- Modify: `src/content.config.ts` (add `rules`, `quotes` collections)
- Create: `src/content/rules/01-cash-rule.md`, `02-news-window.md`, `03-no-revenge.md`, `04-log-everything.md`
- Create: `src/content/quotes/01-market-patience.md`, `02-discipline.md`, `03-paper-trading.md`
- Create: `src/config/cockpit.json`

**Interfaces:**
- Consumes: nothing.
- Produces: collections `rules` (`{ title }`) and `quotes` (`{ text, author? }`), exported via `collections`; `src/config/cockpit.json` with `{ "selfTalk": "the edge is all we need." }` (JSON importable from Astro frontmatter).

- [ ] **Step 1: Add collections to `src/content.config.ts`** (append before the final `export`):

```ts
const rules = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/rules' }),
  schema: z.object({
    title: z.string(),
  }),
})

const quotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/quotes' }),
  schema: z.object({
    text: z.string(),
    author: z.string().optional(),
  }),
})

export const collections = { accounts, days, payouts, coach, journal, habits, brief, 'market-news': marketNews, rules, quotes }
```

- [ ] **Step 2: Seed rules** (one file each, e.g. `src/content/rules/01-cash-rule.md`):

```markdown
---
title: "risk the same fixed $ amount every trade. no scaling into size when angry."
---
```

Repeat for `02-news-window.md` → `"flat 15 minutes before any scheduled news event."`, `03-no-revenge.md` → `"no revenge trades. a loss is information, not an insult."`, `04-log-everything.md` → `"if i would not publish it, i do not do it."`

- [ ] **Step 3: Seed quotes** (e.g. `src/content/quotes/01-market-patience.md`):

```markdown
---
text: "The market is a device for transferring money from the impatient to the patient."
author: "warren buffet"
---
```

Add `02-discipline.md` → `"Success is the sum of small efforts repeated day in and day out."` / `author: "robert collier"` and `03-paper-trading.md` → `"It takes one trade at a time to become the trader you want to be."` / no author.

- [ ] **Step 4: Create `src/config/cockpit.json`**

```json
{
  "selfTalk": "the edge is all we need."
}
```

- [ ] **Step 5: Verify** — `npm run typecheck && npm run build`
  Expected: pass; `getCollection('rules')`/`getCollection('quotes')` compile.

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts src/content/rules src/content/quotes src/config/cockpit.json
git commit -m "feat: rules + quotes content collections, cockpit config (self-talk)"
```

---

### Task 3: Timeline lib — pure 24h ruler builder

**Files:**
- Create: `src/lib/timeline.ts`
- Create: `e2e/cockpit.spec.ts` (first three tests; more added in Task 4)

**Interfaces:**
- Consumes: `marketEvents`, `addDaysIso`, `todayHkt`, `MarketEvent`, `MarketKey` from `src/lib/sessions.ts`.
- Produces:
  - `minsHM(hhmm: string): number` — `"20:30"` → `1230`.
  - `pctOfDay(hhmm: string): number` — minutes / 1440 * 100.
  - `interface TimelineBand { market: MarketKey; left: number; width: number }`
  - `interface HazardDot { title: string; time: string; left: number; kind: 'red' | 'orange' }`
  - `interface NextEvent { label: string; when: string }`
  - `interface TimelineData { bands: TimelineBand[]; hazards: HazardDot[]; nowLeft: number | null; next: NextEvent | null }`
  - `buildTimeline(iso: string, red: { time: string; title: string }[], orange: { time: string; title: string }[]): TimelineData`
  - `projectDayNumber(): number` added to `src/lib/dates.ts`.

- [ ] **Step 1: Add `projectDayNumber` to `src/lib/dates.ts`**

```ts
const PROJECT_START = new Date('2026-08-05T00:00:00Z')
export function projectDayNumber(): number {
  return Math.min(730, Math.max(1, Math.floor((Date.now() - PROJECT_START.getTime()) / 86400000) + 1))
}
```

- [ ] **Step 2: Write the failing e2e test** — `e2e/cockpit.spec.ts` (test-only content so far):

```ts
import { test, expect } from '@playwright/test'

test.describe('cockpit', () => {
  test('day page timeline exists', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-timeline]')).toHaveCount(1)
  })
})
```

Note: this file is fleshed out with rail/doc assertions in Task 4. Here it only asserts the timeline exists — run `npx playwright test e2e/cockpit.spec.ts` and expect FAIL (the day page has no `[data-timeline]` yet).

- [ ] **Step 3: Implement `src/lib/timeline.ts`**

```ts
import { marketEvents, addDaysIso, todayHkt } from './sessions'
import type { MarketEvent, MarketKey } from './sessions'

export interface TimelineBand {
  market: MarketKey
  left: number
  width: number
}
export interface HazardDot {
  title: string
  time: string
  left: number
  kind: 'red' | 'orange'
}
export interface NextEvent {
  label: string
  when: string
}
export interface TimelineData {
  bands: TimelineBand[]
  hazards: HazardDot[]
  nowLeft: number | null
  next: NextEvent | null
}

export function minsHM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export function pctOfDay(hhmm: string): number {
  return (minsHM(hhmm) / 1440) * 100
}

const DAY = 1440

/** Events → per-market [start, end] windows in absolute minutes since `iso` 00:00 HKT. */
function windows(iso: string, evs: MarketEvent[]): Map<MarketKey, Array<[number, number]>> {
  const iso0 = Date.parse(iso + 'T00:00:00+08:00')
  const absMin = (hkt: string) => {
    const day = Date.parse(hkt.slice(0, 10) + 'T00:00:00+08:00')
    return (day - iso0) / 60000 + minsHM(hkt.slice(11, 16))
  }
  const openAt = new Map<MarketKey, number>()
  const out = new Map<MarketKey, Array<[number, number]>>()
  const push = (m: MarketKey, s: number, e: number) => {
    if (!out.has(m)) out.set(m, [])
    out.get(m)!.push([s, e])
  }
  for (const e of evs) {
    const m = absMin(e.hkt)
    if (e.type === 'open' || e.type === 'resume') openAt.set(e.market, m)
    else if (e.type === 'close' || e.type === 'halt') {
      const s = openAt.get(e.market)
      if (s !== undefined) {
        push(e.market, s, m)
        openAt.delete(e.market)
      }
    }
  }
  // a session still open at end of window: close it at iso+1 00:00
  for (const [m, s] of openAt) push(m, s, DAY)
  return out
}

export function buildTimeline(
  iso: string,
  red: { time: string; title: string }[],
  orange: { time: string; title: string }[],
): TimelineData {
  const evs = marketEvents(addDaysIso(iso, -1), 3)
  const bands: TimelineBand[] = []
  const seen = new Set<string>()
  for (const [market, ws] of windows(iso, evs)) {
    for (const [s, e] of ws) {
      const lo = Math.max(s, 0)
      const hi = Math.min(e, DAY)
      if (hi <= lo) continue
      const key = `${market}:${lo}:${hi}`
      if (seen.has(key)) continue
      seen.add(key)
      bands.push({ market, left: (lo / DAY) * 100, width: ((hi - lo) / DAY) * 100 })
    }
  }

  const hazards: HazardDot[] = [
    ...red.map((r) => ({ title: r.title, time: r.time, left: pctOfDay(r.time), kind: 'red' as const })),
    ...orange.map((o) => ({ title: o.title, time: o.time, left: pctOfDay(o.time), kind: 'orange' as const })),
  ].sort((a, b) => a.left - b.left)

  const now = todayHkt() === iso
  let nowLeft: number | null = null
  if (now) {
    const d = new Date(Date.now() + 8 * 3600 * 1000)
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    nowLeft = pctOfDay(`${hh}:${mm}`)
  }

  let next: NextEvent | null = null
  if (now) {
    const d = new Date(Date.now() + 8 * 3600 * 1000)
    const nowMins = d.getUTCHours() * 60 + d.getUTCMinutes()
    const mk = (label: string, m: number) => {
      if (m <= nowMins) return
      const mins = m - nowMins
      const when = mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`
      if (!next || m < nextM) { next = { label, when }; nextM = m }
    }
    let nextM = Infinity
    for (const e of evs) {
      if (e.hkt.slice(0, 10) === iso || Date.parse(e.hkt.slice(0, 10) + 'T00:00:00+08:00') - Date.parse(iso + 'T00:00:00+08:00') === 86400000) {
        mk(marketLabel(e), minsHM(e.hkt.slice(11, 16)))
      }
    }
    for (const h of hazards) mk(`${h.title} · ${h.time}`, minsHM(h.time))
  }

  return { bands, hazards, nowLeft, next }
}

function marketLabel(e: MarketEvent): string {
  const names: Record<MarketKey, string> = { cme: 'CME', tse: 'TSE', lse: 'LSE', nyse: 'NYSE' }
  const t: Record<string, string> = { open: 'open', close: 'close', halt: 'halt', resume: 'resume' }
  return `${names[e.market]} ${t[e.type]}`
}
```

- [ ] **Step 4: Verify** — `npm run typecheck` (the e2e file uses `page` — keep it minimal for now) and `npm run build`.
  Note: the placeholder e2e test intentionally fails until Task 4. Typecheck must pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/dates.ts e2e/cockpit.spec.ts
git commit -m "feat: timeline lib — pure 24h HKT ruler builder from marketEvents"
```

---

### Task 4: Cockpit components

**Files:**
- Create: `src/components/cockpit/Ambient.astro`
- Create: `src/components/cockpit/DayTimeline.astro`
- Create: `src/components/cockpit/RailLeft.astro`
- Create: `src/components/cockpit/RailRight.astro`
- Create: `src/components/cockpit/WritingDoc.astro`
- Create: `src/components/cockpit/Cockpit.astro`
- Modify: `src/styles/global.css` (cockpit CSS classes)
- Modify: `e2e/cockpit.spec.ts` (real assertions)

**Interfaces:**
- Consumes: `buildTimeline`, `TimelineData` from `../lib/timeline`; `scheduledDayMarker` from `../lib/sessions`; `fmtDay` from `../lib/dates`; collections `days/journal/coach/brief/market-news/habits/rules/quotes/accounts`; `src/config/cockpit.json`.
- Produces:
  - `DayTimeline` props `{ data: TimelineData }` — renders `[data-timeline]`, `[data-band]` elements (one per band), `[data-hazard]`, `[data-now]`.
  - `Ambient` props `{ iso, next, nowLeft, dayNum, totalDays, mk }`.
  - `RailLeft` props `{ rules, quotes, habits, dayHabits }`.
  - `RailRight` props `{ d, hazards }` (d = day record data).
  - `WritingDoc` props `{ iso, d, journalContent, journalMeta, trades, sumR }`.
  - `Cockpit` props `{ iso, d, journalContent, journalMeta, habits, rules, quotes, newsFor, dayNum }` — composes the three rails + ambient.

- [ ] **Step 1: Add cockpit CSS to `src/styles/global.css`** (append inside `@layer components`):

```css
/* ---- cockpit ---- */
.ck { display: grid; grid-template-columns: 170px minmax(0, 1fr) 170px; gap: 0; }
@media (max-width: 1023px) {
  .ck { grid-template-columns: 1fr; }
  .ck-rail-l, .ck-rail-r { display: none; }
}
.ck-rail { border: 1px solid var(--color-line); background: var(--color-panel); }
.ck-rail-l { border-right: 0; }
.ck-rail-r { border-left: 0; }
.ck-mid { border: 1px solid var(--color-line); background: var(--color-panel); }
.ck-lab { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-faint); margin: 12px 14px 6px; }
.ck-item { font-size: 12px; color: var(--color-dim); padding: 3px 14px; }
.ck-item.done { color: var(--color-sage); }
.ck-item.hot { color: var(--color-ink); }
.ck-item.hot::before { content: '— '; color: var(--color-clay); }
.ck-quote { border-left: 2px solid var(--color-line2); margin: 0 14px; padding: 6px 10px; font-size: 12px; color: var(--color-soft); line-height: 1.6; }
.ck-quote .a { display: block; margin-top: 4px; font-size: 10px; color: var(--color-faint); }
.ck-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; background: var(--color-sage); }
.ck-dot.clay { background: var(--color-clay); opacity: 0.45; }
.ck-hz { font-size: 12px; color: #c07a6d; padding: 3px 14px; }
.ck-hz .muted { color: #8a5a50; }
.ck-drop { border: 1px dashed var(--color-line2); border-radius: 4px; margin: 0 14px; padding: 8px 10px; font-size: 11px; color: var(--color-faint); line-height: 1.5; }
.ck-kv { display: flex; justify-content: space-between; font-size: 12px; color: var(--color-dim); padding: 3px 14px; }
.ck-kv b { color: var(--color-ink); font-weight: 600; }
.ck-kv .sage { color: var(--color-sage); }

.ck-tl { position: relative; height: 24px; margin: 10px 16px 4px; }
.ck-tl .tick { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--color-line); }
.ck-tl .tick .lb { position: absolute; top: 100%; left: -7px; font-size: 9px; color: var(--color-faint); }
.ck-tl .band { position: absolute; top: 4px; bottom: 8px; border-radius: 2px; }
.ck-tl .band.cme { background: rgba(90, 90, 100, 0.13); }
.ck-tl .band.tse, .ck-tl .band.lse { background: rgba(90, 90, 100, 0.2); }
.ck-tl .band.nyse { background: rgba(110, 168, 138, 0.16); }
.ck-tl .band .lb { position: absolute; left: 4px; top: 1px; font-size: 8px; letter-spacing: 0.04em; color: var(--color-faint); }
.ck-tl .hazard { position: absolute; top: 1px; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: var(--color-clay); opacity: 0.45; }
.ck-tl .now { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--color-ink); }
.ck-tl .now::after { content: ''; position: absolute; top: -2px; left: -2px; width: 5px; height: 5px; border-radius: 50%; background: var(--color-ink); }
.ck-axis { display: flex; justify-content: space-between; font-size: 9px; color: var(--color-faint); margin: 0 16px; }
```

- [ ] **Step 2: Write the failing e2e assertions** — replace the placeholder in `e2e/cockpit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('cockpit — day page', () => {
  test('day page renders the timeline, rails and writing doc', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-timeline]')).toHaveCount(1)
    await expect(page.locator('[data-band]').first()).toBeVisible()
    await expect(page.locator('[data-rail-l]').first()).toBeVisible()
    await expect(page.locator('[data-rail-r]').first()).toBeVisible()
    await expect(page.locator('[data-doc]')).toHaveCount(1)
  })

  test('rules and a quote render in the left rail', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-rail-l]').locator('text=flat 15 minutes before any scheduled news event.')).toBeVisible()
    await expect(page.locator('[data-rail-l]').locator('.ck-quote').first()).toBeVisible()
  })

  test('no duplicate market info: rails carry no session times', async ({ page }) => {
    await page.goto('/day/13-aug-2026')
    await expect(page.locator('[data-rail-r]').locator('text=NYSE')).toHaveCount(0)
  })
})
```

Run `npx playwright test e2e/cockpit.spec.ts` → FAIL (components don't exist).

- [ ] **Step 3: Implement `DayTimeline.astro`**

```astro
---
import type { TimelineData } from '../../lib/timeline'
interface Props { data: TimelineData }
const { data } = Astro.props
const ticks = ['00', '06', '12', '18', '24']
const labels: Record<string, string> = { cme: 'CME', tse: 'TSE', lse: 'LSE', nyse: 'NYSE' }
---

<div class="ck-tl" data-timeline>
  {ticks.map((t, i) => (
    <div class="tick" style={`left:${(i / 4) * 100}%`}><span class="lb">{t}</span></div>
  ))}
  {data.bands.map((b) => (
    <div class={`band ${b.market}`} style={`left:${b.left}%;width:${b.width}%`} data-band>
      <span class="lb">{labels[b.market]}</span>
    </div>
  ))}
  {data.hazards.map((h) => (
    <div class="hazard" style={`left:${h.left}%`} title={`${h.title} · ${h.time}`} data-hazard></div>
  ))}
  {data.nowLeft !== null && <div class="now" style={`left:${data.nowLeft}%`} data-now></div>}
</div>
<div class="ck-axis"><span>hkt · 24h</span><span>hover a band for its countdown</span></div>
```

- [ ] **Step 4: Implement `Ambient.astro`**

```astro
---
import DayTimeline from './DayTimeline.astro'
import type { TimelineData } from '../../lib/timeline'
import { projectDayNumber } from '../../lib/dates'
import type { DayMarker } from '../../lib/sessions'

interface Props {
  iso: string
  data: TimelineData
  mk: DayMarker
  totalDays?: number
}
const { iso, data, mk, totalDays = 730 } = Astro.props
const dayNum = projectDayNumber()
const nowLabel = data.nowLeft !== null ? new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16) + ' hkt' : iso
---

<div class="border-b border-line bg-bg/60 px-4 pb-3 pt-4">
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-dim">
    <span class="text-ink">1edge</span>
    <span class="text-faint">now</span><b class="text-ink tabular-nums">{nowLabel}</b>
    {data.next && <span class="text-soft">next · <b class="text-ink">{data.next.label} {data.next.when}</b></span>}
    <span class="ml-auto flex items-center gap-2 text-[12px] text-dim">
      day <b class="text-ink">{dayNum}</b>
      <span class="inline-block h-0.5 w-14 bg-raise"><span class="block h-full bg-dim" style={`width:${Math.max(2, (dayNum / totalDays) * 100)}%`}></span></span>
      <span class="text-faint">/{totalDays}</span>
      <span class="text-[12px] tabular-nums" data-mkt-live class:list={[mk.cls]}>{mk.glyph} {mk.text}</span>
    </span>
  </div>
  <DayTimeline data={data} />
</div>
```

- [ ] **Step 5: Implement `RailLeft.astro`**

```astro
---
import type { CollectionEntry } from 'astro:content'
import cockpitConfig from '../../config/cockpit.json'

interface Props {
  rules: CollectionEntry<'rules'>[]
  quotes: CollectionEntry<'quotes'>[]
  habits: CollectionEntry<'habits'>[]
  dayHabits: Record<string, boolean> | undefined
}
const { rules, quotes, habits, dayHabits } = Astro.props
const selftalk = cockpitConfig.selfTalk
---

<aside class="ck-rail ck-rail-l hidden md:block" data-rail-l>
  <div class="ck-lab">rules</div>
  {rules.map((r) => <div class="ck-item">{r.data.title}</div>)}
  <div class="ck-lab">quote</div>
  {quotes[0] && (
    <div class="ck-quote">"{quotes[0].data.text}"<span class="a">{quotes[0].data.author ? '— ' + quotes[0].data.author : ''}</span></div>
  )}
  <div class="ck-lab">habits</div>
  {habits.map((h) => (
    <div class:list={['ck-item', dayHabits?.[h.id] === true && 'done']}>
      {dayHabits?.[h.id] === true ? '✓ ' : '○ '}{h.data.name}
    </div>
  ))}
  <div class="ck-lab">self-talk</div>
  <div class="ck-item">"{selftalk}"</div>
  <div class="ck-lab">coach</div>
  <div class="ck-item"><a href="/coach" class="transition-colors hover:text-accent">coach ▸</a></div>
</aside>
```

(P1 links to `/coach`; P3 replaces this with the inline docked chat panel invoked from this link.)

(Static JSON import via Astro frontmatter — JSON imports are supported natively.)

- [ ] **Step 6: Implement `RailRight.astro`**

```astro
---
import type { HazardDot } from '../../lib/timeline'
interface Props {
  d: { mood?: number; sleep?: { hours?: number }; device?: { iphoneHours?: number; socialHours?: number }; trades?: unknown[] } | null
  hazards: HazardDot[]
}
const { d, hazards } = Astro.props
const trades = d?.trades ?? []
const sumR = trades.reduce((s: number, t: any) => s + (t.points / (t.riskPoints ?? (t.stop !== undefined ? Math.abs(t.entry - t.stop) : 1))), 0)
---

<aside class="ck-rail ck-rail-r hidden md:block" data-rail-r>
  <div class="ck-lab">extract</div>
  <div class="ck-drop">▣ drop screenshots here — trades · screen time · sleep. data only, auto-discarded.</div>
  <div class="ck-lab">today</div>
  <div class="ck-kv"><span>mood</span><b>{d?.mood ? `${d.mood}/5` : '—'}</b></div>
  <div class="ck-kv"><span>sleep</span><b>{d?.sleep?.hours !== undefined ? `${d.sleep.hours}h` : '—'}</b></div>
  <div class="ck-kv"><span>screen</span><b>{d?.device?.iphoneHours !== undefined ? `${d.device.iphoneHours}h` : '—'}</b></div>
  <div class="ck-kv"><span>trades</span><b>{trades.length}</b></div>
  <div class="ck-kv"><span>R</span><b class="sage">{sumR ? `${sumR > 0 ? '+' : ''}${sumR.toFixed(2)}` : '—'}</b></div>
  {hazards.length > 0 && (
    <div class="ck-lab">hazard</div>
  )}
  {hazards.map((h) => (
    <div class="ck-hz"><span class="ck-dot clay"></span>{h.title} · {h.time}</div>
  ))}
</aside>
```

- [ ] **Step 7: Implement `WritingDoc.astro`**

```astro
---
import { fmtDay } from '../../lib/dates'
interface Props {
  iso: string
  d: { mood?: number; sleep?: { hours?: number }; device?: { iphoneHours?: number }; trades?: unknown[] } | null
  journalContent: any
  journalMeta: { day?: string; summary?: string; tags?: string[] } | null
  flatLine: string | null
}
const { iso, d, journalContent, journalMeta, flatLine } = Astro.props
const trades = d?.trades ?? []
const sumR = trades.reduce((s: number, t: any) => s + (t.points / (t.riskPoints ?? (t.stop !== undefined ? Math.abs(t.entry - t.stop) : 1))), 0)
const cells = [
  { k: 'mood', v: d?.mood ? `${d.mood}/5` : '—', ok: d?.mood !== undefined },
  { k: 'sleep', v: d?.sleep?.hours !== undefined ? `${d.sleep.hours}h` : '—', ok: d?.sleep?.hours !== undefined },
  { k: 'screen', v: d?.device?.iphoneHours !== undefined ? `${d.device.iphoneHours}h` : '—', ok: d?.device?.iphoneHours !== undefined },
  { k: 'trades', v: trades.length ? String(trades.length) : '—', ok: trades.length > 0 },
]
---

<section class="ck-mid" data-doc>
  <div class="flex items-center gap-3 border-b border-line px-5 py-2 text-[11px] text-faint">
    <span>{fmtDay(iso)} · draft</span>
    <span class="ml-auto text-[11px]">saved · synced</span>
  </div>
  <div class="mx-auto w-full max-w-[540px] px-6 py-8">
    {journalMeta?.day && <h1 class="text-[19px] text-ink">{journalMeta.day}</h1>}
    <div class="mt-2 mb-6 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {cells.map((c) => (
        <span class:list={[c.ok ? 'text-dim' : 'text-faint border-b border-dashed border-line2']}>
          {c.k} <b class:list={[c.ok && 'text-sage']}>{c.v}</b>
        </span>
      ))}
    </div>
    <div class="text-[14px] leading-[1.75] text-soft">
      {journalContent ? (
        <journalContent />
      ) : (
        <p class="text-faint">no journal entry this day.</p>
      )}
    </div>
  </div>
  {flatLine && (
    <div class="mx-auto w-full max-w-[540px] px-6 pb-6 text-[11px] text-sage">
      <span class="ck-dot"></span>{flatLine}
    </div>
  )}
</section>
```

- [ ] **Step 8: Implement `Cockpit.astro`** — the composition:

```astro
---
import Ambient from './Ambient.astro'
import RailLeft from './RailLeft.astro'
import RailRight from './RailRight.astro'
import WritingDoc from './WritingDoc.astro'
import { buildTimeline } from '../../lib/timeline'
import { scheduledDayMarker } from '../../lib/sessions'
import type { CollectionEntry } from 'astro:content'

interface Props {
  iso: string
  d: any
  journalContent: any
  journalMeta: { day?: string; summary?: string; tags?: string[] } | null
  habits: CollectionEntry<'habits'>[]
  rules: CollectionEntry<'rules'>[]
  quotes: CollectionEntry<'quotes'>[]
  newsFor: { data: { red: { time: string; title: string }[]; orange: { time: string; title: string }[] } } | null
  flatLine: string | null
}
const { iso, d, journalContent, journalMeta, habits, rules, quotes, newsFor, flatLine } = Astro.props
const red = newsFor?.data.red ?? []
const orange = newsFor?.data.orange ?? []
const timeline = buildTimeline(iso, red, orange)
const mk = scheduledDayMarker(iso)
const dayHabits = d?.habits ?? {}
---

<div>
  <Ambient iso={iso} data={timeline} mk={mk} />
  <div class="ck">
    <RailLeft rules={rules} quotes={quotes} habits={habits} dayHabits={dayHabits} />
    <WritingDoc iso={iso} d={d} journalContent={journalContent} journalMeta={journalMeta} flatLine={flatLine} />
    <RailRight d={d} hazards={timeline.hazards} />
  </div>
</div>
```

- [ ] **Step 9: Run the cockpit e2e + build**

Run: `npx playwright test e2e/cockpit.spec.ts`
Expected: PASS (day page `/day/13-aug-2026` renders timeline/rails/doc; the rule text appears; no `NYSE` text in the right rail).

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/cockpit src/styles/global.css e2e/cockpit.spec.ts
git commit -m "feat: cockpit components — ambient timeline, rails, writing doc"
```

---

### Task 5: CockpitPage + transform the day page

**Files:**
- Create: `src/components/cockpit/CockpitPage.astro`
- Modify: `src/pages/day/[date].astro` (render CockpitPage; keep detail sections)

**Interfaces:**
- Consumes: `Cockpit` from `./Cockpit.astro`; all collections.
- Produces: `CockpitPage` props `{ iso, allDates }` — renders prev/next day nav, `Cockpit`, and the existing detail sections (news `<details>`, brief, trades list, habits, screen-time proof, reflection, coach). Used by both the day page and the homepage.

- [ ] **Step 1: Move the day page body into `CockpitPage.astro`**

Copy the data-gathering + full body of the current `src/pages/day/[date].astro` into a new component whose frontmatter is:

```astro
---
import Base from '../../layouts/Base.astro'
import { getCollection, render } from 'astro:content'
import { fmtDay } from '../../lib/dates'
import { groupNewsByTime, newsEmoji } from '../../lib/market-news'
import Cockpit from './Cockpit.astro'

interface Props { iso: string; allDates: string[] }
const { iso, allDates } = Astro.props
const [accounts, journal, coach, habits, news, briefs, rules, quotes] = await Promise.all([
  getCollection('accounts'),
  getCollection('journal'),
  getCollection('coach'),
  getCollection('habits'),
  getCollection('market-news'),
  getCollection('brief'),
  getCollection('rules'),
  getCollection('quotes'),
])
// keep the rest of the current day page data-gathering: days collection, entry,
// journalFor/coachFor/newsFor/briefFor, dayRedGroups/dayOrangeGroups, accMap,
// dayIdx, prevIso/nextIso, d, dayHabits, sleep, device, moodLabel, trades, sumR,
// totalPts, dm, and the rendered Reflection/Coaching/Brief components.
const [days] = await Promise.all([getCollection('days')])
const entry = days.find((x) => x.data.date === iso) ?? null
const d = entry?.data ?? null
// …(copy the remaining lines verbatim from the current day/[date].astro)…
```

The render output (replacing the old `<article>` shell header):
```astro
<div>
  <Cockpit
    iso={iso}
    d={d}
    journalContent={Reflection}
    journalMeta={journalFor?.data ?? null}
    habits={habits}
    rules={rules}
    quotes={quotes}
    newsFor={newsFor ?? null}
    flatLine={null}
  />

  <nav class="shell flex items-center justify-between gap-3 text-[12px]">
    {prevIso ? <a href={`/day/${fmtDay(prevIso)}`} class="flex h-10 items-center border border-line px-3 text-dim transition-colors hover:border-accent hover:text-ink">← {fmtDay(prevIso)}</a> : <span class="text-faint">← older</span>}
    <span class="text-faint">day {dayIdx + 1} of {allDates.length}</span>
    {nextIso ? <a href={`/day/${fmtDay(nextIso)}`} class="flex h-10 items-center border border-line px-3 text-dim transition-colors hover:border-accent hover:text-ink">{fmtDay(nextIso)} →</a> : <span class="text-faint">newer →</span>}
  </nav>

  {newsFor && (dayRedGroups.length > 0 || dayOrangeGroups.length > 0) && (
    <details class="group mt-6 border border-line bg-panel/50 px-4 py-3" open>
      {/* existing news summary + rows — unchanged */}
    </details>
  )}

  {briefFor && Brief && (
    <div class="mt-6 border border-line bg-panel/50 px-4 py-3">
      <div class="text-[13px] text-dim">/ brief</div>
      <div class="prose mt-2 [&>*]:text-[13px]"><Brief /></div>
    </div>
  )}

  {/* existing: trades list, screen-time proof, habits, reflection, coach sections — unchanged */}
</div>
```

Also add the missing data the cockpit needs. In the frontmatter add:
```ts
const [rules, quotes] = await Promise.all([getCollection('rules'), getCollection('quotes')])
```

- [ ] **Step 2: Rewrite `src/pages/day/[date].astro`** as a thin wrapper:

```astro
---
import CockpitPage from '../../components/cockpit/CockpitPage.astro'
import { getCollection } from 'astro:content'
import { fmtDay } from '../../lib/dates'

export async function getStaticPaths() {
  const [days, journal, coach] = await Promise.all([
    getCollection('days'),
    getCollection('journal'),
    getCollection('coach'),
  ])
  const dates = new Set<string>()
  for (const c of [...days, ...journal, ...coach]) dates.add(c.data.date)
  const allDates = [...dates].sort()
  return allDates.map((iso) => ({ params: { date: fmtDay(iso) }, props: { iso, allDates } }))
}

const { iso, allDates } = Astro.props
---

<CockpitPage iso={iso} allDates={allDates} />
```

- [ ] **Step 3: Verify** — `npm run typecheck && npm run build`, then `npx playwright test e2e/cockpit.spec.ts`
  Expected: all pass; day pages still build (739+ pages).

- [ ] **Step 4: Commit**

```bash
git add src/components/cockpit/CockpitPage.astro src/pages/day/[date].astro
git commit -m "feat: day page → cockpit (shared CockpitPage)"
```

---

### Task 6: Homepage → today

**Files:**
- Modify: `src/pages/index.astro` (render CockpitPage for today)
- Modify: `e2e/public.spec.ts` (home tests: drop `.hero-fade`, keep `/730` + zero-JS)

**Interfaces:**
- Consumes: `CockpitPage` from `../components/cockpit/CockpitPage.astro`; `todayHkt` from `../lib/sessions`.
- Produces: homepage that is today's cockpit.

- [ ] **Step 1: Rewrite `src/pages/index.astro`**

```astro
---
import CockpitPage from '../components/cockpit/CockpitPage.astro'
import { getCollection } from 'astro:content'
import { todayHkt } from '../lib/sessions'
import { fmtDay } from '../lib/dates'

const [days, journal, coach] = await Promise.all([
  getCollection('days'),
  getCollection('journal'),
  getCollection('coach'),
])
const dates = new Set<string>()
for (const c of [...days, ...journal, ...coach]) dates.add(c.data.date)
const allDates = [...dates].sort()
const iso = todayHkt()
const existing = allDates.includes(iso)
const cockpitDates = existing ? allDates : [...allDates, iso].sort()
const todayIdx = cockpitDates.indexOf(iso)
const prevIso = todayIdx > 0 ? cockpitDates[todayIdx - 1] : null
const nextIso = todayIdx >= 0 && todayIdx < cockpitDates.length - 1 ? cockpitDates[todayIdx + 1] : null
---

<CockpitPage iso={iso} allDates={cockpitDates} />
```

Note: `CockpitPage` renders `Base` and uses `iso` for the timeline/rails; for a today with no day record yet, `d` is null and the doc shows "no journal entry this day." The prev/next nav still works against `cockpitDates`. If `iso` is not in the content store, the day page for it does not exist yet — CockpitPage must handle `entry === null` (it already does).

- [ ] **Step 2: Update `e2e/public.spec.ts` home tests** — remove the `.hero-fade` assertion:

```ts
test('summit theme is applied (data-theme + background + peak brand)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'summit')
  await expect(page.locator('.theme-bg')).toHaveCount(1)
  await expect(page.locator('.tb-stars')).toHaveCount(2)
  await expect(page.locator('.tb-mountain')).toHaveCount(1)
  await expect(page.locator('.brand-word')).toBeVisible()
})
```

Keep the `/730` test and the zero-external-JS test unchanged (the cockpit adds no external JS).

- [ ] **Step 3: Verify** — `npm run typecheck && npm run build && npx playwright test e2e/cockpit.spec.ts e2e/public.spec.ts`
  Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro e2e/public.spec.ts
git commit -m "feat: homepage = today's cockpit"
```

---

### Task 7: Merge analytics — performance gains habits + trends

**Files:**
- Modify: `src/pages/performance.astro` (add habits + trends sections and sticky anchors)
- Modify: `e2e/public.spec.ts` (performance anchors + tracker section moved here)

**Interfaces:**
- Consumes: `buildHabitStats` from `../lib/habits`, `Heatmap` from `../components/Heatmap.astro`, `buildTrends` from `../lib/trends`, `CorrTable` from `../components/CorrTable.astro`.
- Produces: `/performance` with sections `#stats #charts #accounts #recent #habits #trends`.

- [ ] **Step 1: Update the sticky section nav in `performance.astro`**

```ts
{[
  ['stats', 'stats'],
  ['charts', 'charts'],
  ['accounts', 'accounts'],
  ['recent trades', 'recent'],
  ['habits', 'habits'],
  ['trends', 'trends'],
].map(([label, id]) => (
  <a href={`#${id}`} class="flex h-8 items-center whitespace-nowrap px-2 text-dim transition-colors hover:text-ink">{label}</a>
))}
```

- [ ] **Step 2: Add data-gathering to the frontmatter**

```ts
const [habitsCol, trendCol] = await Promise.all([getCollection('habits'), getCollection('days')])
const habitStats = buildHabitStats(habitsCol, days)
const trends = buildTrends(days, accounts)
```

(Replace the existing `const [accounts, days, payouts]` line with a combined Promise.all that also fetches `habits`.)

- [ ] **Step 3: Append the habits + trends sections** before the closing `</section>` (port from `tracker.astro` and `trends.astro`):

```astro
<h2 id="habits" class="mt-14 scroll-mt-28 text-lg">/ habits</h2>
<div class="mt-4 grid gap-10 lg:grid-cols-2">
  {habitStats.map((h) => (
    <div class="panel p-5">
      <div class="flex items-baseline justify-between">
        <div class="flex items-baseline gap-2"><span class="text-[15px] text-ink">{h.emoji ?? '·'} {h.name}</span></div>
        <span class="text-[11px] uppercase tracking-widest text-faint">streak</span>
      </div>
      <div class="mt-1 flex items-baseline gap-4">
        <span class="text-2xl" style={`color:${h.color}`}>{h.currentStreak}<span class="text-sm text-dim">d</span></span>
        <div class="text-[12px] text-dim">best {h.bestStreak}d · 30d {h.pct30 === null ? '—' : h.pct30.toFixed(0) + '%'} · all {h.pctAll === null ? '—' : h.pctAll.toFixed(0) + '%'}</div>
      </div>
      <div class="mt-5"><Heatmap data={h.heatmap} color={h.color} name={h.name} /></div>
    </div>
  ))}
</div>

<h2 id="trends" class="mt-14 scroll-mt-28 text-lg">/ trends</h2>
<div class="mt-4 overflow-x-auto panel" tabindex="0">
  <table class="w-full min-w-[720px] border-collapse">
    <thead>
      <tr><th class="th">window</th><th class="th text-right">days</th><th class="th text-right">trades</th><th class="th text-right">win%</th><th class="th text-right">sum R</th><th class="th text-right">avg R</th><th class="th text-right">$ pnl</th></tr>
    </thead>
    <tbody>
      {trends.windows.map((w) => (
        <tr>
          <td class="td text-ink">{w.label}</td>
          <td class="td text-right">{w.days}</td>
          <td class="td text-right">{w.trades}</td>
          <td class="td text-right">{w.winRate === null ? '—' : w.winRate.toFixed(1) + '%'}</td>
          <td class="td text-right text-dim">{w.sumR > 0 ? '+' : ''}{w.sumR.toFixed(2)}</td>
          <td class:list={['td text-right', w.avgR > 0 ? 'num-up' : w.avgR < 0 ? 'num-down' : '']}>{w.avgR > 0 ? '+' : ''}{w.avgR.toFixed(2)}R</td>
          <td class:list={['td text-right', w.sumPnl >= 0 ? 'num-up' : 'num-down']}>{w.sumPnl >= 0 ? '+' : ''}${Math.round(w.sumPnl).toLocaleString()}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

<div class="mt-10 grid gap-10 lg:grid-cols-2">
  <div><h2 class="text-lg">/ R by sleep</h2><div class="mt-4 panel"><CorrTable label="bucket" rows={trends.correlations.sleep} /></div></div>
  <div><h2 class="text-lg">/ R by mood</h2><div class="mt-4 panel"><CorrTable label="bucket" rows={trends.correlations.mood} /></div></div>
  <div><h2 class="text-lg">/ R by habits</h2><div class="mt-4 panel"><CorrTable label="bucket" rows={trends.correlations.habits} /></div></div>
  <div><h2 class="text-lg">/ R by screen</h2><div class="mt-4 panel"><CorrTable label="bucket" rows={trends.correlations.screen} /></div></div>
  <div><h2 class="text-lg">/ R by session</h2><div class="mt-4 panel"><CorrTable label="session" rows={trends.correlations.session} /></div></div>
  <div><h2 class="text-lg">/ R by setup</h2><div class="mt-4 panel"><CorrTable label="setup" rows={trends.correlations.setup} /></div></div>
</div>

{trends.flags.length > 0 && (
  <div class="mt-14">
    <h2 class="text-lg">/ observations</h2>
    <ul class="mt-4 space-y-2">
      {trends.flags.map((f) => (
        <li class="flex gap-3 border-b border-line/60 pb-2 text-[13px] text-soft"><span class="text-faint">›</span><span>{f}</span></li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 4: Update `e2e/public.spec.ts`** — performance anchors include `#habits`/`#trends`; replace the `tracker` describe block:

```ts
test.describe('performance', () => {
  test('sticky section nav anchors exist', async ({ page }) => {
    await page.goto('/performance')
    for (const id of ['#stats', '#charts', '#accounts', '#recent', '#habits', '#trends']) {
      await expect(page.locator(`a[href="${id}"]`)).toBeVisible()
    }
  })

  test('habit heatmaps render on the merged page', async ({ page }) => {
    await page.goto('/performance')
    await expect(page.locator('#habits .overflow-x-auto svg, #habits svg').first()).toBeVisible()
  })
})
```

(Verify the heatmap selector against the rendered DOM during implementation; adjust to count 6 if needed.)

- [ ] **Step 5: Verify** — `npm run typecheck && npm run build && npx playwright test e2e/public.spec.ts`
  Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/performance.astro e2e/public.spec.ts
git commit -m "feat: merge tracker + trends into performance"
```

---

### Task 8: Nav consolidation + delete tracker/trends + update route tests

**Files:**
- Modify: `src/components/Nav.astro`
- Delete: `src/pages/tracker.astro`, `src/pages/trends.astro`
- Modify: `e2e/public.spec.ts` (PUBLIC_ROUTES + nav test)
- Modify: `e2e/a11y.spec.ts` (PUBLIC_ROUTES)
- Modify: `src/pages/about.astro` (nothing — `/performance` link still valid)

**Interfaces:**
- Consumes: nothing new.
- Produces: 6-destination nav; `/tracker` and `/trends` return 404.

- [ ] **Step 1: Rewrite the nav links in `Nav.astro`**

```ts
const links = [
  { href: '/', label: 'today', n: '00' },
  { href: '/journal', label: 'journal', n: '01' },
  { href: '/calendar', label: 'calendar', n: '02' },
  { href: '/performance', label: 'performance', n: '03' },
  { href: '/accounts', label: 'accounts', n: '04' },
  { href: '/about', label: 'about', n: '05' },
]
```

The desktop + mobile render loops stay unchanged (they map `links`).

- [ ] **Step 2: Delete the two pages**

```bash
git rm src/pages/tracker.astro src/pages/trends.astro
```

- [ ] **Step 3: Update `e2e/public.spec.ts`**

```ts
const PUBLIC_ROUTES = ['/', '/journal', '/calendar', '/performance', '/accounts', '/coach', '/about']
```

Replace the nav test:

```ts
test('desktop nav shows the 6 destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  for (const [label, href] of [['today', '/'], ['journal', '/journal'], ['calendar', '/calendar'], ['performance', '/performance'], ['accounts', '/accounts'], ['about', '/about']]) {
    await expect(page.locator(`nav a[href="${href}"]`).first()).toBeVisible()
  }
  await expect(page.locator('nav a[href="/tracker"]')).toHaveCount(0)
  await expect(page.locator('nav a[href="/trends"]')).toHaveCount(0)
})
```

Delete the `tracker` describe block (already superseded in Task 7).

- [ ] **Step 4: Update `e2e/a11y.spec.ts`**

```ts
const PUBLIC_ROUTES = ['/', '/journal', '/calendar', '/performance', '/accounts', '/coach', '/about']
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run build`
Expected: pass. Confirm `/tracker` and `/trends` are gone from `dist/client/` (no `tracker/index.html`, no `trends/index.html`).

Run: `npx playwright test e2e/cockpit.spec.ts e2e/public.spec.ts e2e/a11y.spec.ts`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: nav → 6 destinations, remove tracker/trends pages, update e2e"
```

---

## Post-P1 verification (ship it)

Run in order — this is the "ship it" gate from AGENTS.md:

1. `npm run typecheck`
2. `npm run test:e2e` (all specs — public, admin, a11y, cockpit)
3. `npm run build`
4. `bash scripts/deploy.sh`
5. Poll `https://1ed.ge` until 200, then curl-verify:
   - `curl -s https://1ed.ge/ | grep -c 'data-timeline'` → ≥1
   - `curl -s https://1ed.ge/performance | grep -c 'id="trends"'` → ≥1
   - `curl -s https://1ed.ge/tracker -o /dev/null -w '%{http_code}'` → 404
   - `curl -s https://1ed.ge/ | grep -c 'href="/trends"'` → 0
6. Kill any local test servers (port 4323, `node dist/server/entry.mjs`).

## Deferred to later plans

- **P2** — SSR day page, ~1KB poller, ticking timeline/now-marker + `next` live, hazard 30-min pulse (opacity), coach debrief section rendering, `nowLeft` from the client clock.
- **P3** — `submit 🤖`/`publish 🌐` AI refine→approve loop, ephemeral screenshot extract (two tracks), tickable habits + sign-off, autosave, coach generation, and the **inline coach chat** — a docked console panel invoked from the left-rail `coach ▸` link (not a floating bubble; replaces the P1 `/coach` link target).
- **P4** — visual polish from the approved mockups, fix the 268KB journal index, font/asset trim, Lighthouse + SEO sweep, mobile rail behavior, PWA install.
