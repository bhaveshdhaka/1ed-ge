# Zen Day Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the /zen "day" tab (DayWorkspace.tsx) as a single quiet column of five stacked zones on the generational-leap primitives (⌘K, dnd, sheets, sonner, badges, TanStack), with thoughts-vs-reflection as distinct entities, multi-model trade cards, AI ghost-text writing assist, and one faint statusline carrying the day readout.

**Architecture:** One React surface at /zen, consuming the shadcn-style admin batch recipes (Command, Sheet, Sonner, Badge, Kbd, Field, Popover, Empty, Table, dnd-kit) as native chrome. The existing codebase (DayWorkspace.tsx at 1245 lines) is replaced by ~15 new focused components and 3 sheets. Public pages (DayArchive.astro, MomentCard.astro, /day, /stream) update to read `models: string[]` and render multi-model chips. A new `orChatStream()` + `/api/admin/complete` route powers the ghost-text overlay on both writing surfaces. The shell introduces `useHktNow()` for the rail's now-marker and the obligation chip's countdown.

**Tech Stack:** React 19 + Tailwind v4 + TypeScript + Astro (SSR with direct disk reads for instant public updates). New deps: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`, `@tanstack/react-table@9`, `cmdk`, `sonner`, `eventsource-parser`, `textarea-caret-position`. All admin-only, no JS shipped to public pages.

## Global Constraints

- **Terminal aesthetic:** JetBrains Mono everywhere, off-black (#07080c), no rounded corners (2px radius), hairlines on 4px grid
- **Public pages:** zero-JS (React island at /zen ONLY — public DayArchive, MomentCard, /day, /stream stay pure Astro)
- **Color discipline** (m3 §4.3): ink/soft/dim/faint/up(#4ade80)/down(#f87171)/warn/accent/purp — each token one job, color is data/state never decoration
- **Motion budget:** caret blink + due-pulse (2s opacity, only past-grace) + 60ms opacity fade (sheets/palette/sonner/dnd) + 200ms ceremony mode (reflection editor focus dims siblings)
- **Spacing:** strict 4px grid, zone gap 32, intra-zone 16, chips 28px, hit targets 36-40 fine / 44 coarse
- **Type:** writing 15px/1.8 (reflection ONLY), thoughts 14px/1.5, data 12-13px/1.0-1.3, labels 11px uppercase tracking 0.14em
- **isTyping() guard stays** — bare keys never fire while a field is focused; ⌘/Ctrl combos always fire
- **Fresh slate, no migration needed** — schema changes are clean, no back-compat data burden
- **Every task ends with** `npm run typecheck` — 0 errors, 0 warnings
- **Design spec reference:** `docs/superpowers/specs/2026-08-09-zen-day-surface-design-m3.md` — the m3 pass with 10 divergences
- **Key reversal from m3:** thoughts do NOT auto-publish on blur — ⌘⏎ is the sole publish gesture (matches the owner's stated preference). The m3's §3.1 "auto-publish-on-blur contract" is REJECTED.
- **`models: string[]` schema:** the read fallback is `models ?? (model ? [model] : [])` — legacy `model: "orb-drive"` files surface as `models: ["orb-drive"]` everywhere, no migration needed
- **SSR + direct disk reads:** `/day/[date]` and `/stream` read day records via `readEntry()` / `listMds()` (not `getCollection()`) for instant public updates (~100ms)
- **Mobile / iOS Safari:** the publish button is the PRIMARY publish gesture on all devices — ⌘⏎ is a desktop convenience only. On iPhone (no ⌘ key, no physical keyboard), the visible publish button in the composer footer and reflection zone is the only path. dnd-kit must configure `TouchSensor` for drag-drop on touch devices. Ghost-text (`textarea-caret-position`) must be verified on iOS Safari. The existing iOS hardening (44px touch targets, safe-area insets, `-webkit-touch-callout`, `overscroll-behavior: none`, viewport-fit=cover) applies unchanged.

---

### Task 0: Install the generation-leap deps

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated)

**Interfaces:**
- Produces: all 9 packages available for subsequent tasks

- [ ] **Step 1: Install the 9 admin-batch packages**

```bash
npm i @dnd-kit/core@6 @dnd-kit/sortable@10 @dnd-kit/modifiers @dnd-kit/utilities @tanstack/react-table@9 cmdk@1 sonner@2 eventsource-parser@3 textarea-caret-position@0.1
```

- [ ] **Step 2: Verify install**

```bash
npm ls @dnd-kit/core cmdk sonner @tanstack/react-table eventsource-parser textarea-caret-position 2>&1 | head -15
```
All 6 should resolve to versions and show `deduped` or no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): install admin-batch packages (dnd-kit, TanStack, cmdk, sonner, ghost-text)"
```

---

### Task 1: Models schema migration (`model` → `models[]`)

**Files:**
- Modify: `src/content.config.ts` — trade schema
- Modify: `src/pages/api/admin/days.ts` — GET + POST trade normalization
- Modify: `src/lib/stream.ts` — `DayTrade`, `ResolvedMoment`

**Interfaces:**
- Produces: `trade.models: string[]` (with read fallback `models ?? (model ? [model] : [])`) in the schema, API, and stream types
- Consumed by: Tasks 2, 5, 8 (TradeCard, public renderers, models stats)

- [ ] **Step 1: Update `src/content.config.ts` trade schema**

Add `models: z.array(z.string()).default([])` to the trade object (after the existing `model: z.string().optional()` line). Keep `model` optional for back-compat reads. The build reads `models ?? (model ? [model] : [])`; the write path persists `models`.

```ts
// In the trade schema object (around line 53, after `model: z.string().optional()`):
models: z.array(z.string()).default([]),
```

- [ ] **Step 2: Update `src/pages/api/admin/days.ts` — GET path**

In `normalizeTrade` (around line 31-41), add `models` after `model`:

```ts
model: typeof t.model === 'string' && t.model.trim() ? String(t.model).trim() : undefined,
models: Array.isArray(t.models) ? t.models.map(String).filter((m) => m.trim()) : undefined,
```

In the day load path where trades are parsed (around lines 145-165), add `models` mapping:

```ts
models: Array.isArray(t.models) ? t.models.map(String) : (typeof t.model === 'string' ? [t.model] : []),
```

- [ ] **Step 3: Update `src/pages/api/admin/days.ts` — write path**

