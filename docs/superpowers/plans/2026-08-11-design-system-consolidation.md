# Design System Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a strict, uniformly applied design system where every public surface uses primitives. No hand-built `.panel` + `.card-hd`, no raw `.kv`/`.seg`/`.capsule`/`.well`/`.btn`/`.tag` markup. The `/design` page shows every primitive rendered live.

**Architecture:** Create 5 new Astro components + 1 CSS addition + extend 1 existing component. Then mechanically swap hand-built markup for primitives across 8 public files. Update SKILL.md and /design page. Zero visual changes.

**Tech Stack:** Astro 5, Tailwind CSS v4, TypeScript

## Global Constraints

- Zero visual changes — the site looks identical after this phase
- Public pages only (admin consolidation is separate)
- Every surface uses primitives — no hand-built `.panel` + `.card-hd` anywhere
- No raw `class="kv"` / `class="seg"` / `class="capsule"` / `class="well"` / `class="btn"` / `class="tag"` in public `.astro` files (outside of `design.astro` and the primitives themselves)
- `npm run typecheck` must pass with zero errors after every task
- Commit after each task with conventional prefix (`feat:` for new primitives, `fix:` for violation fixes)

---

### Task 1: Extend Tag.astro with href support

**Files:**
- Modify: `src/components/ui/Tag.astro`

**Interfaces:**
- Produces: `<Tag href="...">` renders as `<a class="tag">`; `<Tag>` without href renders as `<span class="tag">` (backward compatible)

- [ ] **Step 1: Read current Tag.astro**

Read `src/components/ui/Tag.astro` — currently a simple `<span class="tag"><slot /></span>`.

- [ ] **Step 2: Add href prop and conditional rendering**

Replace the component with:

```astro
---
/** Tag.astro — small inline label (a lighter sibling of Badge, no color states). */
interface Props {
  href?: string
  class?: string
}
const { href, class: cls = '' } = Astro.props
---
{href ? (
  <a href={href} class={`tag ${cls}`}><slot /></a>
) : (
  <span class={`tag ${cls}`}><slot /></span>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Tag.astro
git commit -m "feat: add href prop to Tag for navigation links"
```

---

### Task 2: Create KvRow.astro

**Files:**
- Create: `src/components/ui/KvRow.astro`

**Interfaces:**
- Produces: `<KvRow label="win rate" value="55%" />` renders a `.kv` row; `<KvRow label="notes"><span>rich content</span></KvRow>` uses the slot

- [ ] **Step 1: Create the component**

```astro
---
/** KvRow.astro — key-value row. label on left, value (or slot) on right. */
interface Props {
  label: string
  value?: string
  class?: string
}
const { label, value, class: cls = '' } = Astro.props
---
<div class={`kv ${cls}`}>
  <span class="text-sm text-ink">{label}</span>
  {value !== undefined ? (
    <span class="text-xs text-dim">{value}</span>
  ) : (
    <span class="text-xs text-dim"><slot /></span>
  )}
</div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/KvRow.astro
git commit -m "feat: add KvRow primitive for key-value rows"
```

---

### Task 3: Create SegControl.astro

**Files:**
- Create: `src/components/ui/SegControl.astro`

**Interfaces:**
- Produces: `<SegControl segments={[{label:'ALL',href:'/stream',count:42,active:true},...]} />` renders a `.seg` nav bar

- [ ] **Step 1: Create the component**

```astro
---
/** SegControl.astro — segmented filter/toggle bar. */
interface Segment {
  label: string
  href: string
  count?: number
  active: boolean
}
interface Props {
  segments: Segment[]
  class?: string
}
const { segments, class: cls = '' } = Astro.props
---
<nav class={`seg flex-wrap ${cls}`}>
  {segments.map((s) => (
    <a
      href={s.href}
      aria-current={s.active ? 'page' : undefined}
      class:list={[
        'rounded-lg px-2.5 py-1 text-2xs transition-colors',
        s.active ? 'seg-on' : 'text-dim hover:text-accent',
      ]}
    >
      {s.label}{s.count !== undefined && <span class="text-faint"> {s.count}</span>}
    </a>
  ))}
</nav>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SegControl.astro
git commit -m "feat: add SegControl primitive for segmented filter bars"
```

