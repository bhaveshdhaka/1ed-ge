# Design System Audit & Improvement Plan — 1ed.ge

> **Date:** 2026-08-10
> **Scope:** Full frontend + backend design consistency, iOS/Safari/iPad polish, component system cleanup
> **Status:** Audit complete — plan ready for implementation
> **Reference:** `/opt/whatsapp-logger-v2/templates/dashboard.html` (WALogger v2)

---

## Executive Summary

The WhatsApp Logger v2 aesthetic was applied across 8 commits on 2026-08-10. The foundation is solid — 3-layer token architecture, glass cards, structured card headers, body gradients. But the implementation has **20 cross-cutting inconsistencies** across public pages, **15+ in the zen admin**, and **6 critical iOS/Safari gaps** that would break the experience on iPhone/iPad.

The core problem: **two parallel design dialects coexist**. The `.panel` + `.card-hd` + `.card-ico` system (the intended aesthetic) lives alongside older patterns — flat `border border-line bg-panel` cards, hand-rolled stat cells, raw `<table>` markup, `text-[12px]` arbitrary values where tokens exist, and dead component primitives that were never wired up.

This plan is organized into **7 work streams**, ordered by impact. Each item includes the exact file, the exact problem, and the exact fix. A developer who has never seen this codebase should be able to pick up any item and execute it.

---

## Table of Contents