In the trade save normalization, serialize `models` after `model`:

```ts
...(Array.isArray(t.models) && t.models.length ? { models: t.models.map(String).filter((m: string) => m.trim()) } : {}),
```

- [ ] **Step 4: Update `src/lib/stream.ts` — types**

In the `DayTrade` interface (around line 22-27), add:

```ts
models?: string[]
```

In `resolveMoments`, the `ResolvedMoment.trade` object (around line 96), add:

```ts
models: t.models ?? (t.model ? [t.model] : []),
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts src/pages/api/admin/days.ts src/lib/stream.ts
git commit -m "feat(trade): schema migration model→models[] with read fallback"
```

---

### Task 2: Public renderers — multi-model chips

**Files:**
- Modify: `src/components/archive/DayArchive.astro` — trade panel chips
- Modify: `src/components/stream/MomentCard.astro` — stream moment chips
- Modify: `src/lib/models.ts` — per-model stats iteration
- Modify: `src/lib/period-stats.ts` — per-model stats iteration
- Modify: `src/components/period/PeriodReview.astro` — period-review model chips

**Interfaces:**
- Consumes: `trade.models: string[]` from Task 1
- Produces: public pages render multiple model badges, per-model stats count correctly

- [ ] **Step 1: Update `src/components/archive/DayArchive.astro`**

Replace the single Badge at line 95 (`{t.model && <Badge variant="accent">{t.model}</Badge>}`) with:

```astro
{t.models?.length ? t.models.map((m, i) => <Badge variant={i === 0 ? 'accent' : 'default'}>{m}</Badge>) : (
  t.model ? <Badge variant="accent">{t.model}</Badge> : null
)}
```

- [ ] **Step 2: Update `src/components/stream/MomentCard.astro`**

Replace line 42 (`moment.trade.model ?? moment.trade.setup ?? 'no model'`) with:

```astro
{moment.trade.models?.length ? moment.trade.models.join(' · ') : (moment.trade.model ?? moment.trade.setup ?? 'no model')}
```

- [ ] **Step 3: Update `src/lib/models.ts`**

In `buildModelStats` (around line 44, `if (t.model !== m.id) continue`), iterate the array:

```ts
const models = t.models ?? (t.model ? [t.model] : [])
if (!models.includes(m.id)) continue
```

- [ ] **Step 4: Update `src/lib/period-stats.ts`**

Around lines 99-106 (the per-model block), iterate `t.models ?? []`:

```ts
const tradeModels = t.models ?? (t.model ? [t.model] : [])
if (!tradeModels.length) continue
for (const m of tradeModels) {
  const cur = models.get(m) ?? { count: 0, sumR: 0 }
  cur.count++
  cur.sumR += /* R computation */
  models.set(m, cur)
}
```

- [ ] **Step 5: Update `src/components/period/PeriodReview.astro`**

Replace line 240 (`<Badge variant="accent">{row.model}</Badge>`) with iteration:

```astro
{row.models?.length ? row.models.map((m, i) => <Badge variant={i === 0 ? 'accent' : 'default'}>{m}</Badge>) : (
  row.model ? <Badge variant="accent">{row.model}</Badge> : null
)}
```

- [ ] **Step 6: Update `src/pages/api/admin/reviews.ts`** `toDayData` reparse

Around line 94 (`if (typeof t.model === 'string' && t.model) trade.model = t.model`), add:

```ts
if (typeof t.model === 'string' && t.model) trade.model = t.model
if (Array.isArray(t.models)) trade.models = t.models.filter((m: unknown) => typeof m === 'string')
```

- [ ] **Step 7: Typecheck + commit**

```bash
npm run typecheck
git add src/components/archive/DayArchive.astro src/components/stream/MomentCard.astro src/lib/models.ts src/lib/period-stats.ts src/components/period/PeriodReview.astro src/pages/api/admin/reviews.ts
git commit -m "feat(public): multi-model chips in DayArchive, MomentCard, PeriodReview, stats"
```

---

### Task 3: `useHktNow()` — shared clock hook

**Files:**
- Create: `src/lib/clock.ts`

**Interfaces:**
- Produces: `useHktNow(): Date` — a React hook returning the current HKT time, ticked every 60s client-side, server-rendered on mount
- Consumed by: Tasks 4 (DayRail now-marker), 7 (ObligationChip countdown)

- [ ] **Step 1: Create `src/lib/clock.ts`**

```ts
import { useState, useEffect } from 'react'

/** Current HKT date, ticked every 60 seconds on the client.
 *  On first render returns server time; hydrates on mount. */
export function useHktNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  return now
}

/** HKT time string (HH:MM) from a Date, usable server-side too. */
export function hktHHMM(d: Date): string {
  const hh = String(d.getUTCHours() + 8).padStart(2, '0')  // HKT = UTC+8
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/clock.ts
git commit -m "feat(clock): useHktNow hook + hktHHMM helper for client-side HKT time"
```

---

### Task 4: `DayRail` — the 44px time-axis rail

**Files:**
- Create: `src/components/admin/DayRail.tsx`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — replace the 210px aside (lines 748-800) with `<DayRail>`

**Interfaces:**
- Consumes: `useHktNow()` from Task 3, `DayListItem[]` (existing `daysList` state), current `date`, `selectDate` callback, `allDates` for obligation detection
- Produces: `<DayRail>` component — a vertical 44px strip of day cells, today ringed in accent, now-marker crossing at current HKT minute, pending-reflection bar on cells with overdue obligations

- [ ] **Step 1: Create `src/components/admin/DayRail.tsx`**

A React component with these props:

```ts
interface DayRailProps {
  days: DayListItem[]           // from loadDays
  selectedDate: string          // current date
  onSelectDate: (d: string) => void
  allDatesIso: string[]         // all dates with content (from DayArchive prop)
  /** Set of ISO dates that have a pending/overdue reflection obligation */
  pendingObligationDates?: Set<string>
}
```

The rail renders a vertical flex column of cells (one per logged day), 8-16px tall depending on trade count, filled `up`/`down` by ΣR sign, today ringed accent. The `now` marker is a 1px horizontal accent line at the cell corresponding to the current HKT minute (using `useHktNow()`). Future days above the marker are `pointer-events-none` + faint. Hover tooltip shows date + R + trades. Arrow-key navigation. `<700px`: horizontal row under the header.