---

### Task 4: Create Capsule.astro

**Files:**
- Create: `src/components/ui/Capsule.astro`

**Interfaces:**
- Produces: `<Capsule>● live</Capsule>` renders a `.capsule` pill

- [ ] **Step 1: Create the component**

```astro
---
/** Capsule.astro — accent-tinted pill chip. */
interface Props {
  class?: string
}
const { class: cls = '' } = Astro.props
---
<span class={`capsule ${cls}`}><slot /></span>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Capsule.astro
git commit -m "feat: add Capsule primitive for accent pill chips"
```

---

### Task 5: Create Well.astro

**Files:**
- Create: `src/components/ui/Well.astro`

**Interfaces:**
- Produces: `<Well class="p-3">content</Well>` renders a `.well` inset surface

- [ ] **Step 1: Create the component**

```astro
---
/** Well.astro — inset recessed surface. */
interface Props {
  class?: string
}
const { class: cls = '' } = Astro.props
---
<div class={`well ${cls}`}><slot /></div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Well.astro
git commit -m "feat: add Well primitive for inset surfaces"
```

---

### Task 6: Create Button.astro

**Files:**
- Create: `src/components/ui/Button.astro`

**Interfaces:**
- Produces: `<Button>click</Button>` renders `<button class="btn">`; `<Button variant="primary">` renders `.btn-primary`; `<Button size="sm">` renders `.btn-sm`; `<Button href="/">` renders `<a class="btn">`; `<Button disabled>` renders disabled

- [ ] **Step 1: Create the component**

```astro
---
/** Button.astro — public button/link component. */
interface Props {
  variant?: 'default' | 'primary' | 'danger'
  size?: 'default' | 'sm'
  type?: 'button' | 'submit'
  disabled?: boolean
  class?: string
  href?: string
}
const {
  variant = 'default',
  size = 'default',
  type = 'button',
  disabled = false,
  class: cls = '',
  href,
} = Astro.props

const variantCls = { default: 'btn', primary: 'btn btn-primary', danger: 'btn btn-danger' }[variant]
const sizeCls = size === 'sm' ? 'btn-sm' : ''
const tagCls = `${variantCls} ${sizeCls} ${cls}`.trim()
---
{href ? (
  <a href={href} class={tagCls}><slot /></a>
) : (
  <button type={type} disabled={disabled} class={tagCls}><slot /></button>
)}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.astro
git commit -m "feat: add Button primitive for public buttons/links"
```

---

### Task 7: Add rail CSS tokens to app.css

**Files:**
- Modify: `src/styles/app.css`

**Interfaces:**
- Produces: `.rail-up`, `.rail-down`, `.rail-accent`, `.rail-quiet` CSS utility classes

- [ ] **Step 1: Read app.css to find insertion point**

Read `src/styles/app.css` around line 300-320 (the `.tag` / `.capsule` / `.well` / `.seg` section in `@layer components`).

- [ ] **Step 2: Add rail classes after the `.seg-on` definition**

Insert after the `.seg-on` block (around line 347):

```css
  /* Rail tokens — left-rail identity bars for cards (ThoughtCard, etc.) */
  .rail-up     { border-left: 2px solid var(--color-up); }
  .rail-down   { border-left: 2px solid var(--color-down); }
  .rail-accent { border-left: 2px solid var(--color-accent); }
  .rail-quiet  { border-left: 2px solid var(--color-line); }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/styles/app.css
git commit -m "feat: add rail CSS tokens for left-rail identity bars"
```

---

### Task 8: Fix DayFacts.astro — use Card

**Files:**
- Modify: `src/components/stream/DayFacts.astro`

**Interfaces:**
- Consumes: `Card` from `../ui/Card.astro`
- Produces: Same visual output, now using `<Card>` instead of hand-built `.panel` + `.card-hd`

- [ ] **Step 1: Read current DayFacts.astro**

Read the file to confirm current state.

