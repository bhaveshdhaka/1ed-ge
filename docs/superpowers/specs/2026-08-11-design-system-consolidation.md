# Design System Consolidation — v0.2

**Status:** approved  
**Date:** 2026-08-11  
**Scope:** public pages only (admin consolidation is a separate phase)

## Goal

Establish a strict, uniformly applied design system where every surface uses primitives. No hand-built `.panel` + `.card-hd`, no raw `.kv`/`.seg`/`.capsule`/`.well`/`.btn` markup. The `/design` page shows every primitive rendered live, not described in text or ASCII art.

**Non-goal:** No visual changes. The site looks identical after this phase. This is infrastructure — the same look, a strict system underneath.

## New Primitives (6)

### Tag.astro (extend existing)
Add optional `href` prop so Tag can render as `<a>` for navigation links (e.g., journal month-strip chips). When `href` is present, renders `<a class="tag">` instead of `<span class="tag">`.

```astro
---
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

### KvRow.astro
Key-value row component. Replaces ~17 hand-built `<div class="kv">` instances.

```astro
---
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

### SegControl.astro
Segmented filter/toggle bar. Replaces 4 identical hand-rolled `.seg` copies.

```astro
---
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

### Capsule.astro
Accent-tinted pill chip. Replaces 2 hand-built `<span class="capsule">` instances.

```astro
---
interface Props {
  class?: string
}
const { class: cls = '' } = Astro.props
---
<span class={`capsule ${cls}`}><slot /></span>
```

### Well.astro
Inset recessed surface. Replaces ~12 hand-built `<div class="well">` instances.

```astro
---
interface Props {
  class?: string
}
const { class: cls = '' } = Astro.props
---
<div class={`well ${cls}`}><slot /></div>
```

### Button.astro
Public button component. Replaces 1 raw `<button class="btn">` and all future buttons.

```astro
---
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

### Rail Tokens (CSS only)
Left-rail identity bars. Replaces 3 arbitrary `[border-left:2px_solid_var(--color-*)]` classes in ThoughtCard.

Added to `app.css`:
```css
.rail-up     { border-left: 2px solid var(--color-up); }
.rail-down   { border-left: 2px solid var(--color-down); }
.rail-accent { border-left: 2px solid var(--color-accent); }
.rail-quiet  { border-left: 2px solid var(--color-line); }
```

## Violation Fixes (7 files)

Every fix is mechanical — swap hand-built markup for the equivalent primitive. Zero visual change.

### index.astro (homepage)
- Line 113: `.panel panel-hero` + `.card-hd` → `<Card icon="📅" label="today" variant="hero">`
- Line 141: `.panel` + `.card-hd` → `<Card icon="📡" label="stream">`
- Move actions (market marker, moniker, links) into `<Fragment slot="actions">`
- Add `import Card from '../components/ui/Card.astro'`

### MarketDay.astro
- Line 16: `.panel` + `.card-hd` → `<Card icon="📅" label="today">`
- Add `import Card from '../components/ui/Card.astro'`

### DayFacts.astro
- Line 26: `.panel` + `.card-hd` → `<Card icon="📊" label="day facts">`
- Add `import Card from '../components/ui/Card.astro'`

### journal/index.astro
- Line 94: `.panel` + `.card-hd` → `<Card icon="📝" label="journal">`
- Line 87: raw `<a class="tag">` → `<Tag>` (Tag is already imported)
- Card is already imported — just use it

### DayArchive.astro
- Line 189: `<details class="panel">` + `<summary class="card-hd">` → wrap in `<Card>` with the `<details>` inside the slot
- Line 240: raw `<span class="capsule">` → `<Capsule>`
- Card is already imported — just use it

### ThoughtCard.astro
- Lines 32-35: arbitrary `[border-left:2px_solid_var(--color-*)]` → `.rail-up` / `.rail-down` / `.rail-accent`

### zen/preview/[date].astro
- Line 124: `.panel` → `<Card pad="sm">`
- Line 165: raw `<span class="tag">` → `<Tag>`
- Add imports for Card and Tag

### performance.astro (quick win)
- Line 73: `<div class="well p-4">` stat cell → `<StatCard>` (already exists)

## SKILL.md Update

### Remove (7 ghost components)
Button, Dot, Quote, Field, Input, Textarea, Flag — these are referenced in the skill doc but never existed as components.

### Add (6 new primitives)
KvRow, SegControl, Capsule, Well, Button, Rail tokens — with their props, usage patterns, and when to use each.

### Update enforcement rules
- "Every surface uses Card" → already stated, now actually enforced
- "No hand-built .kv / .seg / .capsule / .well / .btn" → new rule
- "Rail tokens for left-rail identity, never arbitrary border-left" → new rule
- "New features must have design rules before implementation" → new gate rule

## /design Page Update

### Sections that stay (unchanged)
1. Hero (heading + version)
2. Token Architecture (3-layer cards)
3. Palette table
4. Type Scale table
5. Material Tokens table
6. Typography Rules table
7. Composite Components
8. Design Rules
9. Design Skill
10. Changelog (add v0.2 entry)

### Sections that change

**Card System** — replace ASCII art with 4 rendered `<Card>` examples side by side (default, hero, static, flat) plus a stat-mode example. Each shows real content. Props table stays below as reference.

**UI Primitives** — replace text descriptions with rendered examples. Each primitive gets its own card showing it live:
- StatCard: rendered with sample data
- Badge: row of all 7 variants rendered
- Tag: row of sample tags rendered
- Table: small 3-row sample table
- EmptyState: rendered
- Icon: row of 6 common icons at actual size
- Separator: rendered
- KvRow (new): 3 stacked rows with sample data
- SegControl (new): rendered bar with 4 segments, one active
- Capsule (new): row of sample capsules
- Well (new): well with sample content
- Button (new): row of all variants + sizes + disabled
- Rail tokens (new): 4 small cards each with a left rail

**CSS Classes Reference** — add `.rail-*` classes. Verify no stale entries.

**Backlog** — remove items fixed by this phase. Add remaining items.

## Implementation Order

1. **Create primitives** (6 new components + rail CSS) — no dependencies, can run in parallel
2. **Fix violations** (7 files) — depends on primitives existing
3. **Update SKILL.md** — depends on primitives + fixes being done
4. **Update /design page** — depends on everything above
5. **Typecheck + build + deploy + verify**

## Verification

- `npm run typecheck` — zero errors
- `npm run build` — clean build
- Visual: every page renders identically to before (no visual changes)
- `/design` page: all 14 primitives render live, no ASCII art
- Grep audit: zero hand-built `.panel` + `.card-hd` outside of `Card.astro` and `design.astro`
- Grep audit: zero raw `class="kv"` / `class="seg"` / `class="capsule"` / `class="well"` / `class="btn"` / `class="tag"` in public `.astro` files (outside of `design.astro` and the primitives themselves)