The rail replaces the 210px `<aside>` (lines 748-800 of DayWorkspace.tsx). The existing mini-calendar logic (12-week window, M-T-W-T-F-S-S header) moves to `DayPickerSheet` (Task 10). The recent-14 list is folded into the rail. The `daysList.slice(0,14)` logic is no longer needed.

- [ ] **Step 2: Wire into `DayWorkspace.tsx`**

Replace lines 748-800 (the `<aside>` block with sidebar, calendar, recent days) with:

```tsx
<DayRail
  days={daysList}
  selectedDate={date}
  onSelectDate={selectDate}
  allDatesIso={daysList.map(d => d.date)}
  pendingObligationDates={pendingObligationDates}
/>
```

The `pendingObligationDates` prop comes from `accountabilityStatus()` computed on the server and passed down as a prop. For this task, pass an empty `Set` — it gets wired in Task 7.

- [ ] **Step 3: Add `pendingObligationDates` state to DayWorkspace**

```ts
const [pendingObligationDates, setPendingObligationDates] = useState<Set<string>>(new Set())
```

(Placeholder; Task 7 fills it.)

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/DayRail.tsx src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(day-rail): DayRail time-axis replacing 210px aside"
```

---

### Task 5: `TradeCard` + `ModelChipRow` — multi-model accordion

**Files:**
- Create: `src/components/admin/TradeCard.tsx`
- Create: `src/components/admin/ModelChipRow.tsx`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — replace the existing trade card rendering (lines 968-1100) with `<TradeCard>`

**Interfaces:**
- Consumes: `trade.models: string[]` from Task 1, `models[]` (the models library list — already loaded as `models` state), `TradeForm` interface (existing), `setTrade` callback, `accountLabel` helper
- Produces: `<TradeCard>` + `<ModelChipRow>` — collapsed accordion row (chevron + direction/market + up to 2 model chips with primary accent + session + R/pts) expanding to model chip row (each removable, `+ add model ▾` Popover with premise tooltip) + commentary + numbers line + tag row + executions + charts

- [ ] **Step 1: Create `src/components/admin/ModelChipRow.tsx`**

Props:

```ts
interface ModelChipRowProps {
  models: string[]                      // current attached model slugs
  allModels: { slug: string; name: string; premise?: string }[]  // library list
  onAdd: (slug: string) => void
  onRemove: (slug: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
}
```

Renders a horizontal flex row of chips. First chip = `Badge variant="accent"` + 2px accent left bar (`⌗` mark). Remaining chips = `Badge variant="default"`. Each chip has an `×` on hover (calls `onRemove`). `+ add model ▾` button opens a `Popover` listing unattached models by name + premise one-liner (from the `allModels` list — note: `premise` field must be added to the models GET in the days API if not already present; see Step 3). dnd-kit reorder on chips (⠿ handle on hover).

- [ ] **Step 2: Create `src/components/admin/TradeCard.tsx`**

Props:

```ts
interface TradeCardProps {
  index: number
  trade: TradeForm
  allModels: { slug: string; name: string; premise?: string }[]
  accountLabel: (id: string) => string
  accounts: AccRow[]
  onChange: (patch: Partial<TradeForm>) => void
  expanded: boolean
  onToggle: () => void
}
```

Collapsed row: `▸/▾` chevron + `▲/▼` arrow (text-up/text-down) + market name + up to 2 model chips via `<ModelChipRow>` (always-visible in collapsed mode, no popover) + `+N` overflow Badge + session + R/pts right-aligned tabular-nums. Drag handle ⠿ (hover only, using `@dnd-kit`).

Expanded: model chip row (full `<ModelChipRow>` with add/remove/reorder) → commentary textarea → numbers line (entry/stop/exit/risk/pts, direct-click editable) → tag row (setup/session/direction/confidence — existing Select fields) → executions list → chart screenshot strip + paste zone. The `publish →` button on each expanded trade (⌘⏎ when focused) calls the existing `publishMoment` pattern with `type: 'trade'` and `tradeIdx`.

- [ ] **Step 3: Ensure `models` GET includes `premise`**

In `src/pages/api/admin/days.ts`, the GET handler (around line 85-88) reads models. Ensure the response includes `premise`:

```ts
const models = listMds('models').map((f) => {
  const data = readEntry('models', f).data as Record<string, unknown>
  return { slug: f.replace(/\.mdx?$/, ''), name: String(data.name ?? f), premise: String(data.premise ?? '') }
})
```

- [ ] **Step 4: Wire `TradeCard` into `DayWorkspace.tsx`**

Replace the existing trade rendering (lines 968-1100 = the `trades.map(...)` block) with:

```tsx
{trades.map((t, ti) => (
  <TradeCard
    key={ti}
    index={ti}
    trade={{ ...t, models: (t as any).models ?? (t.model ? [t.model] : []) }}
    allModels={models}
    accountLabel={accountLabel}
    accounts={accounts}
    onChange={(patch) => setTrade(ti, patch)}
    expanded={expandAll || expandedTrade === ti}
    onToggle={() => {
      if (expandAll) { setExpandAll(false); setExpandedTrade(ti) }
      else setExpandedTrade(expandedTrade === ti ? null : ti)
    }}
  />
))}
```

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/TradeCard.tsx src/components/admin/ModelChipRow.tsx src/components/admin/tabs/DayWorkspace.tsx src/pages/api/admin/days.ts
git commit -m "feat(trades): TradeCard + ModelChipRow with multi-model chips and primary chip accent"
```

---

### Task 6: `StatusLine` — the day-readout footer

**Files:**
- Create: `src/components/admin/StatusLine.tsx`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — add `<StatusLine>` at page bottom

**Interfaces:**
- Produces: `<StatusLine>` — one hairline-bordered strip at the page bottom showing `date · ΣR · N trades · habits · ⌘⏎ publish · saved HH:MM`. No obligation tail (obligation lives on Z5 frame per m3).
- Consumed by: integrated into DayWorkspace layout

- [ ] **Step 1: Create `src/components/admin/StatusLine.tsx`**

```tsx
interface StatusLineProps {
  date: string
  totalR: string       // e.g. "+0.82R"
  tradeCount: number
  habitsDone: number   // e.g. 4
  habitsTotal: number  // e.g. 6
  savedAt: string | null  // "22:41" or null
  showPublishHint: boolean // true when a writing surface has content
}

export function StatusLine(props: StatusLineProps) {
  return (
    <div className="border-t border-line px-3 py-1.5 text-[12px] text-faint tabular-nums">
      <span>{props.date}</span>
      <span className="mx-2">·</span>
      <span className={props.totalR.startsWith('+') ? 'text-up' : props.totalR.startsWith('-') ? 'text-down' : ''}>{props.totalR}</span>
      <span className="mx-2">·</span>
      <span>{props.tradeCount}t</span>
      <span className="mx-2">·</span>
      <span>habits {props.habitsDone}/{props.habitsTotal}</span>
      {props.showPublishHint && <><span className="mx-2">·</span><span>⌘⏎ publish</span></>}
      {props.savedAt && <><span className="mx-2">·</span><span>saved {props.savedAt}</span></>}
    </div>
  )
}
```

- [ ] **Step 2: Wire into `DayWorkspace.tsx`**

Add a `savedAt` state: `const [savedAt, setSavedAt] = useState<string | null>(null)`. Set it to the current HH:MM after every autosave succeeds. Compute `showPublishHint` from `reflection.trim() || draftMoments.length`.

Add `<StatusLine ... />` at the bottom of the DayWorkspace return (before the closing `</div>` of the main container).

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/StatusLine.tsx src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(statusline): StatusLine day-readout footer replacing zenLine banner"
```

---

### Task 7: `ReflectionZone` + `ObligationChip` + `CeremonyMode`

**Files:**
- Create: `src/components/admin/ReflectionZone.tsx`
- Create: `src/components/admin/ObligationChip.tsx`
- Create: `src/components/admin/CeremonyMode.tsx` (provider + hook)
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — replace the existing reflection card (lines 1180-1240) with `<ReflectionZone>`

**Interfaces:**
- Consumes: `useHktNow()` from Task 3, `accountabilityStatus()` from `src/lib/accountability.ts`, existing reflection state (reflection, title, summary, tags, featuredImage, content), existing publishReflection/publishDraft functions
- Produces: `<ReflectionZone>` with obligation chip header, title/summary/tags row, MarkdownEditor, publish button + `⌘⏎`, ceremony mode (focus dims siblings to 40%, raises Z5 to panel)

- [ ] **Step 1: Create `src/components/admin/CeremonyMode.tsx`**

A React context provider + hook:

```tsx
import { createContext, useContext, useState, ReactNode } from 'react'

const CeremonyContext = createContext<{
  active: boolean
  setActive: (v: boolean) => void
}>({ active: false, setActive: () => {} })

export function CeremonyProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  return <CeremonyContext.Provider value={{ active, setActive }}>{children}</CeremonyContext.Provider>
}