- [ ] **Step 2: Replace hand-built panel with Card**

Replace lines 26-30 (the `<div class="panel">` + `<div class="card-hd">` wrapper) with `<Card icon="📊" label="day facts" class={cls}>`. Close with `</Card>` instead of `</div>`.

Add import: `import Card from '../ui/Card.astro'`

The inner content (`.well` fact cells) stays unchanged inside the Card slot.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/components/stream/DayFacts.astro
git commit -m "fix: DayFacts uses Card primitive instead of hand-built panel"
```

---

### Task 9: Fix ThoughtCard.astro — use rail tokens

**Files:**
- Modify: `src/components/stream/ThoughtCard.astro`

**Interfaces:**
- Consumes: `.rail-up`, `.rail-down`, `.rail-accent` CSS classes from app.css
- Produces: Same visual output, no arbitrary Tailwind border-left classes

- [ ] **Step 1: Read current ThoughtCard.astro**

Read the file to confirm current state (lines 30-36 for the frameCls logic).

- [ ] **Step 2: Replace arbitrary border-left with rail tokens**

Replace lines 30-36:
```astro
const frameCls = isTrade
  ? thought.trade?.direction === 'long'
    ? '[border-left:2px_solid_var(--color-up)]'
    : '[border-left:2px_solid_var(--color-down)]'
  : isQuote
    ? '[border-left:2px_solid_var(--color-accent)]'
    : ''
```

With:
```astro
const frameCls = isTrade
  ? thought.trade?.direction === 'long' ? 'rail-up' : 'rail-down'
  : isQuote ? 'rail-accent' : ''
```

Also update the comment on lines 26-29 to reference rail tokens instead of arbitrary properties.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/components/stream/ThoughtCard.astro
git commit -m "fix: ThoughtCard uses rail tokens instead of arbitrary border-left"
```

---

### Task 10: Fix MarketDay.astro — use Card

**Files:**
- Modify: `src/components/MarketDay.astro`

**Interfaces:**
- Consumes: `Card` from `./ui/Card.astro`
- Produces: Same visual output, now using `<Card>` instead of hand-built `.panel` + `.card-hd`

- [ ] **Step 1: Read current MarketDay.astro**

Read the file to confirm current state (lines 16-17 for the hand-built panel).

- [ ] **Step 2: Replace hand-built panel with Card**

Replace the `<section class="panel">` + `<div class="card-hd">` wrapper with `<Card icon="📅" label="today">`. Close with `</Card>`.

Add import: `import Card from './ui/Card.astro'`

Move any actions (market marker, links) into `<Fragment slot="actions">`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/components/MarketDay.astro
git commit -m "fix: MarketDay uses Card primitive instead of hand-built panel"
```

---

### Task 11: Fix index.astro (homepage) — use Card ×2

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `Card` from `../components/ui/Card.astro`
- Produces: Same visual output, both "today" and "stream" sections use `<Card>`

- [ ] **Step 1: Read current index.astro**

Read the file to confirm current state (lines 113-114 for today panel, 141-142 for stream panel).

- [ ] **Step 2: Replace "today" panel**

Replace `<div class="panel panel-hero">` + `<div class="card-hd">` (lines 113-114) with `<Card icon="📅" label="today" variant="hero">`. Move the market marker (`.tmr`) and "last logged day" link into `<Fragment slot="actions">`. Close with `</Card>`.

- [ ] **Step 3: Replace "stream" panel**

Replace `<div class="panel">` + `<div class="card-hd">` (lines 141-142) with `<Card icon="📡" label="stream">`. Move the moniker line and "all streams →" link into `<Fragment slot="actions">`. Close with `</Card>`.

- [ ] **Step 4: Add Card import**

Add `import Card from '../components/ui/Card.astro'` to the frontmatter imports.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro
git commit -m "fix: homepage uses Card primitive for today and stream sections"
```

---

### Task 12: Fix journal/index.astro — use Card + Tag

**Files:**
- Modify: `src/pages/journal/index.astro`