1. [iOS/Safari/iPhone/iPad Critical Fixes](#1-iossafariiphoneipad-critical-fixes)
2. [Card System Unification](#2-card-system-unification)
3. [Date & Typography Token Compliance](#3-date--typography-token-compliance)
4. [Component Primitive Cleanup](#4-component-primitive-cleanup)
5. [Admin/Zen Design Consistency](#5-adminzen-design-consistency)
6. [Dead Code & Documentation Drift](#6-dead-code--documentation-drift)
7. [Polish & Enhancement Opportunities](#7-polish--enhancement-opportunities)

---

## 1. iOS/Safari/iPhone/iPad Critical Fixes

These are **broken experiences** on real devices. Fix first.

### 1.1 — iOS URL-bar bug: `min-h-screen` vs `min-h-svh`

**Problem:** `Base.astro` uses `min-h-screen` (= `100vh`). On iOS Safari, `100vh` includes the URL bar area. When the bar collapses, the footer jumps up. `Bare.astro` correctly uses `min-h-svh`. The two layouts disagree.

**File:** `src/layouts/Base.astro` line 79
**Fix:** Change `min-h-screen` to `min-h-svh`:
```diff
- <body class="crt flex min-h-screen flex-col">
+ <body class="crt flex min-h-svh flex-col">
```

**Why:** `svh` = "small viewport height" — excludes the URL bar on iOS Safari. Every modern browser supports it (Safari 15.4+, Chrome 108+).

---

### 1.2 — Public Nav has no top safe-area padding

**Problem:** The site uses `viewport-fit=cover` + `apple-mobile-web-app-status-bar-style=black-translucent`. In standalone PWA mode (if someone bookmarks it), the nav sits under the notch/Dynamic Island. The footer has `pb-safe` but the header has nothing.

**File:** `src/components/Nav.astro` line 7
**Fix:** Add safe-area top padding:
```diff
- <nav class="shell flex items-center justify-between gap-4 py-4 md:py-5">
+ <nav class="shell flex items-center justify-between gap-4 pt-safe-4 pb-4 md:py-5">
```

**Also:** Add `pt-safe-4` to `app.css` for the public safe-area utility (currently the `pt-safe-*` utilities are commented as "zen pages only"). Move them to a shared section, or duplicate for the public layout.

---

### 1.3 — `overscroll-behavior-y: none` missing on zen app

**Problem:** Documented as shipped but **never actually added**. On the zen PWA, pull-to-refresh reloads the app — destroying unsaved drafts in DayWorkspace.

**File:** `src/styles/app.css` (near the `.zen-app` block, line ~410)
**Fix:** Add:
```css
.zen-app {
  overscroll-behavior-y: none;
  -webkit-touch-callout: none;
}
```

---

### 1.4 — Zen 44px touch targets defeated by explicit `h-*` heights

**Problem:** The coarse-pointer rule sets `min-height: 44px` on `.zen-app button`. But Tailwind's `h-6` (24px), `h-7` (28px), `h-8` (32px) set explicit `height` which **beats** `min-height`. Tiny remove/reorder buttons throughout the admin are effectively 24–32px on touch devices.

**Files affected:**
- `src/components/admin/tabs/DayWorkspace.tsx` — image remove buttons (`min-h-6! h-6 w-6`)
- `src/components/admin/TradeCard.tsx` — drag handle, remove buttons
- `src/components/admin/CheckInBand.tsx` — remove buttons
- `src/components/admin/AIBuildSheet.tsx` — action buttons
- `src/components/admin/CoachTab.tsx` — compact buttons
- `src/components/admin/HabitRow.tsx` — habit chips

**Fix in app.css:** Change the coarse-pointer rule to use `!important` on min-height, or better: change the rule to set `height: auto` and let `min-height` win:
```css
@media (pointer: coarse) {
  .zen-app button,
  .zen-app a,
  .zen-app summary,
  .zen-app label:has(> input[type='checkbox']) {
    min-height: 44px !important;
  }
}
```

**Or better:** Remove explicit `h-*` classes from those buttons and use `min-h-11` (44px) instead.

---

### 1.5 — Lightbox buttons are 36px (below 44px HIG minimum)

**Problem:** `lb-btn` is `2.25rem` (36px). Apple HIG minimum touch target is 44px. Close, prev, next are all too small on iPhone.

**File:** `src/styles/app.css` line ~556
**Fix:**
```diff
  .lb-btn {
    position: absolute;
    top: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
-   width: 2.25rem;
-   height: 2.25rem;
+   width: 2.75rem;
+   height: 2.75rem;
    border: 1px solid var(--color-line2);
    background: var(--color-bg);
    color: var(--color-dim);
    font-size: 1rem;
    cursor: pointer;
  }
```

---

### 1.6 — Lightbox has no swipe gestures on touch

**Problem:** Touch users must tap ‹/› buttons. No swipe-to-dismiss or swipe-between-images. The backdrop-tap close works, but swipe is expected behavior on mobile image viewers.

**File:** `src/components/Lightbox.astro`
**Fix:** Add a minimal touch handler (the lightbox is already the one JS exception on public pages):
```js
// Inside the existing <script> block
let startX = 0;
dlg.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
dlg.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 50) {
    if (dx > 0) prev(); else next();
  }
});
```

---

### 1.7 — Three separate 1-second DOM tickers drain battery

**Problem:** `MarketLive.astro`, `MarketFooter.astro`, and `MarketWidget.astro` each run their own `setInterval(fn, 1000)` that rewrites `textContent`. On iPhone standalone PWA, this is continuous CPU drain.

**Files:**
- `src/components/MarketLive.astro` — 1s ticker
- `src/components/MarketFooter.astro` — 1s ticker
- `src/components/MarketWidget.astro` — 1s ticker

**Fix:** Consolidate into one shared ticker. Create `src/lib/ticker.ts`:
```ts
const listeners: Set<() => void> = new Set();
let running = false;

export function onTick(fn: () => void) {
  listeners.add(fn);
  if (!running) {
    running = true;
    setInterval(() => {
      if (document.hidden) return; // pause when tab hidden
      listeners.forEach(f => f());
    }, 1000);
  }
  return () => listeners.delete(fn); // unsubscribe
}
```

Each component registers its update function via `onTick()` instead of running its own interval.

---

### 1.8 — Hover-only affordances fail on touch (public pages)

**Problem:** `hover:text-accent`, `hover:border-accent` on links and thumbnails have no `:active` or `:focus-visible` feedback on touch devices. Users get no visual response when tapping.

**Files:** All public pages with interactive links/thumbnails.
**Fix:** Add `:active` states alongside `:hover`:
```css
@media (pointer: coarse) {
  a:hover, a:active {
    /* already covered by touch-action: manipulation */
  }
  /* Add active feedback to interactive elements */
  .panel:active {
    transform: scale(0.995);
    transition: transform 0.1s;
  }
}
```

---

### 1.9 — `theme-color` mismatch between layouts

**Problem:** Base uses `#07080c`, Bare uses `#0a0a0c`. Neither matches the other. On iOS, this causes a flash of different chrome color when navigating between public and zen pages.

**Files:**
- `src/layouts/Base.astro` line 14 — `#07080c`
- `src/layouts/Bare.astro` line 5 — `#0a0a0c`

**Fix:** Both should use `#07080c` (matches `--hue-bg`). Bare is wrong.

---

### 1.10 — `interactive-widget=resizes-content` missing from Base

**Problem:** Bare has it (for zen keyboard handling), Base doesn't. On Android Chrome, the virtual keyboard pushes content up unexpectedly on public pages.

**File:** `src/layouts/Base.astro` line 12
**Fix:** Add `interactive-widget=resizes-content` to the viewport meta.

---

## 2. Card System Unification

The biggest design debt. Two parallel "card" dialects coexist.

### 2.1 — Two card dialects: `.panel` vs flat `border border-line bg-panel`

**Problem:** The design system defines `.panel` (translucent glass, blur 18px, radius 14px, shadow, fade-up animation, stagger). But several components use a **flat, opaque, square-cornered** card:

| Component | Pattern | Visual |
|-----------|---------|--------|
| `StatCard.astro` | `border border-line bg-panel p-3` | Square, opaque, no animation |
| `Table.astro` | `border border-line bg-panel` | Square, opaque, no animation |
| `admin/ui.tsx` `Card` | `.panel` | ✅ Correct |
| `admin/ui.tsx` `Stat` | `.well p-4` | ✅ Correct (inset, not card) |
| `ui/react/dialog.tsx` | `border border-line bg-panel` | Square, opaque |
| `ui/react/select.tsx` | `border border-line bg-panel` | Square, opaque |

**Fix:** `StatCard.astro` and `Table.astro` should use `.panel`:
```diff
# StatCard.astro
- <div class={`border border-line bg-panel p-3 ${cls}`}>
+ <div class={`panel p-3 ${cls}`}>

# Table.astro
- <div class={`overflow-x-auto border border-line bg-panel ${cls}`}>
+ <div class={`overflow-x-auto panel ${cls}`}>
```

**Caveat:** If `.panel`'s fade-up animation is too much for stat grids, add a `.panel-static` variant (no animation) or use `animation: none` override on StatCard.

---

### 2.2 — `Card.astro` header bypasses `.card-hd` system

**Problem:** `Card.astro` renders its title as `mb-3 flex items-center justify-between` + `text-2xs uppercase tracking-widest text-soft`. This is **not** the `.card-hd` system (which has `border-bottom`, 48px min-height, `.card-ico`, `.card-lbl`, `.card-sub`, `.tmr`). The "one panel primitive" doesn't use the card-header system that every other card follows.

**File:** `src/components/ui/Card.astro`
**Fix:** Refactor `Card.astro` to accept `icon`, `label`, `subtitle` props and render `.card-hd`:
```astro
---
interface Props {
  icon?: string        // emoji for card-ico
  label?: string       // text for card-lbl
  subtitle?: string    // text for card-sub
  title?: string       // legacy — renders old-style header
  pad?: 'none' | 'sm' | 'md'
  hero?: boolean
  class?: string
}
---
<section class={`panel ${hero ? 'panel-hero' : ''} ${pads[pad]} ${cls}`}>
  {(icon || label || title) && (
    <div class="card-hd">
      {icon && <span class="card-ico">{icon}</span>}
      {label && <span class="card-lbl">{label}</span>}
      {subtitle && <span class="card-sub">{subtitle}</span>}
      {title && !label && <h2 class="text-2xs uppercase tracking-widest text-soft">{title}</h2>}
      {Astro.slots.has('actions') && (
        <div class="ml-auto flex items-center gap-2"><slot name="actions" /></div>
      )}
    </div>
  )}
  <slot />
</section>
```

**Impact:** Every `Card` consumer can now opt into the card-hd system. Existing `title` usage still works (backward compatible).

---

### 2.3 — MarketWidget / MarketDay bypass card-hd system

**Problem:** These two components render `.panel` with custom flex headers instead of `.card-hd`/`.card-ico`/`.card-lbl`. They're the only panel surfaces that don't follow the pattern.

**Files:**
- `src/components/MarketWidget.astro` — custom header with `text-faint` date + live status
- `src/components/MarketDay.astro` — custom header with `fmtDayWUpper` + market glyph

**Fix for MarketWidget:** Add a card-hd row. The widget is complex (chronograph rail + sessions + news), so the header should be:
```html
<div class="card-hd">
  <span class="card-ico">📊</span>
  <span class="card-lbl">market</span>
  <span class="card-sub">{prettyDate}</span>
  {isLive && <span class="tmr">● live</span>}
</div>
```

**Fix for MarketDay:** Same pattern:
```html
<div class="card-hd">
  <span class="card-ico">📅</span>
  <span class="card-lbl">today</span>
  <span class="card-sub">{fmtDayWUpper(iso)}</span>
</div>
```

---

### 2.4 — Panel-in-panel nesting

**Problem:** A `.panel` inside a `.panel` body creates double borders, double blur, double shadow:

| Location | Outer | Inner |
|----------|-------|-------|
| Homepage | MarketDay panel | NewsEventsCard panel |
| Models page | panel | Card (another panel) |
| DayArchive | panel | Card (trade cards) |
| PeriodReview | panel | well cards (acceptable — well ≠ panel) |

**Fix:** When nesting, the inner card should use `.well` or a `.panel-flat` variant (no blur/shadow, just background + border):
```css
.panel-flat {
  background: var(--color-card);
  border: 0.5px solid var(--color-sep);
  border-radius: var(--radius-sm);
  /* no backdrop-filter, no shadow, no animation */
}
```

Apply `.panel-flat` to inner cards (models Card, DayArchive trade cards, MarketDay's NewsEventsCard).

---

### 2.5 — Double border on every `card-hd`

**Problem:** `.card-hd` CSS sets `border-bottom: 0.5px solid var(--color-sep)`. But every usage also adds Tailwind `border-b border-sep` (which is 1px and wins). The CSS border is dead.

**Fix:** Remove the `border-bottom` from the `.card-hd` CSS definition, since every usage overrides it with Tailwind. Or: remove the Tailwind classes from all 45 usages and let the CSS rule win. **Recommendation:** keep the CSS rule (single source of truth) and remove the Tailwind `border-b border-sep` from all card-hd usages.

---

### 2.6 — `num-up/num-down` vs `text-up/text-down` split

**Problem:** Two vocabularies for the same green/red number coloring. `num-up`/`num-down` are used in performance/accounts/DayArchive/PeriodReview. `text-up`/`text-down` are used in ThoughtCard/models/index.

**Both map to the same colors** (`--color-up`/`--color-down`). The split is purely naming.

**Fix:** Standardize on `text-up`/`text-down` (already in the Tailwind theme). Remove `num-up`/`num-down` from `app.css`. Update 4 files:
- `src/pages/performance.astro` — ~20 usages
- `src/pages/accounts.astro` — ~10 usages
- `src/components/archive/DayArchive.astro` — ~5 usages
- `src/components/period/PeriodReview.astro` — ~5 usages

---

### 2.7 — Empty-state vocabulary: 5 different patterns

**Problem:**

| Pattern | Where | Visual |
|---------|-------|--------|
| `EmptyState` component (dashed `border-line`) | stream, journal, coach, DayArchive | Dashed box |
| `border-dashed border-line2` | index stream card | Dashed box (different border token) |
| `well px-4 py-6` | index today card | Solid inset box |
| Bare text in table rows | performance, accounts, models | Just text |
| Dashed SVG rect | charts (EquityCurve, RHistogram) | Dashed rect |

**Fix:** Standardize on `EmptyState` component everywhere. Update:
- `src/pages/index.astro` — today card: use `EmptyState` instead of `well`
- `src/pages/index.astro` — stream card: use `EmptyState` (it already uses `border-dashed border-line2` — change to `EmptyState` which uses `border-line`)
- Chart empty states: render `EmptyState` below the SVG when data is empty
- Table empty states: add an `EmptyState` row or use the existing `EmptyState` below the table

---

### 2.8 — `seg/seg-on` used only on stream; PeriodReview uses plain buttons

**Problem:** Stream page has a proper `.seg`/`.seg-on` segmented control for trade/note/quote filter. PeriodReview has an identical tab-like control (week/month/quarter/half/year) but uses plain bordered buttons with `border-accent` active state.

**File:** `src/components/period/PeriodReview.astro`
**Fix:** Replace the period switcher buttons with `.seg`/`.seg-on`:
```html
<div class="seg">
  {periods.map(p => (
    <button class={`px-3 py-1.5 text-xs font-semibold ${p.active ? 'seg-on rounded-[9px]' : 'text-dim'}`}>
      {p.label}
    </button>
  ))}
</div>
```

---

## 3. Date & Typography Token Compliance

### 3.1 — Uppercase-date rule violated on ~7 surfaces

**MEMORY rule:** "Uppercase dates everywhere. Use `fmtDayWUpper()`."

**Violations:**

| File | Line(s) | What | Fix |
|------|---------|------|-----|
| `src/pages/journal/index.astro` | entry titles | `fmtDay` (raw ISO `2026-08-10`) | `fmtDayWUpper` |
| `src/pages/models.astro` | "last trade" column | `fmtDay` | `fmtDayWUpper` |
| `src/pages/performance.astro` | recent-trades table | `fmtDay` | `fmtDayWUpper` |
| `src/components/stream/ThoughtCard.astro` | showDay link text | `fmtDay` | `fmtDayWUpper` |
| `src/components/archive/DayArchive.astro` | prev/next nav | `fmtDay` | `fmtDayWUpper` |
| `src/pages/coach.astro` | date display | `fmtDay` | `fmtDayWUpper` |
| `src/pages/index.astro` | "last logged day" link text | `fmtDay` | `fmtDayWUpper` |

---

### 3.2 — `text-[12px]` / `text-[13px]` arbitrary values (66+ usages)

**Problem:** The type scale defines `--text-xs: 0.75rem` (12px) and `--text-sm: 0.8125rem` (13px). But `text-[12px]` and `text-[13px]` are used as arbitrary Tailwind values throughout — bypassing the token system.

**Fix:** Find-and-replace across the codebase:
```
text-[12px] → text-xs
text-[13px] → text-sm
```

**Files with highest counts:** Nav.astro, MarketFooter.astro, Base.astro, NewsBlock.astro, MarketWidget.astro, performance.astro, accounts.astro, DayArchive.astro.

---

### 3.3 — `--text-4xs` token (9px) defined but unused

**Problem:** `--text-4xs: 0.5625rem` (9px) is in the type scale but never used anywhere. The reference template uses 9px for forecast cell labels, table headers, and stat sub-labels.

**Fix:** Use `text-4xs` where 9px text appears:
- `src/styles/app.css` `.capsule` `font-size: 10px` → consider `text-4xs` for micro-pills
- `src/components/period/PeriodReview.astro` — forecast cell labels
- Chart axis labels (currently inline `font-size="9"` in SVG)

---

### 3.4 — Legacy chart hex colors still in use

**Problem:** `PeriodReview.astro` hardcodes `#4ade80` (old green) and `#f87171` (old red) and `#8b8b93` (old gray). These are the **pre-audit** colors, not the current palette (`--color-up: #6ea88a`, `--color-down: #c2725e`).

**File:** `src/components/period/PeriodReview.astro`
**Fix:** Replace with CSS variable references:
```diff
- fill="#4ade80"
+ fill="var(--color-up)"
- fill="#f87171"
+ fill="var(--color-down)"
- fill="#8b8b93"
+ fill="var(--color-dim)"
```

**Also:** Remove legacy chart tokens from `app.css`:
```diff
- --chart-grid: #242b3d;
- --chart-alt: #0af;
```
Replace usages in EquityCurve/RHistogram/Heatmap with `var(--color-line)` and `var(--color-accent)`.

---

## 4. Component Primitive Cleanup

### 4.1 — Three overlapping chip concepts: Badge, Tag, capsule

**Problem:**
- `Badge.astro` — square chip, 7 color variants (`up`/`down`/`warn`/`accent`/`muted`/`outline`/`default`)
- `Tag.astro` — square chip, plain (`border border-line text-2xs text-dim`)
- `.capsule` CSS class — rounded-full pill, accent-tinted

**Fix:** Keep all three but document their purpose clearly:
- **`Badge`** = status/label with color semantics (e.g., "funded", "failed", "+2.5R")
- **`Tag`** = neutral metadata label (e.g., "MNQ", "ORB")
- **`.capsule`** = interactive/accent pill (e.g., habit chips, mood selectors, filter counts)

Add a `Capsule.astro` wrapper component for consistency:
```astro
---
interface Props { class?: string }
const { class: cls = '' } = Astro.props
---
<span class={`capsule ${cls}`}><slot /></span>
```

---

### 4.2 — Dead primitives to delete

**Zero imports anywhere in `src/`:**

| File | What |
|------|------|
| `src/components/ui/Dot.astro` | Status dot — unused (inline `●` used instead) |
| `src/components/ui/Flag.astro` | Market flags — unused (inline emoji used instead) |
| `src/components/ui/Quote.astro` | Blockquote — unused |
| `src/components/ui/Button.astro` | Button wrapper — unused (raw `<button class="btn">` used) |
| `src/components/ui/Input.astro` | Input — unused |
| `src/components/ui/Textarea.astro` | Textarea — unused |
| `src/components/ui/Field.astro` | Field wrapper — unused |
| `src/components/ui/react/button.tsx` | Dead React button |
| `src/components/ui/react/checkbox.tsx` | Dead React checkbox |
| `src/components/ui/react/dialog.tsx` | Dead React dialog |
| `src/components/ui/react/select.tsx` | Dead React select |
| `src/components/ui/react/tabs.tsx` | Dead React tabs |
| `src/components/ui/react/toast.tsx` | Dead React toast |
| `src/components/ui/react/tooltip.tsx` | Dead React tooltip |

**Action:** Delete all 14 files. If `Dot.astro` or `Flag.astro` are needed later, they can be re-created.

---

### 4.3 — Wire up `Icon.astro` and `Flag.astro` (or delete them)

**Problem:** `Icon.astro` has 39 Lucide SVG icons and its docstring says "use this component, never emoji." But only journal search uses it. All 20+ card headers use emoji. `Flag.astro` exists but inline emoji is used everywhere.

**Two paths:**

**Path A (recommended): Keep emoji for card headers, use Icon for UI actions.**
- Card headers: emoji is intentional (matches WALogger v2 reference)
- UI actions (close, chevron, search, arrow): use `Icon.astro`
- Update: Lightbox close/prev/next buttons, journal back-to-top, DayArchive/PeriodReview prev/next nav

**Path B: Delete Icon.astro and Flag.astro.**
- If emoji is the permanent choice, delete the unused components.

**Recommendation:** Path A. Update these specific locations:
- `src/components/Lightbox.astro` — `×` → `<Icon name="x" />`, `‹`/`›` → `<Icon name="chevron-left" />`/`<Icon name="chevron-right" />`
- `src/components/archive/DayArchive.astro` — `←`/`→` nav arrows → `<Icon name="chevron-left" />`/`<Icon name="chevron-right" />`
- `src/components/period/PeriodReview.astro` — same nav arrows
- `src/pages/journal/index.astro` — back-to-top `↑` → `<Icon name="arrow-up-right" />` (rotated)

---

### 4.4 — `StatCard.astro` uses flat border, not `.panel`

**File:** `src/components/ui/StatCard.astro`
**Fix:** (Covered in 2.1 above)

---

### 4.5 — `Table.astro` `align: 'left'` is a no-op

**File:** `src/components/ui/Table.astro`
**Fix:** Either remove the `'left'` option or add the alignment class:
```diff
- align?: 'left' | 'right' | 'none'
+ align?: 'right' | 'none'
```

---

### 4.6 — `Icon.astro` `circle-check` is missing its circle

**Problem:** The `circle-check` icon only has the check path, not the circle. It renders as a bare checkmark.

**File:** `src/components/ui/Icon.astro`
**Fix:** Add the circle path:
```diff
- 'circle-check': ['m9 12 2 2 4-4'],
+ 'circle-check': ['circle cx="12" cy="12" r="10"', 'm9 12 2 2 4-4'],
```
Wait — the Icon component uses `<path d="...">` not `<circle>`. Need to convert:
```diff
- 'circle-check': ['m9 12 2 2 4-4'],
+ 'circle-check': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'm9 12 2 2 4-4'],
```

---

## 5. Admin/Zen Design Consistency

### 5.1 — Three duplicate `SheetFrame` implementations

**Problem:** `DayPickerSheet.tsx`, `IngestSheet.tsx`, and `AIBuildSheet.tsx` each contain a near-identical `SheetFrame` component. `AIBuildSheet` diverges: solid `bg-panel` with `shadow-2xl` (no blur, no token radius, no `--shadow-card`). All three inject duplicate `@keyframes sheet-in` styles.

**Fix:** Extract one shared `SheetFrame.tsx`:
```tsx
// src/components/admin/SheetFrame.tsx
export function SheetFrame({ title, children, onClose }: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="panel fixed top-0 right-0 bottom-0 z-101 w-[420px] max-w-[92vw] flex flex-col overflow-hidden">
        <div className="card-hd">
          <span className="card-lbl">{title}</span>
          <button onClick={onClose} className="ml-auto btn btn-sm">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  )
}
```

---

### 5.2 — `inputCls` in `admin/ui.tsx` has no radius

**Problem:** Admin form fields (TextInput, NumInput, TextArea, Select) use `inputCls` which has **square corners**. The `.input` CSS class has `border-radius: var(--radius-sm)`. Two input looks in the same app.

**File:** `src/components/admin/ui.tsx`
**Fix:** Add radius to `inputCls`:
```diff
- const inputCls = 'w-full border border-line bg-bg px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent'
+ const inputCls = 'w-full border border-line bg-bg px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent rounded-[var(--radius-sm)]'
```

---

### 5.3 — `MarkdownEditor.tsx` write/preview toggle re-implements segmented control

**Problem:** Uses raw `bg-raise text-ink` buttons instead of `.seg`/`.seg-on`. The design system has the exact control already.

**File:** `src/components/admin/MarkdownEditor.tsx`
**Fix:** Replace with `.seg`/`.seg-on`:
```diff
- <div className="flex gap-1">
-   <button className={active === 'write' ? 'bg-raise text-ink' : 'text-dim'}>Write</button>
-   <button className={active === 'preview' ? 'bg-raise text-ink' : 'text-dim'}>Preview</button>
- </div>
+ <div className="seg">
+   <button className={active === 'write' ? 'seg-on rounded-[9px] px-3 py-1.5 text-xs font-semibold' : 'px-3 py-1.5 text-xs text-dim'}>Write</button>
+   <button className={active === 'preview' ? 'seg-on rounded-[9px] px-3 py-1.5 text-xs font-semibold' : 'px-3 py-1.5 text-xs text-dim'}>Preview</button>
+ </div>
```

---

### 5.4 — OverviewTab uses "red/orange" words in UI

**Problem:** Line 294 says "the **red/orange** events" — violates the design rule "No words 'red' or 'orange' in UI."

**File:** `src/components/admin/tabs/OverviewTab.tsx`
**Fix:** Replace with severity dot references:
```diff
- "the red/orange events"
+ "the high/medium impact events"
```
Or use the dot indicators inline.

---

### 5.5 — DayWorkspace trades section has no card-hd

**Problem:** MEMORY claims "📈 trades card header shipped" but the code is a bare `text-2xs uppercase tracking-widest text-dim` label — no `card-hd`, no `card-ico`, no `.panel` wrapper.

**File:** `src/components/admin/tabs/DayWorkspace.tsx` lines 899–915
**Fix:** Wrap in a panel with card-hd:
```html
<div class="panel">
  <div class="card-hd">
    <span class="card-ico">📈</span>
    <span class="card-lbl">trades</span>
    <span class="card-sub">{trades.length}</span>
    <div class="ml-auto">{action buttons}</div>
  </div>
  <div class="p-3 md:p-4">
    {trade cards}
  </div>
</div>
```

---

### 5.6 — NotificationDrawer is the exemplar — replicate its pattern

**Problem:** `NotificationDrawer.tsx` is the **best** example of the card-hd system in the admin. It has `.panel` + `.card-hd` + `.card-ico 🔔` + `.card-lbl` + `.card-sub` + sub-sections with their own card-hd. Other admin cards (OverviewTab's "today", "build", "accounts", "system") have text-only headers with no icons.

**Fix:** Add `card-ico` emoji to all OverviewTab cards:
| Card | Current label | Add icon |
|------|--------------|----------|
| today | "today" | ☀️ |
| build | "build" | 🔨 |
| accounts — live | "accounts" | 💰 |
| daily brief | "daily brief" | 📋 |
| system | "system" | ⚙️ |

---

### 5.7 — `.kv` class underused in admin

**Problem:** `app.css` defines `.kv` (`flex items-baseline justify-between gap-3 border-b border-line/60 py-2`). OverviewTab hand-rolls 8+ rows with `flex items-center justify-between border-b border-line/60 pb-2` — identical markup, not using the class.

**File:** `src/components/admin/tabs/OverviewTab.tsx`
**Fix:** Replace hand-rolled key-value rows with `.kv`.

---

## 6. Dead Code & Documentation Drift

### 6.1 — `.crt` class is undefined

**Problem:** Both layouts add `class="crt"` to `<body>`. MarketFooter scopes a style under `.crt`. But `.crt` is **never defined in any CSS file**. It's a dead/vestigial class.

**Files:**
- `src/layouts/Base.astro` line 79
- `src/layouts/Bare.astro` line 32
- `src/components/MarketFooter.astro` line 193

**Fix:** Either define `.crt` (if it was meant to be something) or remove it. The MarketFooter style that scopes under `.crt` should be moved to a global rule or use a different selector.

---

### 6.2 — `data-theme` attribute is inert

**Problem:** Both layouts set `data-theme="summit"` on `<html>`. No CSS selector in `app.css` or anywhere else reads `[data-theme]`. It's dead metadata.

**Fix:** Either wire it up (for future theme swapping) or remove it.

---

### 6.3 — `global.css` referenced in docs but doesn't exist

**Problem:** AGENTS.md and MEMORY.md reference `src/styles/global.css`. It doesn't exist. The only stylesheet is `src/styles/app.css`.

**Fix:** Update AGENTS.md and MEMORY.md references from `global.css` to `app.css`.

---

### 6.4 — `Icon.astro` docstring contradicts practice

**Problem:** Docstring says "use this component, never emoji (except flags)." Every card header uses emoji. The doc is misleading.

**Fix:** Update the docstring:
```diff
- Public pages: use this component, never emoji (except flags → Flag.astro).
+ Public pages: emoji for card headers (intentional aesthetic). Use Icon for UI action buttons (close, chevron, search, arrows).
```

---

### 6.5 — `ui/react/` directory is entirely dead code

**Problem:** 7 React component files in `src/components/ui/react/` — none are imported anywhere. The admin uses `src/components/admin/ui.tsx` instead.

**Fix:** Delete the entire `src/components/ui/react/` directory.

---

### 6.6 — 404 page hardcodes hex colors

**File:** `src/pages/[periodType]/[...anchor].astro` — inline 404 response
**Fix:** Use CSS variables or token classes instead of hardcoded `#0a0a0c` / `#8b8b93`.

---

## 7. Polish & Enhancement Opportunities

### 7.1 — `StatCard` should use `.panel` with optional animation suppression

Currently `StatCard` uses flat `border border-line bg-panel`. When used in grids (models page: `grid-cols-2 md:grid-cols-4`), 4+ panels animating in sequence looks busy.

**Fix:** Add `.panel-static` variant:
```css
.panel-static {
  background: var(--color-card);
  border: 0.5px solid var(--color-sep);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(var(--blur-card)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--blur-card)) saturate(150%);
  /* no animation */
}
```

---

### 7.2 — Consistent panel padding

**Problem:** Multiple padding patterns:
- `panel p-4` (MarketWidget, MarketDay)
- `panel p-6` (about disclaimer)
- `panel` + inner `p-3 md:p-4` (most cards with card-hd)
- `p-2` (PeriodReview tables)

**Fix:** Standardize:
- Cards with `card-hd`: body content gets `p-3 md:p-4` (current pattern — keep)
- Cards without `card-hd`: `p-4` on the panel itself (or `p-3 md:p-4`)
- Tables: `p-0` (flush — current pattern — keep)
- Remove `p-6` from about disclaimer → `p-4`

---

### 7.3 — `h1` missing `text-ink` on some pages

**Problem:** Some pages add `text-ink` to the h1, others inherit from body. Works because body is `text-ink`, but explicit is better.

**Fix:** Add `text-ink` to all page h1s for consistency, or remove it from the ones that have it (since body provides it). **Recommendation:** remove it from the ones that have it — body inheritance is sufficient.

---

### 7.4 — Double `ml-auto` in card-hd rows

**Problem:** On index and stream pages, the live-moniker span has `ml-auto` AND the day link also has `ml-auto`. The space splits between them.

**Files:**
- `src/pages/index.astro` — stream card
- `src/pages/stream.astro` — today card

**Fix:** Remove `ml-auto` from the link. The `.tmr` pill already has `margin-left: auto` in CSS. The link should sit next to the tmr, not push from the other side.

---

### 7.5 — Flag emoji hardcoded inline instead of using `Flag.astro`

**Problem:** `Flag.astro` exists (with `us`/`uk`/`jp`/`cme` mappings) but calendar, MarketWidget, MarketFooter, and accounts all hardcode `🇺🇸🇯🇵🇬🇧📈` inline.

**Fix:** Either use `Flag.astro` in those locations, or delete `Flag.astro` and accept inline emoji. Since emoji is the intentional aesthetic for card headers, and flags are a special case (no Lucide equivalent), **recommendation:** use `Flag.astro` for consistency so a future flag change is one file.

---

### 7.6 — Hover-only drag handles on touch

**Problem:** `TradeCard.tsx` and `ModelChipRow.tsx` use `opacity-0 group-hover:opacity-100` for drag handles. On touch, there's no hover — handles are invisible until focused (and touch flow never focuses them first).

**Fix:** Add `group-active:opacity-100` for touch:
```diff
- opacity-0 group-hover:opacity-100
+ opacity-0 group-hover:opacity-100 group-active:opacity-100
```

---

### 7.7 — Scroll-margin-top missing for anchor jumps

**Problem:** Performance/journal/DayArchive/period-review have `#id` anchor links. On iOS, sticky headers (the nav, the MarketFooter) cover the target. No `scroll-margin-top` is set.

**Fix:** Add to `app.css`:
```css
[id] {
  scroll-margin-top: 4rem; /* clears sticky nav + some breathing room */
}
```

---

### 7.8 — The reference template has features 1ed.ge doesn't use

Comparing WALogger v2 (`/opt/whatsapp-logger-v2/templates/dashboard.html`) to 1ed.ge:

| WALogger v2 feature | 1ed.ge status | Action |
|---------------------|---------------|--------|
| `.card-in` padding class (12px 14px) | Not used — cards use inline `p-3 md:p-4` | Consider adding `.card-in` for consistency |
| `.fc-grid` / `.fc` forecast cells | Not used — PeriodReview uses `well` cells | Consider adopting for stat grids |
| `.c-tabs` tab control | Not used — `.seg`/`.seg-on` is the equivalent | Already covered |
| `.pill` (stats pills in header) | Not used — `.capsule` is the equivalent | Already covered |
| `.drw` / `.drw-hd` drawer pattern | Used in admin (SheetFrame) but diverged | Fix SheetFrame (5.1) |
| `sheet-in` animation | Duplicated 3x in admin | Extract to shared (5.1) |
| `slide-x` animation | Used in admin sheets | Good |
| `.emp` empty state | `EmptyState.astro` is the equivalent | Already covered |
| `prefers-reduced-motion` global kill | Only covers `.panel` animation + stars + brand | Extend to all animations |

---

### 7.9 — `prefers-reduced-motion` coverage is incomplete

**Problem:** The reduced-motion query disables panel animations, star twinkle, and brand tape. But it doesn't cover:
- `tape-pulse` (live dot animation)
- `pulse-dot` (MarketLive pulse)
- `glow-soft` (panel-hero glow)
- Admin sheet animations (`sheet-in`, `slide-x`)
- `fade-up` used outside panels

**Fix:** Extend the reduced-motion block:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is what WALogger v2 does — a global kill. More reliable than listing individual animations.

---

## Implementation Order

### Phase 1: iOS/Safari Critical (1.1–1.6)
Fix broken experiences on real devices. Ship these first.
**Estimated:** 2–3 hours

### Phase 2: Card System Unification (2.1–2.8)
The biggest visual consistency win. Unify the two card dialects.
**Estimated:** 4–6 hours

### Phase 3: Token Compliance (3.1–3.4)
Find-and-replace heavy but low-risk. Dates, type sizes, legacy colors.
**Estimated:** 2–3 hours

### Phase 4: Component Cleanup (4.1–4.6)
Delete dead code, wire up Icon.astro, fix StatCard/Table.
**Estimated:** 2–3 hours

### Phase 5: Admin Consistency (5.1–5.7)
SheetFrame extraction, input radius, segmented controls, card icons.
**Estimated:** 3–4 hours

### Phase 6: Dead Code & Docs (6.1–6.6)
Cleanup pass. Low risk, high hygiene.
**Estimated:** 1–2 hours

### Phase 7: Polish (7.1–7.9)
Enhancements. Ship incrementally.
**Estimated:** 2–3 hours

**Total estimated effort: 16–24 hours of focused work.**

---

## Quick Reference: Files to Touch

| File | Changes |
|------|---------|
| `src/styles/app.css` | `.crt` definition or removal, `.panel-static`, `.panel-flat`, `scroll-margin-top`, reduced-motion global kill, `overscroll-behavior-y`, remove `num-up/num-down`, remove `--chart-*` legacy tokens |
| `src/layouts/Base.astro` | `min-h-svh`, `theme-color`, `interactive-widget`, remove `.crt` |
| `src/layouts/Bare.astro` | `theme-color` fix, remove `.crt` |
| `src/components/Nav.astro` | `pt-safe-4` |
| `src/components/ui/Card.astro` | Add `icon`/`label`/`subtitle` props → `.card-hd` |
| `src/components/ui/StatCard.astro` | Use `.panel` or `.panel-static` |
| `src/components/ui/Table.astro` | Use `.panel`, remove `align: 'left'` |
| `src/components/Lightbox.astro` | 44px buttons, swipe, Icon.astro for close/nav |
| `src/components/MarketWidget.astro` | Add `.card-hd` header |
| `src/components/MarketDay.astro` | Add `.card-hd` header |
| `src/components/MarketFooter.astro` | Remove `.crt` scoped style |
| `src/components/MarketLive.astro` | Consolidate ticker |
| `src/components/ThemeBackground.astro` | Token-ize SVG hex colors |
| `src/components/period/PeriodReview.astro` | Token hex colors, `.seg` switcher, `fmtDayWUpper` |
| `src/components/archive/DayArchive.astro` | `fmtDayWUpper` prev/next, Icon.astro nav |
| `src/components/stream/ThoughtCard.astro` | `fmtDayWUpper` showDay |
| `src/components/admin/SheetFrame.tsx` | New shared component |
| `src/components/admin/tabs/OverviewTab.tsx` | Card icons, `.kv`, remove "red/orange" |
| `src/components/admin/tabs/DayWorkspace.tsx` | Trades card-hd panel |
| `src/components/admin/MarkdownEditor.tsx` | `.seg`/`.seg-on` toggle |
| `src/components/admin/ui.tsx` | `inputCls` radius |
| `src/pages/index.astro` | `fmtDayWUpper`, EmptyState, double ml-auto |
| `src/pages/stream.astro` | Double ml-auto |
| `src/pages/journal/index.astro` | `fmtDayWUpper` |
| `src/pages/models.astro` | `fmtDayWUpper`, inner `.panel-flat` |
| `src/pages/performance.astro` | `fmtDayWUpper`, `text-up/down`, `text-xs` |
| `src/pages/accounts.astro` | `text-up/down` |
| `src/pages/coach.astro` | `fmtDayWUpper` |
| `src/pages/about.astro` | `p-6` → `p-4` |
| 14 dead component files | Delete |

---

## 8. Chart & SVG Audit Addendum

Additional findings from deep-diving every chart component and every admin tab.

### 8.1 — `preserveAspectRatio="none"` distorts chart text

**Problem:** `RHistogram.astro` and `EquityCurve.astro` use `preserveAspectRatio="none"` on their SVGs. This stretches axis labels and max/min value text non-uniformly when the container width differs from the SVG's native width. On mobile, the text looks squished or stretched.

**Files:**
- `src/components/RHistogram.astro` — line 29
- `src/components/EquityCurve.astro` — line 34

**Fix:** Use `Heatmap.astro`'s pattern instead: set `min-w-[540px]` on the SVG + wrap in `overflow-x-auto` with `tabindex="0"`. This keeps the chart at its intended aspect ratio and scrolls horizontally on narrow screens.

---

### 8.2 — Chart empty states: 3 different patterns

**Problem:**

| Chart | Empty state | Pattern |
|-------|------------|---------|
| RHistogram | Inline dashed box | Hand-rolled `border-dashed border-line` |
| EquityCurve | Inline dashed box | Hand-rolled `border-dashed border-line` |
| Heatmap | **None** | Renders a ~3px-wide empty SVG |
| CorrTable | Inline table row | "no data yet" text in a `<td>` |
| PeriodReview tape | Hidden entirely | `tape.length > 0` guard |

**Fix:**
- RHistogram/EquityCurve: Replace inline dashed boxes with `EmptyState` component
- Heatmap: Add `EmptyState` when `data` array is empty (wrap the SVG in a conditional)
- CorrTable: Keep inline row (correct for tables)
- PeriodReview: Keep hidden (correct for optional sections)

---

### 8.3 — Charts missing `<title>` element

**Problem:** `RHistogram`, `EquityCurve`, and `PeriodReview` tape all have `role="img"` + `aria-label` but no `<title>` child element. `Heatmap` is the only one with `<title>` (best-in-class). SVG `<title>` provides native tooltip on hover and is read by screen readers.

**Fix:** Add `<title>` to all chart SVGs:
```html
<svg role="img" aria-label="R distribution histogram">
  <title>R distribution histogram</title>
  <!-- ... -->
</svg>
```

---

### 8.4 — Heatmap cells are color-only encoding

**Problem:** Heatmap cells encode "done" vs "missed" purely by fill color + opacity. No text, no per-cell `<title>`, no legend. Color-blind users can't distinguish the states.

**Fix:** Add per-cell `<title>` elements (zero-JS, native SVG):
```html
<rect ...>
  <title>{date}: {value}</title>
</rect>
```

---

### 8.5 — `CorrTable` missing `scope` and `<caption>`

**File:** `src/components/CorrTable.astro`
**Fix:**
```diff
- <th>{label}</th>
+ <th scope="col">{label}</th>
```
Add `<caption class="sr-only">Correlation matrix</caption>` inside the `<table>`.

---

### 8.6 — Legacy chart tokens: `--chart-grid` and `--chart-alt`

**Problem:** Two legacy tokens in `app.css` that duplicate the modern palette:

| Legacy | Modern equivalent | Used by |
|--------|-------------------|---------|
| `--chart-grid: #242b3d` | `--color-line2: #2a2f42` | EquityCurve:43, Heatmap:53 |
| `--chart-alt: #0af` | `--color-accent: #0af` | performance.astro:102 |

**Fix:** Remove both from `app.css`. Replace usages:
- `var(--chart-grid)` → `var(--color-line2)`
- `var(--chart-alt)` → `var(--color-accent)`

---

### 8.7 — Habit-color default `#4ade80` hardcoded in 3 places

**Problem:** When a habit has no `color` set, the fallback `#4ade80` (old bright green) is hardcoded in:
- `src/components/admin/tabs/LibraryTab.tsx` line 56
- `src/pages/zen/preview/[date].astro` line 35
- `src/pages/api/admin/days.ts` line 89

The current up-green token is `#6ea88a` (muted). These should use a shared constant.

**Fix:** Define `DEFAULT_HABIT_COLOR` in `src/lib/env.ts` (or a new `src/lib/constants.ts`):
```ts
export const DEFAULT_HABIT_COLOR = 'var(--color-up)' // or '#6ea88a'
```
Import in all 3 locations.

---

## 9. Admin Tab Deep Audit Addendum

### 9.1 — `admin/ui.tsx` `Card` has no `icon` prop → ALL admin headers are text-only

**Problem:** The shared `Card` component in `src/components/admin/ui.tsx` renders `.card-hd` + `.card-lbl` but takes **no `icon` prop**. Result: **every Card-based header across all 7 admin tabs is text-only**. Only 5 hand-written headers carry `card-ico`: ☀️ CheckInBand, 💭 WriteZone, 📈/📉 TradeCard, 🔔 NotificationDrawer.

**This is the single highest-leverage fix in the admin.** Adding one `icon` prop to `Card` fixes 6 tabs in one move.

**File:** `src/components/admin/ui.tsx` lines 69–91
**Fix:**
```diff
- interface CardProps { title?: string; className?: string; hero?: boolean; children: React.ReactNode }
+ interface CardProps { title?: string; icon?: string; className?: string; hero?: boolean; children: React.ReactNode }

  export function Card(props: CardProps) {
    return (
      <section className={`panel ${props.hero ? 'panel-hero' : ''} ${props.className ?? ''}`}>
-       {props.title && (
-         <div className="card-hd">
-           <span className="card-lbl">{props.title}</span>
+       {(props.title || props.icon) && (
+         <div className="card-hd">
+           {props.icon && <span className="card-ico">{props.icon}</span>}
+           {props.title && <span className="card-lbl">{props.title}</span>}
```

**Then update every Card call site to add icons:**

| Tab | Card title | Add icon |
|-----|-----------|----------|
| OverviewTab | "today" | ☀️ |
| OverviewTab | "build" | 🔨 |
| OverviewTab | "accounts — live" | 💰 |
| OverviewTab | "daily brief" | 📋 |
| OverviewTab | "system" | ⚙️ |
| AccountsTab | "read a statement screenshot" | 📄 |
| AccountsTab | per-account cards | 💰 |
| AccountsTab | "payouts" | 📤 |
| CoachTab | "conversation" | 🤖 |
| LibraryTab | section cards | 📚 |
| ReviewTab | "period" | 📊 |
| ReviewTab | review card | 📝 |

---

### 9.2 — `fmtDayWUpper` is **never used** in the entire admin

**Problem:** The admin uses `fmtDayW` (lowercase: `mon 10-aug-2026`) and raw ISO dates (`2026-08-10`). MEMORY rule says "uppercase dates everywhere."

**Violations:**

| File | Line | Current | Fix |
|------|------|---------|-----|
| `DayWorkspace.tsx` | 806 | `fmtDayW(date)` | `fmtDayWUpper(date)` |
| `DayRail.tsx` | 60 | `fmtDayW(m.iso)` | `fmtDayWUpper(m.iso)` |
| `OverviewTab.tsx` | 133 | `fmtDayW(m.iso)` | `fmtDayWUpper(m.iso)` |
| `OverviewTab.tsx` | 141 | `status.today` (raw ISO) | `fmtDayWUpper(status.today)` |
| `AccountsTab.tsx` | 533 | `p.date` (raw ISO) | `fmtDayWUpper(p.date)` |

**Also:** Every `fmtDayW` import in admin files should be switched to `fmtDayWUpper`.

---

### 9.3 — DayWorkspace trades/habits/footer are NOT cards

**Problem:** Three sections in the admin's primary screen bypass the card system entirely:

| Section | Current state | Should be |
|---------|--------------|-----------|
| Trades (line 898) | Plain `<div>` with text-only label | `.panel` + `.card-hd` + 📈 `card-ico` |
| Habits (HabitRow) | Bare flex row of toggles | `.panel` + `.card-hd` + ✅ `card-ico` |
| Footer (line 945) | `.panel` with no header | `.card-hd` + 📊 `card-ico` |

---

### 9.4 — MediaTab has zero card headers

**Problem:** `MediaTab.tsx` uses `panel` elements for media tiles but has **no card-hd/card-ico** on any of them. Group headers are plain `text-2xs uppercase` text.

**Fix:** Media tiles are thumbnail grids — card headers may be overkill. But the group headers ("images", "documents") should at minimum use `.card-lbl` consistently.

---

### 9.5 — LibraryTab section tabs use plain buttons, not `.seg`/`.seg-on`

**Problem:** The habits/models/rules/quotes section switcher in LibraryTab uses plain `h-10 px-3` buttons with `bg-raise`. WriteZone uses `.seg`/`.seg-on` for an identical tab-like control.

**File:** `src/components/admin/tabs/LibraryTab.tsx` lines 144–150
**Fix:** Replace with `.seg`/`.seg-on`.

---

### 9.6 — WriteZone reflection textarea uses `.input` (rounded) — the only rounded input in admin

**Problem:** Every admin input uses `inputCls` (square corners). WriteZone's reflection textarea uses `.input` (CSS class, rounded via `--radius-sm`). One outlier.

**File:** `src/components/admin/WriteZone.tsx` line 205
**Fix:** Either make all admin inputs rounded (change `inputCls` to include `rounded-[var(--radius-sm)]`) or change this one to `inputCls`. **Recommendation:** make all admin inputs rounded — the design system's `.input` class has radius for a reason.

---

### 9.7 — Dead `MarketCard.tsx` contains "red/orange" strings

**Problem:** `src/components/admin/MarketCard.tsx` (lines 70–80) renders "red/orange" text. It's **dead code** (never imported), but should be deleted to avoid confusion.

---

### 9.8 — CoachTab "data f-R-iend sees" block has no card header

**Problem:** The expandable "the data f-R-iend sees ▾" section in CoachTab is a bare `<details>` with `bg-panel` — no `.card-hd`, no icon, not a `.panel`.

**File:** `src/components/admin/CoachTab.tsx` line 109
**Fix:** Wrap in `.panel` with `.card-hd` + 🤖 `card-ico`.

---

## Updated Implementation Order

### Phase 1: iOS/Safari Critical (1.1–1.6) — 2–3h
### Phase 2: Card System Unification (2.1–2.8) — 4–6h
### Phase 3: Admin `Card` icon prop (9.1) — **1h, highest-leverage admin fix**
### Phase 4: Date Compliance (3.1 + 9.2) — 2–3h (combine public + admin fmtDayWUpper)
### Phase 5: Token Compliance (3.2–3.4 + 8.1–8.7) — 3–4h (charts + type scale + legacy colors)
### Phase 6: Component Cleanup (4.1–4.6) — 2–3h
### Phase 7: Admin Consistency (5.1–5.7 + 9.3–9.8) — 4–5h
### Phase 8: Dead Code & Docs (6.1–6.6 + 9.7) — 1–2h
### Phase 9: Polish (7.1–7.9) — 2–3h

**Total estimated effort: 21–30 hours of focused work.**

---

## Updated Files to Touch

Additions from chart/admin deep audit:

| File | Changes |
|------|---------|
| `src/components/RHistogram.astro` | `preserveAspectRatio`, `EmptyState`, `<title>` |
| `src/components/EquityCurve.astro` | `preserveAspectRatio`, `EmptyState`, `<title>`, remove `--chart-alt` usage |
| `src/components/Heatmap.astro` | Empty state, per-cell `<title>`, remove `--chart-grid` usage |
| `src/components/CorrTable.astro` | `scope="col"`, `<caption>` |
| `src/components/admin/ui.tsx` | Add `icon` prop to `Card` |
| `src/components/admin/tabs/OverviewTab.tsx` | Add icons to all Cards, fix "red/orange", `fmtDayWUpper` |
| `src/components/admin/tabs/AccountsTab.tsx` | Add icons, `fmtDayWUpper` for payouts |
| `src/components/admin/tabs/CoachTab.tsx` | Add icon, wrap details in panel |
| `src/components/admin/tabs/LibraryTab.tsx` | `.seg`/`.seg-on` section tabs |
| `src/components/admin/tabs/ReviewTab.tsx` | Add icons |
| `src/components/admin/tabs/MediaTab.tsx` | Consistent group headers |
| `src/components/admin/tabs/DayWorkspace.tsx` | `fmtDayWUpper`, trades/habits/footer card headers |
| `src/components/admin/DayRail.tsx` | `fmtDayWUpper` tooltips |
| `src/components/admin/WriteZone.tsx` | Fix rounded input outlier |
| `src/components/admin/MarketCard.tsx` | Delete (dead code) |
| `src/pages/zen/preview/[date].astro` | `DEFAULT_HABIT_COLOR` constant |
| `src/pages/api/admin/days.ts` | `DEFAULT_HABIT_COLOR` constant |
| `src/lib/env.ts` or `src/lib/constants.ts` | `DEFAULT_HABIT_COLOR` export |

---

## Design Rules Reference (consolidated)

These are the owner-locked rules. Every change in this plan follows them.

1. Same card type = same look everywhere. One component, used consistently.
2. No words "red" or "orange" in UI. Use dot severity indicators.
3. Uppercase dates everywhere. Use `fmtDayWUpper()`.
4. No `/zen` link on public pages.
5. "CME" not "CME Globex".
6. "news events" not "the day".
7. Stream icon is 📡, not 💭.
8. Mono font stays. Syne is wordmark only.
9. No sticky headers, no notification noise in header.
10. Public pages zero-JS except the shared lightbox.
11. Card headers use `.card-hd` + `.card-ico` + `.card-lbl` + optional `.card-sub` + optional `.tmr`.
12. Inset content uses `.well`.
13. Pills/badges use `.capsule` (accent) or `Badge` (semantic color).
14. Tab-like controls use `.seg`/`.seg-on`.
15. Type sizes use tokens (`text-xs`, `text-sm`), not arbitrary values.
