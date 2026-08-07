# Phase 3 — Public Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three remaining public surfaces of the Stream System — the posterized `/day/<date>` archive (facts + moments + trades with model tags, NO cockpit mirror), a new `/models` page (models + per-model rules + their trades), and the `/journal` index rebuilt on the Phase-0 primitives with a lean search index.

**Architecture:** Three independent, write-disjoint pages. (1) The day route `src/pages/day/[date].astro` stops delegating to the cockpit mirror and renders a posterized archive directly: `DayFacts` strip + published moments (`resolveMoments` + `MomentCard`) + trade panels (with `model` Badge + `commentary`) + habits + screen-time proof + reflection + news + brief + coach. Then `src/components/cockpit/` is deleted (its only consumer was the day page). (2) A new `/models` page backed by a new `src/lib/models.ts` aggregation (per-model stats from tagged trades) — the `models` collection's first public consumer. (3) `src/pages/journal/index.astro` rebuilt on `src/components/ui/*` primitives with a lean inline search index (drop the dayText dump that makes the page ~287KB). All three are static pages (rebuilt on publish, picked up in place). Public stays zero-JS — the journal page's inline search script is the pre-existing exception.

**Tech Stack:** Astro 5 static pages, existing zero-JS primitives (`src/components/ui/*.astro` — their FIRST consumer), existing stream primitives (`MomentCard`, `DayFacts`), `src/lib/stream.ts` (`resolveMoments`, `dayFacts`, `ROf`, `riskOf`, `momentMeta`), `src/lib/markdown.ts` (`renderMarkdown` for the archive), `src/lib/dates.ts` (`fmtDay`).

## Global Constraints