**Interfaces:**
- Consumes: `Card` (already imported), `Tag` (already imported, now with href support)
- Produces: Same visual output, journal list uses `<Card>`, month-strip uses `<Tag href="...">`

- [ ] **Step 1: Read current journal/index.astro**

Read the file to confirm current state (lines 87 for month-strip tags, 94-95 for journal list panel).

- [ ] **Step 2: Replace journal list panel with Card**

Replace `<div id="journal-list" class="mt-10 max-w-2xl panel">` + `<div class="card-hd">` (lines 94-95) with `<Card icon="📝" label="journal">`. Add `class="mt-10 max-w-2xl"` to the Card. Close with `</Card>`.

- [ ] **Step 3: Replace month-strip raw tags with Tag component**

Replace `<a href={...} class="tag shrink-0 transition-colors hover:border-accent hover:text-accent">` (line 87) with `<Tag href={`#m-${g.month}`} class="shrink-0 transition-colors hover:border-accent hover:text-accent">`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/journal/index.astro
git commit -m "fix: journal uses Card and Tag primitives instead of hand-built markup"
```

---

### Task 13: Fix DayArchive.astro — use Card + Capsule

**Files:**
- Modify: `src/components/archive/DayArchive.astro`

**Interfaces:**
- Consumes: `Card` (already imported), `Capsule` from `../ui/Capsule.astro`
- Produces: Same visual output, news `<details>` uses `<Card>`, habit chips use `<Capsule>`

- [ ] **Step 1: Read current DayArchive.astro**

Read the file to confirm current state (lines 189-190 for news details panel, line 240 for capsule).

- [ ] **Step 2: Replace news details panel with Card**

Replace `<details id="news" class="group mt-10 scroll-mt-28 panel" open>` + `<summary class="card-hd ...">` with a `<Card>` wrapper. The `<details>` element goes inside the Card slot. The `<summary>` content becomes the Card header (use `icon`/`label` props).

- [ ] **Step 3: Replace raw capsule with Capsule component**

Replace `<span class="capsule" style={...}>` (line 240) with `<Capsule style={...}>`. Add import: `import Capsule from '../ui/Capsule.astro'`

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add src/components/archive/DayArchive.astro
git commit -m "fix: DayArchive uses Card and Capsule primitives"
```

---

### Task 14: Fix zen/preview/[date].astro — use Card + Tag

**Files:**
- Modify: `src/pages/zen/preview/[date].astro`

**Interfaces:**
- Consumes: `Card` from `../../components/ui/Card.astro`, `Tag` from `../../components/ui/Tag.astro`
- Produces: Same visual output, trade panel uses `<Card>`, tags use `<Tag>`

- [ ] **Step 1: Read current zen/preview/[date].astro**

Read the file to confirm current state (line 124 for panel, line 165 for raw tags).

- [ ] **Step 2: Replace trade panel with Card**

Replace `<div class="panel p-4">` (line 124) with `<Card pad="sm">`. Close with `</Card>`. Add import.

- [ ] **Step 3: Replace raw tags with Tag component**

Replace `<span class="tag">#{t}</span>` (line 165) with `<Tag>#{t}</Tag>`. Add import.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/zen/preview/[date].astro
git commit -m "fix: zen preview uses Card and Tag primitives"
```

---

### Task 15: Fix performance.astro — use StatCard

**Files:**
- Modify: `src/pages/performance.astro`

**Interfaces:**
- Consumes: `StatCard` from `../components/ui/StatCard.astro`
- Produces: Same visual output, stat cells use `<StatCard>` instead of raw `.well`

- [ ] **Step 1: Read current performance.astro around line 73**

Read the file to confirm the raw `.well` stat cell.

- [ ] **Step 2: Replace raw well with StatCard**

Replace `<div class="well p-4">` stat cell with `<StatCard>` using appropriate label/value/tone props. Add import if not already present.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/performance.astro
git commit -m "fix: performance uses StatCard instead of raw well for stat cells"
```

---

### Task 16: Update SKILL.md