export function useCeremony() { return useContext(CeremonyContext) }
```

Wrap the DayWorkspace return in `<CeremonyProvider>`.

- [ ] **Step 2: Create `src/components/admin/ObligationChip.tsx`**

Props:

```ts
interface ObligationChipProps {
  dueType: 'daily' | 'week' | 'quarter' | 'h1' | 'year' | null
  status: 'done' | 'grace' | 'overdue'
  graceUntil?: Date   // 03:00 HKT boundary
  onClick: () => void
}
```

Renders a `Badge`: in-grace = `warn` text with live countdown via `useHktNow()` ("due in 4h 22m"), overdue = `down` + 2s pulse, done = faint `up` text ("· fri", relaxed). Click scrolls to Z5 top or switches to reviews tab (for period rungs).

The `useHktNow()` hook ticks the countdown display every 60s.

- [ ] **Step 3: Create `src/components/admin/ReflectionZone.tsx`**

Props:

```ts
interface ReflectionZoneProps {
  reflection: string
  title: string
  summary: string
  tags: string
  featuredImage: string
  content: string       // published body for comparison
  onReflectionChange: (v: string) => void
  onTitleChange: (v: string) => void
  onSummaryChange: (v: string) => void
  onTagsChange: (v: string) => void
  onPublish: () => void
  onAIDraft: () => void
  draftBusy: boolean
  saving: boolean
  /** Obligation state computed from accountabilityStatus() */
  obligation: { type: string; status: 'done' | 'grace' | 'overdue'; graceUntil?: Date } | null
  onObligationClick: () => void
}
```

- When the editor gains focus: call `useCeremony().setActive(true)` → Z1–Z4 wrap in a div that gets `opacity-40 transition-opacity duration-200` when `ceremonyActive` is true. Z5 gets `panel` class.
- Header row: `reflection · the end-of-day ritual` + `<ObligationChip>`.
- Title row: three `Field` inputs (title/summary/tags) on one line.
- Body: `<MarkdownEditor>` (the existing component) with 15px/1.8 prose.
- Action row: `[AI draft from today]` button + `publish reflection ⌘⏎` primary button.
- Published status: faint `up` line `● published to /journal` + `view →` link. When draft differs from live: faint `warn` `● draft differs from live · republish to overwrite`.

- [ ] **Step 4: Wire into `DayWorkspace.tsx`**

Replace lines 1180-1240 (reflection card) with `<ReflectionZone>`. Compute obligation from `accountabilityStatus()`. Wire up `publishReflection` (existing function) to the publish button and `⌘⏎` handler.

- [ ] **Step 5: Populate `pendingObligationDates` for the DayRail**

In the DayWorkspace, compute `pendingObligationDates` from the same `accountabilityStatus()` call (or a simpler check: `pendingDays` + pending period dates). Pass to `<DayRail>`.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/ReflectionZone.tsx src/components/admin/ObligationChip.tsx src/components/admin/CeremonyMode.tsx src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(reflection): ReflectionZone + ObligationChip + CeremonyMode, Z5 frame with obligation"
```

---

### Task 8: `ThoughtsSurface` + `CheckInBand` + `HabitRow` — the remaining zones

**Files:**
- Create: `src/components/admin/ThoughtsSurface.tsx`
- Create: `src/components/admin/CheckInBand.tsx`
- Create: `src/components/admin/HabitRow.tsx`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — replace remaining zone rendering

**Interfaces:**
- Consumes: existing state (dayText, dayImages, draftMoments, stream, tendencies, trades, habitDefs, mood/sleep/device state)
- Produces: Z1 (check-in band), Z2 (thoughts surface with composer + draft/live lists + dnd), Z3 (habit chip row)

- [ ] **Step 1: Create `src/components/admin/CheckInBand.tsx`**