- **Public pages must stay zero-JS.** No React, no new JS on public routes. SVG charts only. The journal search script is the existing exception (client-side search shipped in Phase 1 — keep it, don't remove it).
- **No cockpit mirror.** The public day page is a posterized archive — facts once (DayFacts strip), trades once (panels), moments, reflection. Never duplicate the cockpit rails/timeline/cells. After the archive replaces it, DELETE `src/components/cockpit/` (all 7 files) — nothing else imports it.
- **`draft:` is private** — never render `d.draft` (reflection or moments) on any public route. Only `stream` moments and the published journal.
- **The day record is the spine; R is computed, never stored.** Use `riskOf`/`ROf` from `src/lib/stream.ts` — never re-implement the points/risk math (it is duplicated in CockpitPage today; the archive must NOT duplicate it again).
- **Money colors:** up = `text-up`/`num-up`, down = `text-down`/`num-down` by sign of the value. No green-for-negative.
- **Owner-authored content only:** rules/quotes/models are the owner's words; render them verbatim, never reword.
- **Master clock = CME** — day status line uses `scheduledDayMarker`/`marketMarker` from `lib/sessions`/`lib/market` (already the established pattern).
- **Use the primitives, don't hand-roll.** `src/components/ui/*.astro` (Button, Card, Badge, Table, StatCard, Quote, Tag, Flag, Dot, Separator, EmptyState, Icon, Input, Textarea, Field) are the site's component system and are currently unused — Phase 3 is their first consumer. Follow `.opencode/skills/design-system/SKILL.md`. Do NOT invent new markup for things a primitive covers.
- **Repo has no unit-test runner.** Verification = `npm run typecheck` (run centrally by the controller — do not run it yourself if a parallel task is building; astro races on `node_modules/.astro`) + `npm run build` + curl smoke tests against the served `dist/` or live site. The controller builds once after each wave.
- **Commit only your own files** (`git add <exact paths>`, never `git add -A` — the autosave cron owns content files and may have uncommitted market-news edits in the tree).
- **No two agents build at once.** Implementation waves below are write-disjoint; the controller runs typecheck/build centrally between waves.

---

### Task 1: Posterized day archive + delete the cockpit

**Files:**
- Rewrite: `src/pages/day/[date].astro` (currently 24 lines, delegates to CockpitPage)
- Create: `src/components/archive/DayArchive.astro` (the posterized page body)
- Delete: `src/components/cockpit/` (Ambient.astro, Cockpit.astro, CockpitPage.astro, DayTimeline.astro, RailLeft.astro, RailRight.astro, WritingDoc.astro)
- Verify: `src/config/cockpit.json` has no other consumers after the delete (grep — only RailLeft used it)

**Interfaces:**
- Consumes: `getCollection` for `days, accounts, journal, coach, habits, market-news, brief` (drop `rules`/`quotes` — those were cockpit-rail-only), `render()` for journal MDX + coach MDX + brief MDX, `dayFacts`/`resolveMoments`/`ROf`/`riskOf`/`momentMeta` from `src/lib/stream.ts`, `MomentCard` + `DayFacts` from `src/components/stream/`, `fmtDay` from `src/lib/dates.ts`, `scheduledDayMarker` from `src/lib/sessions.ts`, `newsHeadline` + `NewsBlock`, `Base` layout.
- Produces: `/day/<fmtDay(iso)>` static pages rendering: header (day + fmtDay + market marker + prev/next), DayFacts strip, published moments (MomentCard list), trades (panels w/ model Badge + commentary), habits chips, screen-time proof, reflection (journal MDX), USD news details, brief, coach. `src/components/cockpit/` deleted.

- [ ] **Step 1: Rewrite `src/pages/day/[date].astro` to delegate to the new archive**

Keep the same `getStaticPaths` (union of days ∪ journal ∪ coach dates, `fmtDay` slugs) — it already covers every archive date. Replace the CockpitPage delegation with:

```astro
---
import DayArchive from '../../components/archive/DayArchive.astro'
import { getCollection } from 'astro:content'
import { fmtDay } from '../../lib/dates'

export async function getStaticPaths() {
  const [days, journal, coach] = await Promise.all([
    getCollection('days'), getCollection('journal'), getCollection('coach'),
  ])
  const dates = new Set<string>()
  for (const c of [...days, ...journal, ...coach]) dates.add(c.data.date)
  const allDates = [...dates].sort()
  return allDates.map((iso) => ({
    params: { date: fmtDay(iso) },
    props: { iso, allDates },
  }))
}
const { iso, allDates } = Astro.props
---
<DayArchive iso={iso} allDates={allDates} />
```

- [ ] **Step 2: Create `src/components/archive/DayArchive.astro`**

This is the posterized archive. Structure it EXACTLY as follows (frontmatter first, then template in this order). Do not add a cockpit mirror, do not re-implement R math.

```astro
---
import Base from '../../layouts/Base.astro'
import { getCollection, render } from 'astro:content'
import { fmtDay } from '../../lib/dates'
import { scheduledDayMarker } from '../../lib/sessions'
import { newsHeadline } from '../../lib/market-news'
import { dayFacts, resolveMoments, ROf } from '../../lib/stream'
import { MomentCard } from '../stream/MomentCard.astro'
import { DayFacts } from '../stream/DayFacts.astro'
import NewsBlock from '../NewsBlock.astro'
import { Badge } from '../ui/Badge.astro'
import { Card } from '../ui/Card.astro'
import { EmptyState } from '../ui/EmptyState.astro'
import { Separator } from '../ui/Separator.astro'

interface Props { iso: string; allDates: string[] }
const { iso, allDates } = Astro.props

const [days, accounts, journal, coach, habits, news, briefs] = await Promise.all([
  getCollection('days'), getCollection('accounts'), getCollection('journal'),
  getCollection('coach'), getCollection('habits'), getCollection('market-news'), getCollection('brief'),
])
const entry = days.find((d) => d.data.date === iso) ?? null
const journalFor = journal.find((j) => j.data.date === iso) ?? null
const coachFor = coach.find((c) => c.data.date === iso) ?? null
const newsFor = news.find((n) => n.data.date === iso)
const briefFor = briefs.find((b) => b.data.date === iso) ?? null
const dayRed = newsFor?.data.red ?? []
const dayOrange = newsFor?.data.orange ?? []
const dayHead = newsHeadline(dayRed, dayOrange)

const accMap = new Map(accounts.map((a) => [a.data.id, a.data]))
const dayIdx = allDates.indexOf(iso)
const prevIso = dayIdx > 0 ? allDates[dayIdx - 1] : null
const nextIso = dayIdx >= 0 && dayIdx < allDates.length - 1 ? allDates[dayIdx + 1] : null

const d = entry?.data ?? null
const activeHabits = habits.filter((h) => h.data.active !== false)
const facts = dayFacts(d as any, activeHabits.length)
const moments = d ? resolveMoments(d as any) : []
const trades = d?.trades ?? []
const mk = scheduledDayMarker(iso)

let Reflection: any = null
let Coaching: any = null
let Brief: any = null
if (journalFor) { const r = await render(journalFor); Reflection = r.Content }
if (coachFor) { const r = await render(coachFor); Coaching = r.Content }
if (briefFor) { const r = await render(briefFor); Brief = r.Content }
---
```

Template (Base layout, `.shell` container — match `/` and `/stream` visual language):

```astro
<Base
  title={`day ${fmtDay(iso)} — 1ed.ge`}
  description={`${fmtDay(iso)} — ${facts.find((f) => f.key === 'mood')?.value ?? '—'} mood, ${trades.length} trades, ${facts.find((f) => f.key === 'R')?.value ?? '—'} R. Everything public.`}
>
  <div class="shell pt-12 pb-20">
    <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div class="flex items-baseline gap-3 text-[13px]">
        <span class="text-ink">day</span>
        <span class="text-faint">{fmtDay(iso)}</span>
      </div>
      <span class="text-[12px] tabular-nums" style={`color:${mk.status === 'open' ? 'var(--color-up)' : mk.status === 'early' ? 'var(--color-warn)' : 'var(--color-down)'}`}>
        {mk.glyph} {mk.text}
      </span>
    </header>

    <nav class="mt-4 flex items-center justify-between gap-3 text-[12px]">
      {prevIso ? (
        <a href={`/day/${fmtDay(prevIso)}`} class="flex h-10 items-center border border-line px-3 text-dim transition-colors hover:border-accent hover:text-ink">← {fmtDay(prevIso)}</a>
      ) : (<span class="text-faint">← older</span>)}
      <span class="text-faint">day {dayIdx + 1} of {allDates.length}</span>
      {nextIso ? (
        <a href={`/day/${fmtDay(nextIso)}`} class="flex h-10 items-center border border-line px-3 text-dim transition-colors hover:border-accent hover:text-ink">{fmtDay(nextIso)} →</a>
      ) : (<span class="text-faint">newer →</span>)}
    </nav>

    <section class="mt-6">
      <h2 class="text-lg">/ day facts</h2>
      <div class="mt-3"><DayFacts cells={facts} /></div>
    </section>

    <section class="mt-10">
      <h2 class="text-lg">/ moments</h2>
      {moments.length === 0 ? (
        <div class="mt-3"><EmptyState text="nothing published this day." /></div>
      ) : (
        <div class="mt-4 flex max-w-2xl flex-col gap-3">
          {moments.map((m) => <MomentCard moment={m} />)}
        </div>
      )}
    </section>

    <section class="mt-10">
      <h2 class="text-lg">/ trades {trades.length > 0 ? `(${trades.length})` : ''}</h2>
      {trades.length === 0 ? (
        <p class="mt-3 text-[13px] text-faint">no trades logged this day.</p>
      ) : (
        <div class="mt-4 space-y-4">
          {trades.map((t, i) => {
            const R = ROf(t as any)
            const ex = t.executions ?? []
            const totalPnl = ex.reduce((s, e) => s + t.points * (accMap.get(e.account)?.pointsValue ?? 2) * (e.size ?? 1), 0)
            return (
              <Card>
                <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span class="text-[15px] text-ink">{t.direction === 'long' ? '▲' : '▼'} {t.market}</span>
                  <span class="text-[12px] text-dim">{t.session ?? '—'} · {t.setup ?? 'no setup'}</span>
                  {t.model && <Badge variant="accent">{t.model}</Badge>}
                  <span class:list={['ml-auto text-[15px]', R > 0 ? 'num-up' : R < 0 ? 'num-down' : '']}>
                    {R > 0 ? '+' : ''}{R.toFixed(2)}R
                  </span>
                  <span class:list={['text-[13px]', totalPnl >= 0 ? 'num-up' : 'num-down']}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
                  </span>
                </div>
                <div class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-dim md:grid-cols-4">
                  <span>entry <span class="text-ink">{t.entry}</span></span>
                  <span>exit <span class="text-ink">{t.exit}</span></span>
                  <span>stop <span class="text-ink">{t.stop ?? '—'}</span></span>
                  <span>points <span class:list={[t.points >= 0 ? 'text-up' : 'text-down']}>{t.points >= 0 ? '+' : ''}{t.points}</span></span>
                </div>
                {t.commentary && (
                  <p class="mt-2 border-t border-line/60 pt-2 text-[13px] text-soft">{t.commentary}</p>
                )}
                {(ex.length > 0 || t.note) && (
                  <div class="mt-2 text-[12px] text-dim">
                    {ex.length > 0 && (
                      <span>accounts: {ex.map((e) => { const a = accMap.get(e.account); return `${a?.firm ?? ''} ${a?.sizeLabel ?? ''}${e.size && e.size > 1 ? ` ×${e.size}` : ''}` }).join(' · ')}</span>
                    )}
                    {t.note && <span class="text-soft"> — {t.note}</span>}
                  </div>
                )}
                {(t.screenshots?.length ?? 0) > 0 && (
                  <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {t.screenshots!.map((s) => (
                      <a href={s} target="_blank" class="block border border-line bg-bg transition-colors hover:border-accent">
                        <img src={s} alt={`trade ${i + 1} screenshot`} loading="lazy" class="w-full" />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </section>

    {d && (
      <section class="mt-10">
        <h2 class="text-lg">/ habits</h2>
        <div class="mt-3 flex flex-wrap gap-2">
          {habits.map((h) => {
            const done = (d.habits ?? {})[h.id] === true
            return (
              <span class="flex items-center gap-2 border px-3 py-1.5 text-[13px]" style={done ? `border-color:${h.data.color};color:${h.data.color}` : 'border-color:var(--color-line);color:var(--color-dim)'}>
                {h.data.emoji ?? '·'} {h.data.name} {done ? '✓' : '×'}
              </span>
            )
          })}
        </div>
      </section>
    )}

    {d?.device && (d.device.screenshots?.length ?? 0) > 0 && (
      <section class="mt-10">
        <h2 class="text-lg">/ screen time — proof</h2>
        <p class="mt-2 text-[13px] text-dim">{d.device.notes ?? 'no note'}</p>
        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {d.device.screenshots!.map((s) => (
            <a href={s} target="_blank" class="block border border-line bg-panel transition-colors hover:border-accent">
              <img src={s} alt="screen time screenshot" loading="lazy" class="w-full" />
            </a>
          ))}
        </div>
      </section>
    )}

    {newsFor && (dayRed.length > 0 || dayOrange.length > 0) && (
      <details class="group mt-10 border border-line bg-panel/50 px-4 py-3" open>
        <summary class="flex cursor-pointer list-none select-none items-center justify-between gap-3 text-[13px]">
          <span class="flex items-center gap-2 text-dim">
            <span>USD news</span>
            {dayHead && (
              <span class:list={['flex items-center gap-1.5 tabular-nums', dayHead.kind === 'red' ? 'text-down' : 'text-warn opacity-70']}>
                <span class:list={['inline-block h-1.5 w-1.5 rounded-full', dayHead.kind === 'red' ? 'bg-down' : 'bg-warn']}></span>
                {dayHead.time}
              </span>
            )}
          </span>
          <span class="text-dim transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div class="mt-2 flex flex-col gap-1 border-t border-line/50 pt-2">
          <NewsBlock red={dayRed} orange={dayOrange} />
        </div>
      </details>
    )}

    {briefFor && Brief && (
      <section class="mt-10 border border-line bg-panel/50 px-4 py-3">
        <div class="text-[13px] text-dim">/ brief</div>
        <div class="prose mt-2 [&>*]:text-[13px]"><Brief /></div>
      </section>
    )}

    {journalFor && Reflection && (
      <section class="mt-10">
        <h2 class="text-lg">/ reflection</h2>
        <div class="prose mt-4 max-w-3xl">
          {journalFor.data.summary && <p class="text-[13px] text-soft">{journalFor.data.summary}</p>}
          <Reflection />
        </div>
      </section>
    )}

    <Separator class="mt-10" />

    <section class="mt-8">
      <h2 class="text-lg">/ coach</h2>
      {coachFor && Coaching ? (
        <article class="mt-4 max-w-3xl border-l-2 border-line2 pl-6">
          <div class="flex flex-wrap items-center gap-3 text-[12px] text-dim">
            <span>{fmtDay(coachFor.data.date)}</span>
            {coachFor.data.summary && <span class="text-soft">{coachFor.data.summary}</span>}
          </div>
          <div class="prose mt-4"><Coaching /></div>
        </article>
      ) : (
        <p class="mt-3 text-[13px] text-faint">no coaching session this day.</p>
      )}
    </section>
  </div>
</Base>
```

Notes: `dayFacts(d, habitTotal)` and `resolveMoments(d)` accept the day's data — cast via `as any` if the collection entry type is strict; do not add new lib code. The facts strip renders mood/sleep/screen/habits/trades/R once each. Moments show ONLY published `stream` entries. Trades show `model` Badge + `commentary` — both previously invisible on public pages. The `num-up`/`num-down` classes already exist in the design system.

- [ ] **Step 3: Delete the cockpit**

```bash
rm -rf src/components/cockpit
```

Then verify nothing else references it:
```bash
grep -rn "cockpit" src/ --include='*.astro' --include='*.ts' --include='*.tsx' | grep -v node_modules
```
Expected: only the `src/config/cockpit.json` file itself (now unreferenced — leave the file; it's git-tracked data, not code). If any page still imports cockpit components, fix the import before deleting.

- [ ] **Step 4: Typecheck** (controller runs centrally) + build + smoke test

The controller runs `npm run typecheck` (expect 0 errors), then `npm run build`, then verifies a sample day page:
```bash
curl -s http://127.0.0.1:4323/day/05-aug-2026/ | grep -c "MomentCard\|day facts\|/ moments\|/ trades"
```
Expected: the archive structure present; no cockpit classes (`.ck`, `ck-rail`, `DayTimeline`). Also verify the `models` Badge appears on a day with tagged trades.

- [ ] **Step 5: Commit**

```bash
git add src/pages/day/\[date\].astro src/components/archive/DayArchive.astro
git add -u src/components/cockpit
git commit -m "feat(public): posterized day archive — facts + moments + model-tagged trades; delete cockpit mirror"
```

---

### Task 2: `/models` page + `src/lib/models.ts` aggregation

**Files:**
- Create: `src/lib/models.ts`
- Create: `src/pages/models.astro`
- Modify: `src/components/Nav.astro` (add `/models` entry)

**Interfaces:**
- Consumes: `getCollection('days')` + `getCollection('models')`, `ROf`/`riskOf` from `src/lib/stream.ts`, `fmtDay` from `src/lib/dates.ts`, ui primitives (`Card`, `Badge`, `StatCard`, `Table`, `EmptyState`, `Separator`, `Dot`), `Base` layout.
- Produces: `buildModelStats(days, models): ModelStat[]` where `ModelStat = { slug, name, premise, status, order, rules: string[], trades: { iso, market, direction, session, setup, entry, exit, stop, points, R, note }[], count, sumR, avgR, winRate, bestR, worstR, lastIso }`. `/models` renders per model: name + status Badge + premise + rules list + stat cards (trades, total R, avg R, win rate) + recent trades table (last 8, linked to `/day/<fmtDay(iso)>`). Nav gains `models` (after `performance`).

- [ ] **Step 1: Create `src/lib/models.ts`**

```ts
import type { CollectionEntry } from 'astro:content'
import { ROf } from './stream'

export interface ModelTradeRow {
  iso: string
  market: string
  direction: 'long' | 'short'
  session?: string
  setup?: string
  entry: number
  exit: number
  stop?: number
  points: number
  R: number
  note?: string
}

export interface ModelStat {
  slug: string
  name: string
  premise?: string
  status: 'active' | 'paused' | 'retired'
  order: number
  rules: string[]
  trades: ModelTradeRow[]
  count: number
  sumR: number
  avgR: number
  winRate: number // 0..1
  bestR: number
  worstR: number
  lastIso: string | null
}

type DayEntry = CollectionEntry<'days'>
type ModelEntry = CollectionEntry<'models'>

export function buildModelStats(days: DayEntry[], models: ModelEntry[]): ModelStat[] {
  return models
    .map((m) => {
      const rows: ModelTradeRow[] = []
      for (const day of days) {
        for (const t of day.data.trades ?? []) {
          if (t.model !== m.id) continue
          rows.push({
            iso: day.data.date,
            market: t.market ?? 'MNQ',
            direction: t.direction,
            session: t.session,
            setup: t.setup,
            entry: t.entry,
            exit: t.exit,
            stop: t.stop,
            points: t.points,
            R: ROf(t),
            note: t.note,
          })
        }
      }
      const count = rows.length
      const sumR = rows.reduce((s, r) => s + r.R, 0)
      const wins = rows.filter((r) => r.R > 0).length
      return {
        slug: m.id,
        name: m.data.name ?? m.id,
        premise: m.data.premise,
        status: m.data.status ?? 'active',
        order: m.data.order ?? 0,
        rules: m.data.rules ?? [],
        trades: rows,
        count,
        sumR,
        avgR: count > 0 ? sumR / count : 0,
        winRate: count > 0 ? wins / count : 0,
        bestR: count > 0 ? Math.max(...rows.map((r) => r.R)) : 0,
        worstR: count > 0 ? Math.min(...rows.map((r) => r.R)) : 0,
        lastIso: count > 0 ? rows[rows.length - 1].iso : null,
      }
    })
    .sort((a, b) => a.order - b.order)
}
```

- [ ] **Step 2: Create `src/pages/models.astro`**

```astro
---
import Base from '../layouts/Base.astro'
import { getCollection } from 'astro:content'
import { buildModelStats } from '../lib/models'
import { fmtDay } from '../lib/dates'
import { Card } from '../components/ui/Card.astro'
import { Badge } from '../components/ui/Badge.astro'
import { StatCard } from '../components/ui/StatCard.astro'
import { Table } from '../components/ui/Table.astro'
import { EmptyState } from '../components/ui/EmptyState.astro'
import { Separator } from '../components/ui/Separator.astro'

const [days, models] = await Promise.all([getCollection('days'), getCollection('models')])
const stats = buildModelStats(days, models)
const statusTone = (s: string) => (s === 'active' ? 'up' : s === 'paused' ? 'warn' : 'muted')
---

<Base
  title="models — 1ed.ge"
  description="The trading models behind every logged trade — premise, rules, and the trades that ran them."
>
  <div class="shell pt-12 pb-20">
    <header class="flex items-baseline gap-3 text-[13px]">
      <span class="text-ink">models</span>
      <span class="text-faint">{stats.length} models · {stats.reduce((s, m) => s + m.count, 0)} tagged trades</span>
    </header>

    {stats.length === 0 ? (
      <div class="mt-6"><EmptyState text="no trading models yet." /></div>
    ) : (
      <div class="mt-6 space-y-8">
        {stats.map((m) => (
          <Card key={m.slug}>
            <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 class="text-xl">{m.name}</h2>
              <Badge variant={statusTone(m.status)}>{m.status}</Badge>
              {m.lastIso && (
                <span class="ml-auto text-[12px] text-faint">last trade {fmtDay(m.lastIso)}</span>
              )}
            </div>
            {m.premise && <p class="mt-2 max-w-2xl text-[13px] text-dim">{m.premise}</p>}

            {m.rules.length > 0 && (
              <div class="mt-4">
                <div class="text-2xs uppercase tracking-widest text-dim">rules</div>
                <ul class="mt-2 space-y-1">
                  {m.rules.map((r, i) => (
                    <li key={i} class="flex items-baseline gap-2 text-[13px] text-soft">
                      <span class="text-faint">{i + 1}.</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div class="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatCard label="trades" value={String(m.count)} />
              <StatCard label="total R" value={`${m.sumR >= 0 ? '+' : ''}${m.sumR.toFixed(2)}`} tone={m.sumR >= 0 ? 'up' : 'down'} />
              <StatCard label="avg R" value={`${m.avgR >= 0 ? '+' : ''}${m.avgR.toFixed(2)}`} tone={m.avgR >= 0 ? 'up' : 'down'} />
              <StatCard label="win rate" value={`${Math.round(m.winRate * 100)}%`} />
            </div>

            {m.count > 0 && (
              <div class="mt-4">
                <div class="text-2xs uppercase tracking-widest text-dim">recent trades</div>
                <Table
                  head={['day', 'market', 'dir', 'setup', 'session', 'R', 'points']}
                  class="mt-2"
                >
                  {m.trades.slice(-8).reverse().map((t, i) => (
                    <tr key={i}>
                      <td><a href={`/day/${fmtDay(t.iso)}`} class="text-accent hover:underline">{fmtDay(t.iso)}</a></td>
                      <td>{t.market}</td>
                      <td>{t.direction === 'long' ? '▲' : '▼'}</td>
                      <td>{t.setup ?? '—'}</td>
                      <td>{t.session ?? '—'}</td>
                      <td class:list={[t.R >= 0 ? 'text-up' : 'text-down']}>{t.R >= 0 ? '+' : ''}{t.R.toFixed(2)}</td>
                      <td class:list={[t.points >= 0 ? 'text-up' : 'text-down']}>{t.points >= 0 ? '+' : ''}{t.points}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Card>
        ))}
      </div>
    )}
    <Separator class="mt-10" />
    <p class="mt-4 text-[11px] text-faint">models and their rules are the owner's own — never AI-generated.</p>
  </div>
</Base>
```

Check `Table.astro`'s actual slot contract (from recon: `head: string[]` + slot = `<tr>` rows with `.th`/`.td` classes) and `StatCard` props (`label`, `value`, `delta?`, `tone?: 'up'|'down'|'default'`) — adjust the markup to the real primitive props if they differ. Verify the `Table` head alignment prop usage matches its implementation.

- [ ] **Step 3: Add `/models` to Nav**

In `src/components/Nav.astro`, add after the `performance` entry:

```astro
{ href: '/models', label: 'models', n: '05' },
```

and renumber the following entries (`accounts` → `06`, `about` → `07`). Verify the nav renders exactly once on the homepage (the `aria-current` logic uses exact pathname match — `/models` works as-is).

- [ ] **Step 4: Typecheck** (controller centrally) + build + smoke test

```bash
curl -s http://127.0.0.1:4323/models/ | grep -c "orb-drive\|liquidity-breakdown\|recent trades\|win rate"
```
Expected: all 4 seeded models present with stats and trade tables; nav shows `[05] models`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/models.ts src/pages/models.astro src/components/Nav.astro
git commit -m "feat(public): /models page — per-model premise, rules, stats, recent trades"
```

---

### Task 3: Journal index rebuilt on primitives + lean search index

**Files:**
- Rewrite: `src/pages/journal/index.astro` (244 lines today)

**Interfaces:**
- Consumes: `getCollection('journal')` + `getCollection('days')`, `fmtDay` from `src/lib/dates.ts`, ui primitives (`Card`, `Badge`, `Tag`, `EmptyState`, `Icon`, `Input`, `Separator`), `Base` layout.
- Produces: same page URL, same client-side search behavior (ranked token search, `/` focus, `Esc` clear, sticky month chips, `#back-top`, `__jumpDay` date input), but: (a) list markup built from primitives, (b) the inline `#journal-index` JSON is LEAN — drop the full `dayText` trade dump from `meta` (that's the ~142KB bloat; keep title/summary/tags/date + a short excerpt), (c) page size target well under 100KB.

- [ ] **Step 1: Understand the current file**

Read `src/pages/journal/index.astro` fully (244 lines). Note exactly: the `dayText()` helper (lines 17–32) that inlines the FULL day record into each index entry's `meta` — THIS is the bloat; the search index JSON alone is ~142KB of the ~287KB page. The client search logic (tokenize → `matchTok` → title ×3 / meta ×2 / body ×1) must be preserved.

- [ ] **Step 2: Rewrite the index builder (lean)**

Replace the per-post `meta` construction. Instead of `meta: date + summary + tags + dayText(day)`, build:

```ts
const excerpt = (body: string) => body.replace(/[#*`>\-\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
```

and per post build `{ id, date, title: data.day ?? date, summary, tags, mood, trades: day?.trades.length ?? 0, meta, body: excerpt(j.body ?? '') }` where `meta = [date, data.day ?? '', summary, tags.join(' ')].join(' ')`. **Drop the `dayText(day)` helper entirely** (delete the function). Keep `body` as a 600-char excerpt (still weighted ×1 in search, tiny vs the old full-body strings). This alone should cut the index from ~142KB to ~30KB.

- [ ] **Step 3: Rebuild the list markup on primitives**

Replace the hand-rolled `panel` list rows (lines ~104–120) with the ui primitives. For each post row use `Card` (or `Card pad="sm"`), a `Badge` for mood when set, `Tag` for `#tags`, and keep the existing link/title/date/summary structure. Match the established `/stream` and `/` visual language (`.shell`, `max-w-2xl` stacks, `gap-3`). Keep the sticky month chips, the `/` and `Esc` handlers, `#back-top`, `__jumpDay`, and the exact same `#journal-index` JSON blob mechanism (`<script type="application/json" id="journal-index" set:html={...} is:inline>` with the `<` → `\u003c` escape). Do not change the search algorithm's behavior — only its input size and the rendered markup.

- [ ] **Step 4: Typecheck** (controller centrally) + build + size check

```bash
ls -la dist/client/journal/index.html
grep -c "journal-index" dist/client/journal/index.html
```
Expected: page well under 100KB (target ≤ 80KB); search still wired. Smoke: `curl http://127.0.0.1:4323/journal/` returns 200 with posts listed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/journal/index.astro
git commit -m "feat(public): /journal on primitives — lean search index, tokenized list markup"
```

---

## Self-review notes

- **Spec §6 coverage:** `/day` posterized archive (Task 1) ✓, `/models` (Task 2) ✓, `/journal` rebuilt on primitives (Task 3) ✓. `/stream` + `/` hero already live (prior sessions). `/performance`, `/accounts`, `/calendar`, `/coach`, `/about` tokenization + money-color fixes are Phase 4 — NOT in this plan.
- **Corrections to stale MEMORY:** journal is STATIC with client-side search (not SSR `?q=`) — the plan preserves the shipped client search; the SSR claim in MEMORY is obsolete. The day page today is the cockpit mirror (CockpitPage) — Task 1 replaces it entirely.
- **First consumer of `ui/*` primitives** — the plan deliberately routes markup through them (Card/Badge/Table/StatCard/EmptyState). Implementers must check each primitive's real props (recon listed them, but verify against source) — the plan's JSX is a faithful rendering of the recon props.
- **No AI gyaan:** `/models` renders owner-authored premises/rules verbatim, plus a footer line "models and their rules are the owner's own — never AI-generated."
- **Type consistency:** `ModelStat` fields in Task 2 Step 1 match their consumers in Step 2. `dayFacts(d, habitTotal)` and `resolveMoments(d)` match the recon signatures from `stream.ts`. `ROf(t)` takes a `DayTrade`.
- **Dependency ordering:** Tasks 1, 2, 3 are write-disjoint and can run in parallel (Wave 1), gated by one central typecheck + one build, then per-task reviews. Delete-cockpit (Task 1 Step 3) is safe because grep confirmed no other consumer. `src/config/cockpit.json` stays (data, harmless).
- **Deferred (Phase 4):** money-color fixes on other pages, tablet breakpoint, sticky subnav, journal API path traversal, rebuild mutex, unit tests for stats/sessions/timeline, `--font-display` phantom, dead CSS purge, lighthouserc dead URLs.