**Files:**
- Modify: `.opencode/skills/design-system/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `.opencode/skills/design-system/SKILL.md` to understand current structure.

- [ ] **Step 2: Remove 7 ghost components**

Remove references to Button, Dot, Quote, Field, Input, Textarea, Flag from the primitive inventory. These never existed as components.

- [ ] **Step 3: Add 6 new primitives**

Add KvRow, SegControl, Capsule, Well, Button, Rail tokens to the primitive inventory with their props, usage patterns, and when to use each. Note that Tag now supports `href`.

- [ ] **Step 4: Update enforcement rules**

Add these rules:
- "No hand-built `.kv` / `.seg` / `.capsule` / `.well` / `.btn` / `.tag` — use the component"
- "Rail tokens (`.rail-up`/`.rail-down`/`.rail-accent`/`.rail-quiet`) for left-rail identity, never arbitrary `border-left`"
- "New features must have design rules before implementation — if a pattern doesn't have a primitive, create the primitive first"

- [ ] **Step 5: Commit**

```bash
git add .opencode/skills/design-system/SKILL.md
git commit -m "docs: update design skill for v0.2 — remove ghosts, add new primitives, gate rule"
```

---

### Task 17: Update /design page with live rendered examples

**Files:**
- Modify: `src/pages/design.astro`

- [ ] **Step 1: Read current design.astro**

Read the full file to understand current structure.

- [ ] **Step 2: Update version to v0.2**

Change `DESIGN_VERSION` to `'v0.2'`.

- [ ] **Step 3: Replace Card System ASCII art with rendered examples**

Replace the ASCII art diagram (lines 282-291) with 4 rendered `<Card>` examples in a 2×2 grid showing default, hero, static, and flat variants with real sample content. Add a stat-mode example below.

- [ ] **Step 4: Replace UI Primitives text descriptions with rendered examples**

For each of the 14 primitives, show it actually rendered in a card:
- StatCard: `<StatCard label="WIN RATE" value="55%" tone="up" />`
- Badge: row of all 7 variants
- Tag: row of `<Tag>MNQ</Tag>` `<Tag>ORB</Tag>` `<Tag>#kaizen</Tag>`
- Table: small 3-row sample
- EmptyState: `<EmptyState text="nothing here." />`
- Icon: row of 6 common icons
- Separator: rendered
- KvRow: 3 stacked rows
- SegControl: rendered bar with 4 segments
- Capsule: row of sample capsules
- Well: well with sample content
- Button: row of all variants + sizes + disabled
- Rail tokens: 4 small cards each with a left rail

- [ ] **Step 5: Update CSS Classes Reference**

Add `.rail-*` classes. Verify no stale entries.

- [ ] **Step 6: Update Backlog**

Remove items fixed by this phase (panel stagger, prose headings, etc.). Add remaining items.

- [ ] **Step 7: Add v0.2 changelog entry**

Add a v0.2 entry documenting: 6 new primitives, Tag href extension, 8 violation fixes, live rendered examples, SKILL.md update.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 9: Commit**

```bash
git add src/pages/design.astro
git commit -m "docs: /design page v0.2 — live rendered primitives, no ASCII art"
```

---

### Task 18: Final verification — typecheck, build, grep audit

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean build, no errors

- [ ] **Step 3: Grep audit — hand-built panels**

Run: `grep -rn 'class="panel' src/pages/ src/components/ --include='*.astro' | grep -v 'Card.astro' | grep -v 'design.astro' | grep -v 'class="panel-'`
Expected: zero results (no hand-built `.panel` outside Card.astro and design.astro)

- [ ] **Step 4: Grep audit — raw pattern classes**

Run: `grep -rn 'class="kv\|class="seg\|class="capsule\|class="well\|class="btn\|class="tag' src/pages/ src/components/ --include='*.astro' | grep -v 'design.astro' | grep -v 'KvRow.astro' | grep -v 'SegControl.astro' | grep -v 'Capsule.astro' | grep -v 'Well.astro' | grep -v 'Button.astro' | grep -v 'Tag.astro' | grep -v 'Card.astro'`
Expected: zero results

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final verification — typecheck, build, grep audit clean"
```