One compact horizontal strip: mood/sleep/screen/mac/habits/R from `dayFacts()`. Values are direct-click editable (the existing `editableHint` dashed-underline). `evidence ▸` opens AIBuildSheet (via ⌘K or a small button). Market line above: `market ● open · closes in 3h 12m` (reuses `strip.ts` segments).

- [ ] **Step 2: Create `src/components/admin/ThoughtsSurface.tsx`**

Composer: single growing textarea, placeholder `what happened — ⌘⏎ publishes`, no auto-publish on blur (⌘⏎ only — per the owner's reversal). The `note | quote | trade` type segmented control in footer. Below: draft moments (warn "not public") + published moments (MomentCard rows). Both lists dnd-reorderable (⠿ handle hover). `polish` button on drafts. Publish = `⌘⏎` moves draft → stream.

**Key: NO auto-publish-on-blur.** The m3's §3.1 is reversed. Only ⌘⏎ publishes a thought.

- [ ] **Step 3: Create `src/components/admin/HabitRow.tsx`**

One horizontal row of chips: 28px, `raise` fill, done = habit-color fill with bg text. Count-habits show `12/30` and increment via `+`/`-` micro-buttons. `library ▸` link to the library tab.

- [ ] **Step 4: Wire all three zones into `DayWorkspace.tsx`**

Replace the capture card (lines 807-837), day-summary card (843-953), moments composer/renderer (existing moment lines), and habits section (934-951) with `<CheckInBand>`, `<ThoughtsSurface>`, `<HabitRow>` in the Z1→Z2→Z3 order.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/ThoughtsSurface.tsx src/components/admin/CheckInBand.tsx src/components/admin/HabitRow.tsx src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(zones): CheckInBand + ThoughtsSurface + HabitRow — Z1-Z3 on m3 design"
```

### Task 9: `CommandPalette` — ⌘K integration

**Files:**
- Create: `src/components/admin/CommandPalette.tsx`
- Modify: `src/components/admin/AdminApp.tsx` — replace `?` help modal + integrate ⌘K

**Interfaces:**
- Consumes: cmdk `Command` recipe, go/tab state from AdminApp
- Produces: `<CommandPalette>` — open/close, fuzzy filter, groups (go/write/build/jump/zen/view), Kbd affordances, the ghost-text toggle

- [ ] **Step 1: Create `src/components/admin/CommandPalette.tsx`**

Uses `cmdk`'s `Command` recipe (mono, dark, 2px radius, hairline border — terminal dialog). Groups per m3 §1.4: go (today, open day…, prev/next, live stream, preview), write (new thought/quote/trade, polish, add model), build (build day, import, AI draft, rebuild), jump (check-in/thoughts/habits/trades/reflection), zen (tabs), view (ghost-text toggle). Footer: `{date} · {n} draft change(s) · esc to close`.

The ghost-text toggle reads/writes `localStorage` key `1edge.ghostText`.

- [ ] **Step 2: Integrate into `AdminApp.tsx`**

Replace the `?` help modal (lines 204-226) with `⌘K` + `/` keyboard trigger:

```ts
if ((mod && e.key === 'k') || (!isTyping(e) && e.key === '/')) {
  e.preventDefault()
  setPaletteOpen((p) => !p)
  return
}
```

Remove the old `?` handler (line 118-121). Keep the existing shortcut table for display in the palette ("shortcuts" group).

- [ ] **Step 3: Fix `?` shortcut per approved Option A**

Move `isTyping(e)` above the `?` handler AND replace `?` with ⌘K trigger (above). The old `?` handler is fully replaced by ⌘K.

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/CommandPalette.tsx src/components/admin/AdminApp.tsx
git commit -m "feat(⌘K): CommandPalette replacing ? modal, ⌘K + / trigger"
```

---

### Task 10: Sheets — AIBuildSheet, IngestSheet, DayPickerSheet

**Files:**
- Create: `src/components/admin/AIBuildSheet.tsx`
- Create: `src/components/admin/IngestSheet.tsx`
- Create: `src/components/admin/DayPickerSheet.tsx`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — replace capture card + inline IngestPanel + aside calendar with sheet invocations

**Interfaces:**
- Consumes: existing capture zone (addDayImages, runStructure, dayImages, dayText), existing IngestPanel logic (move to sheet chrome), existing mini-calendar logic (move to sheet), Sheet recipe from shadcn
- Produces: three Sheet components, each with header/body/footer, 420px wide, right-side, panel-raised, 60ms fade

- [ ] **Step 1: Create `src/components/admin/AIBuildSheet.tsx`**

Wraps the existing capture zone body (dayImages drop zone + dayText textarea + `build this day →` button) in a `Sheet`. The existing `runStructure()` function is called unchanged. On AI result: sheet closes, sonner confirms, structured data lands via `applyStructured` (unchanged flow).

- [ ] **Step 2: Create `src/components/admin/IngestSheet.tsx`**

Wraps the existing `IngestPanel` (approve-every-trade ritual) in a `Sheet`. The proposal table uses **TanStack Table v9** with `tableFeatures({ rowSelectionFeature })` for multi-select. Columns: market · dir · entry→exit · pts · risk pts · R · fills · account (select) · dup badge. Sticky header, tabular-nums. Existing `applyProposal` unchanged. Sheet footer: `apply N approved trades →` + sonner.

- [ ] **Step 3: Create `src/components/admin/DayPickerSheet.tsx`**

Wraps the existing mini-calendar logic (12-week window, M-T-W-T-F-S-S header, cells with hasData/isToday coloring) + recent 14 list + jump date input in a `Sheet`. Opened from ⌘K `open day…` or the rail's overflow `⋯` button.

- [ ] **Step 4: Replace inline surfaces with sheet triggers in `DayWorkspace.tsx`**

- Remove the capture card (lines 807-837). Add a `capture ▸` button in the check-in band header that opens `<AIBuildSheet>`.
- Remove the inline `<IngestPanel>` (line 840). Add an ⌘K command `import trades` that opens `<IngestSheet>`.
- The aside's calendar/recent logic is already gone (Task 4 DayRail). The date picker opens via `<DayPickerSheet>`.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/AIBuildSheet.tsx src/components/admin/IngestSheet.tsx src/components/admin/DayPickerSheet.tsx src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(sheets): AIBuildSheet, IngestSheet (TanStack v9), DayPickerSheet"
```

---

### Task 11: Remove save/save&rebuild buttons, add debounced autosave

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — remove save buttons (lines 740-742, 1234-1237), add autosave
- Modify: `src/pages/api/admin/days.ts` — add `silent` mode (write without pending change)
- Modify: `src/components/admin/api.ts` — add silent-save helper (POSTs without `notifyChanged`)
- Modify: `src/components/admin/AdminApp.tsx` — remove zenLine banner (line 173-181), folded into StatusLine + RebuildBar

**Interfaces:**
- Produces: autosave on 2s idle debounce + blur, no save buttons on the day page, ⌘S flushes immediately
- Rebuild still works via RebuildBar + sonner flash

- [ ] **Step 1: Add debounced autosave to `DayWorkspace.tsx`**

```ts
useEffect(() => {
  if (!dirty) return
  const id = setTimeout(() => saveSilent(), 2000)
  return () => clearTimeout(id)
}, [dirty, date, mood, sleepHours, sleepQuality, habits, reflection, trades, draftMoments, stream])

// Also save on blur of any editable field
const handleBlur = () => { if (dirty) saveSilent() }
```

The `saveSilent` function POSTs to `/api/admin/days` with `{ silent: true }` and does NOT call `notifyChanged()`. On success, sets `savedAt` to current HH:MM.

- [ ] **Step 2: Handle `silent` flag in `src/pages/api/admin/days.ts` POST**

In the save handler, check `body.silent` — if true, skip `addChange()` (the pending-change append that triggers the RebuildBar). Still write the file. The change is saved but not queued for rebuild.

- [ ] **Step 3: Remove save buttons from `DayWorkspace.tsx`**

Remove lines 740-742 (header save + save & rebuild) and lines 1234-1237 (footer save). Add ⌘S handler in AdminApp that calls `saveSilent()` now (force flush the 2s debounce).

- [ ] **Step 4: Remove `zenLine` banner in `AdminApp.tsx`**

Remove lines 173-181 (the warn strip showing pending reflections). The obligation is now on Z5's frame (Task 7 ObligationChip).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/tabs/DayWorkspace.tsx src/pages/api/admin/days.ts src/components/admin/api.ts src/components/admin/AdminApp.tsx
git commit -m "feat(autosave): debounced autosave, silent mode, remove save buttons & zenLine"
```

---

### Task 12: Ghost-text writing assist

**Files:**
- Create: `src/lib/ai.ts` — add `orChatStream()` (adjacent to existing `orChat`)
- Create: `src/pages/api/admin/complete.ts` — Astro SSR route
- Create: `src/components/admin/useGhostText.ts` — hook
- Create: `src/components/admin/GhostText.tsx` — overlay
- Modify: `src/components/admin/MarkdownEditor.tsx` — integrate overlay into the textarea container
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — gate ghost-text to thoughts + reflection surfaces

**Interfaces:**
- Consumes: DeepSeek V3 via OpenRouter, existing `env` helper, `eventsource-parser`, `textarea-caret-position`
- Produces: ghost-text suggestion overlay on both writing surfaces, Tab-accept/Esc-dismiss, prose-line gate, streaming, ~$0.01/day cost

- [ ] **Step 1: Add `orChatStream()` to `src/lib/ai.ts`**

~30-line function adjacent to `orChat`:

```ts
export async function* orChatStream(messages: OpenRouterMessage[]): AsyncGenerator<string> {
  const res = await fetch(`${env.openrouterBase()}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.openrouterKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.modelAssist(), messages, stream: true, temperature: 0.2 }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch { /* skip unparseable lines */ }
    }
  }
}
```

Reuse `env.openrouterBase()` + `env.openrouterKey()` + `env.modelAssist()` from the existing `orChat`.

- [ ] **Step 2: Create `src/pages/api/admin/complete.ts`**

Astro SSR route:

```ts
import type { APIRoute } from 'astro'
import { requireSession, error } from '../../../lib/auth'
import { orChatStream } from '../../../lib/ai'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const text = String(body.text ?? '').slice(-500)  // last 500 chars
  if (!text.trim()) return error('empty prompt')

  const stream = orChatStream([{
    role: 'system',
    content: 'Continue the following journal entry in the same voice. Output ONLY the continuation text — no preamble, no commentary. Keep it short (20-40 words).',
  }, { role: 'user', content: text }])

  return new Response(
    new ReadableStream({
      async start(ctrl) {
        try {
          for await (const chunk of stream) ctrl.enqueue(new TextEncoder().encode(chunk))
          ctrl.close()
        } catch { ctrl.close() }
      }
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } }
  )
}
```

- [ ] **Step 3: Create `src/components/admin/useGhostText.ts`**

React hook:

```ts
export function useGhostText(textareaRef: RefObject<HTMLTextAreaElement>, enabled: boolean) {
  const [suggestion, setSuggestion] = useState('')
  const [caretPos, setCaretPos] = useState<{ left: number; top: number; height: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !textareaRef.current) return
    const el = textareaRef.current
    let debounce: ReturnType<typeof setTimeout>

    const onInput = () => {
      clearTimeout(debounce)
      abortRef.current?.abort()
      setSuggestion('')
      const { value, selectionEnd } = el
      const line = value.slice(value.lastIndexOf('\n', selectionEnd - 1) + 1, selectionEnd)
      if (line.length < 10 || !shouldComplete(line)) return

      debounce = setTimeout(async () => {
        const pos = getCaretCoordinates(el, selectionEnd)
        setCaretPos(pos)
        const ctrl = new AbortController()
        abortRef.current = ctrl
        try {
          const res = await fetch('/api/admin/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: value.slice(0, selectionEnd) }),
            signal: ctrl.signal,
          })
          if (!res.ok || !res.body) return
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let result = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            result += decoder.decode(value, { stream: true })
            setSuggestion(result)
          }
        } catch { /* aborted */ }
      }, 600)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && suggestion) {
        e.preventDefault()
        el.value = el.value.slice(0, el.selectionEnd) + suggestion + el.value.slice(el.selectionEnd)
        el.selectionEnd = el.selectionStart = el.selectionEnd + suggestion.length
        setSuggestion('')
      } else if (e.key === 'Escape' || (e.key !== 'Tab' && suggestion)) {
        setSuggestion('')
        abortRef.current?.abort()
      }
    }

    el.addEventListener('input', onInput)
    el.addEventListener('keydown', onKeyDown)
    return () => { el.removeEventListener('input', onInput); el.removeEventListener('keydown', onKeyDown) }
  }, [enabled, suggestion])

  return { suggestion, caretPos }
}

function shouldComplete(line: string): boolean {
  return !/```|:\/\/|\d+\.\d+|\b\d{3,}\b/.test(line)  // no code, URLs, prices, big numbers
}
```

- [ ] **Step 4: Create `src/components/admin/GhostText.tsx`**

Renders an absolutely-positioned `pointer-events-none` overlay `div` at the caret coordinates, displaying the current `suggestion` in `faint` with a `[tab]` Kbd affordance at the end. `aria-hidden="true"`.

- [ ] **Step 5: Integrate into `MarkdownEditor.tsx`**

In the textarea container (the `relative` wrapper), add `<GhostText>` after the `<textarea>`. Pass `textareaRef` + `suggestion` + `caretPos` from the hook. Conditional on `ghostTextEnabled` state (reads `localStorage` `1edge.ghostText` on mount).

- [ ] **Step 6: Gate to DayWorkspace writing surfaces**

In DayWorkspace, the thoughts composer and reflection zone both use `MarkdownEditor` (or wrapper textareas). The hook `useGhostText` is gated to these surfaces only. The ⌘K `view → ghost-text: on/off` toggle flips the `localStorage` key and re-renders.

- [ ] **Step 7: Verify streaming works**

```bash
npm run dev  # start dev server on :4321
# (manual: open zen, type ~15 chars of prose, wait 600ms, verify ghost text appears, Tab accepts)
```

- [ ] **Step 8: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/ai.ts src/pages/api/admin/complete.ts src/components/admin/useGhostText.ts src/components/admin/GhostText.tsx src/components/admin/MarkdownEditor.tsx src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(ghost-text): streaming AI ghost-text overlay on thoughts & reflection surfaces"
```

---

### Task 13: SSR + direct disk reads for instant public updates

**Files:**
- Modify: `src/pages/day/[date].astro` — switch from `getStaticPaths`/`getCollection` to SSR + `listMds`/`readEntry`
- Modify: `src/pages/stream/index.astro` (check path — may be `/stream/index.astro` or `/stream.astro`) — same treatment
- Modify: `src/pages/index.astro` — homepage "today" panel: switch to direct disk reads
- Verify: `src/components/archive/DayArchive.astro` — works with direct entry instead of collection entry

**Interfaces:**
- Produces: `/day/[date]` and `/stream` pages read fresh from disk on every request — published thoughts/trades appear in ~100ms
- Build stays `output: 'static'` overall; these specific pages opt into `prerender = false`
- `getCollection()` calls replaced with `listMds('days')` + `readEntry('days', file).data`

- [ ] **Step 1: Switch `src/pages/day/[date].astro` to SSR**

```astro
---
export const prerender = false
import DayArchive from '../../components/archive/DayArchive.astro'
import { listMds, readEntry } from '../../lib/content'
import { fmtDay, parseDay } from '../../lib/dates'

const slug = Astro.params.date!
const iso = parseDay(slug)
if (!iso) return Astro.redirect('/404')

const [dayFiles, journalFiles, coachFiles] = [
  listMds('days'), listMds('journal'), listMds('coach')
]
const dates = new Set<string>()
for (const f of dayFiles) dates.add(parseDay(f.replace('.md','')) ?? '')
for (const f of journalFiles) dates.add(parseDay(f.replace('.mdx','')) ?? '')
for (const f of coachFiles) dates.add(parseDay(f.replace('.md','')) ?? '')
const allDates = [...dates].sort()
const isoDate = iso
---
<DayArchive iso={isoDate} allDates={allDates} />
```

- [ ] **Step 2: Switch `src/pages/stream.astro` to SSR** (if applicable — check current SSR status)

The stream is already SSR. Replace `getCollection('days')` calls with `listMds('days').map(f => readEntry('days', f).data)`. Same for journal/coach collections.

- [ ] **Step 3: Switch `src/pages/index.astro` "today" panel to direct disk reads**

Replace the `getCollection('days')` call that populates today's stream/panel with direct `listMds` + `readEntry`.

- [ ] **Step 4: Verify `DayArchive.astro` works with the new SSR props**

The component already receives `{ iso, allDates }` as Astro.props. Ensure all internal `getCollection()` calls (lines 19-22) are replaced with `listMds` + `readEntry` patterns.

- [ ] **Step 5: Test live — publish a thought, curl the public page**

```bash
npm run build && bash scripts/deploy-test.sh
# Then POST a test thought, curl /day/<today> — it should show the new thought within 100ms
```

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/pages/day/[date].astro src/pages/stream.astro src/pages/index.astro src/components/archive/DayArchive.astro
git commit -m "feat(ssr): SSR + direct disk reads for /day, /stream, homepage — instant public updates"
```

---

### Task 14: Sonner integration + publish button wiring

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — replace `notify()` calls with sonner
- Modify: `src/components/admin/AdminApp.tsx` — add `<Toaster>` from sonner, remove custom toast (lines 195-202)

**Interfaces:**
- Consumes: `sonner` Toaster + `toast()` function
- Produces: consistent publish confirmations, errors, AI results as terminal-styled toasts

- [ ] **Step 1: Add `<Toaster>` to `AdminApp.tsx`**

```tsx
import { Toaster, toast } from 'sonner'

// In the return:
<Toaster
  position="top-right"
  theme="dark"
  toastOptions={{
    className: '!bg-bg !border !border-line2 !rounded-[2px] !text-[13px] !font-mono',
  }}
/>
```

- [ ] **Step 2: Replace all `notify()` calls in DayWorkspace with `toast()`**

Map the existing notify patterns:
- Save: silent (no toast) — autosave is `· saved HH:MM` in StatusLine
- Publish thought: `toast.success('thought published')`
- Publish reflection: `toast.success('reflection published — queued for rebuild')`
- Publish error: `toast.error('publish failed — the draft is safe, retry')`
- AI result: `toast('day built from your evidence — review, override if needed')`
- AI polish: `toast('polished — review it, then publish')`
- Delete: `toast('day deleted')`

- [ ] **Step 3: Remove custom toast from `AdminApp.tsx`**

Remove lines 195-202 (the `{toast && …}` block). Delete the `toast` state variable and setter.

- [ ] **Step 4: Remove `notify` prop from DayWorkspace**

Replace `notify(m, ok)` with sonner's `toast[ok === false ? 'error' : 'success'](m)`. Remove the `notify` prop from the component signature.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/admin/tabs/DayWorkspace.tsx src/components/admin/AdminApp.tsx
git commit -m "feat(sonner): sonner toasts replacing notify() + custom toast, terminal-styled"
```

---

### Task 15: Polish pass — dnd, empty states, ARIA, cleanup, full-suite verification

**Files:**
- Modify: `src/components/admin/TradeCard.tsx` — dnd-kit wiring for reorder
- Modify: `src/components/admin/ThoughtsSurface.tsx` — dnd-kit wiring for moment reorder
- Modify: `src/components/admin/*.tsx` — aria-labels, empty states per m3 §4.5
- Modify: `src/styles/app.css` — `purp` token + ghost-text styles
- Delete: `src/components/cockpit/` (if still present — Phase 4 remediation remnant)

**Interfaces:**
- Produces: the full integrated surface, all states, all a11y, verified

- [ ] **Step 1: Add `purp` token to `src/styles/app.css`**

```css
@theme {
  --color-purp: #c084fc;  /* reserved: AI-generated content markers — 3s tint */
}
```

- [ ] **Step 2: Wire dnd-kit in `TradeCard.tsx`**

`DndContext` + `SortableContext` + `useSortable` on each TradeCard row. Drag handle is the ⠿ hover/focus button. Drag preview at 60% opacity. Drop = 60ms fade.

- [ ] **Step 3: Wire dnd-kit in `ThoughtsSurface.tsx`**

Same pattern for draft and published moment rows.

- [ ] **Step 4: Add crafted empty states**

Add the 5 empty-state lines from m3 §4.5 to each zone component:

```
CheckInBand:  the day starts here — paste evidence or just write a thought.
ThoughtsSurface: nothing on the stream yet — the day starts with one line.
TradeCard:    no trades — paste charts or ⌘K "new trade".
ReflectionZone: no reflection yet — due tonight.
HabitRow:     habits are defined in zen · library.
```

- [ ] **Step 5: Add aria-labels**

- DayRail cells: `aria-label="08-aug · +1.42R · 4 trades"`
- ObligationChip: `aria-label="reflection due in 4 hours 22 minutes"`
- GhostText overlay: `aria-hidden="true"` (already done)
- Sheet dialogs: `role="dialog"` + `aria-modal="true"`
- ⌘K palette: `role="dialog"` + `aria-label="command palette"` + `cmdk-input` with `aria-label` from cmdk defaults

- [ ] **Step 6: Kill dead code**

- Delete `src/components/cockpit/` directory if it still exists (Phase 4 remediation)
- Ensure no orphaned imports from the retired components (section-jump bar, 210px aside, capture card, IngestPanel inline, old save buttons, zenLine banner, `?` modal)

- [ ] **Step 7: Full suite verification**

```bash
npm run typecheck
node --import tsx --test "tests/**/*.test.ts"
npm run build
bash scripts/deploy-test.sh
bash scripts/verify-env.sh test
```

All 189+ tests must pass. Build must succeed. Preprod must return HTTP 200 with noindex.

- [ ] **Step 8: Commit + ship to prod**

```bash
git add -A
git commit -m "feat(zen): complete day-surface rebuild — final polish, dnd, empty states, ARIA, cleanup"
bash scripts/sync-to-prod.sh -y  # from prod worktree
bash scripts/deploy-prod.sh      # from prod worktree
bash scripts/verify-env.sh prod
```

---

## Task Dependency Graph

```
Task 0 (deps) ──→ all tasks

Task 1 (schema migration) ──→ 2, 5, 8
Task 2 (public renderers) ──→ 13 (SSR uses DayArchive, MomentCard)
Task 3 (useHktNow) ──→ 4, 7
Task 4 (DayRail) —— (independent once schema + clock exist)
Task 5 (TradeCard+ModelChipRow) —— (independent once schema exists)
Task 6 (StatusLine) —— (independent, pure UI on existing state)
Task 7 (ReflectionZone+ObligationChip+CeremonyMode) —— (independent with clock + schema)
Task 8 (ThoughtsSurface+CheckInBand+HabitRow) —— (independent with schema + state)
Task 9 (CommandPalette) —— (independent, pure UI)
Task 10 (Sheets) —— (independent, wraps existing rituals)
Task 11 (autosave) ── → 13, 15 (autosave must work before SSR+polish)
Task 12 (ghost-text) —— (independent after deps install + ai.ts modification)
Task 13 (SSR+disk reads) —— (depends on 11 autosave, 2 public renderers)
Task 14 (sonner) —— (independent, replaces notify)
Task 15 (polish) —— (depends on ALL — the integration gate)

Tasks 3-10 and 12 can run in PARALLEL after Tasks 0-2 complete.
Tasks 11 and 13-14 are sequential (autosave → SSR → sonner → polish).
Task 15 is the final integration gate — it gates all changes at once.
```

---

## Verification checklist (final gate, Task 15 step 7)

- [ ] `npm run typecheck` — 0 errors, 0 warnings
- [ ] `node --import tsx --test "tests/**/*.test.ts"` — all passing (≥189)
- [ ] `npm run build` — succeeds, no errors
- [ ] `bash scripts/deploy-test.sh` — preprod deploys, HTTP 200
- [ ] `bash scripts/verify-env.sh test` — 4/4 checks pass
- [ ] Manual: zen loads, ⌘K opens, thoughts composer types and ⌘⏎ publishes, trades show multi-model chips, habits tick, reflection zone shows obligation chip, ghost-text appears after ~600ms pause, statusline shows day readout
- [ ] Manual: curl /day/<fmtDay(today)> returns 200 with the published thought visible
- [ ] Manual: curl /stream returns 200 with the published thought in the feed
- [ ] Manual: ⌘K `view → ghost-text: on/off` toggles ghost-text, persists across reload
- [ ] **Mobile (iPhone/iPad Safari):** thoughts composer shows the publish button with ≥44px tap target; reflection zone shows publish button; dnd drag works with touch sensor; ghost-text caret coordinates are correct; ceremony mode opacity transitions work; safe-area insets don't clip the statusline or the header; ⌘K opens via the header button (not keyboard shortcut)
