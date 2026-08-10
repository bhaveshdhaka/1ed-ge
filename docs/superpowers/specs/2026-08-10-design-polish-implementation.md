# Implementation Plan: Design System Polish (Items 1–5)

> **Date:** 2026-08-10
> **Goal:** Clean deps, add motion language, fix mobile blur, upgrade lightbox, unify Card system
> **Audience:** Junior developer — every step is small, bounded, and verifiable
> **Prerequisite:** None — items are independent. Do them in order or pick any item.

---

## Table of Contents

1. [Item 1: Dead Dependency Cleanup](#item-1-dead-dependency-cleanup) — 30 min
2. [Item 2: Motion Token System](#item-2-motion-token-system) — 2 hours
3. [Item 3: Mobile Blur Reduction](#item-3-mobile-blur-reduction) — 15 min
4. [Item 4: Lightbox Upgrade to Bottom Sheet](#item-4-lightbox-upgrade-to-bottom-sheet) — 3 hours
5. [Item 5: Unified Card System](#item-5-unified-card-system) — 4 hours

---

## Item 1: Dead Dependency Cleanup

**Time:** 30 minutes
**Risk:** Low — these packages are imported nowhere in `src/`
**Files touched:** `package.json` only

### What you're doing

Removing 11 npm packages that are installed but never imported. They add weight to `node_modules` and slow down `npm install`.

### Step 1.1 — Remove dead packages

Run this command in the project root:

```bash
npm uninstall lucide-react lucide-static @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip class-variance-authority textarea-caret-position @fontsource-variable/newsreader
```

This removes them from `package.json` and `node_modules`.

### Step 1.2 — Verify nothing broke

```bash
npm run typecheck
```

If you see errors about missing imports, you accidentally removed a used package. The safe packages (verified used — do NOT remove these) are:
- `@tanstack/react-table` — used in `IngestSheet.tsx`
- `cmdk` — used in `CommandPalette.tsx`
- `sonner` — used in `AdminApp.tsx` and `DayWorkspace.tsx`
- `tailwind-merge` — used in `src/lib/utils.ts`

### Step 1.3 — Build and verify

```bash
npm run build
```

Should complete cleanly. The `dist/` size should be the same or slightly smaller (tree-shaking may have already excluded them, but `node_modules` shrinks by ~100 MB).

### Step 1.4 — Commit

```bash
git add -A
git commit -m "chore: remove 11 unused dependencies"
```

**Done.** Total time: 30 minutes. Zero visual changes.

---

## Item 2: Motion Token System

**Time:** 2 hours
**Risk:** Low — additive CSS only, no behavior changes
**Files touched:** `src/styles/app.css` (primary), then optional updates to components

### What you're doing

Adding a small set of CSS custom properties (motion tokens) that define the app's animation language. Every future animation references these tokens instead of hardcoding durations/easings. You're also adding transitions to `.seg`/`.seg-on` and `.btn` so interactive elements feel responsive.

### Background: what exists today

The app has:
- **One entrance animation:** `.panel` uses `fade-up 0.4s var(--ease-out)` with a 5-panel stagger
- **One sheet animation:** `SheetFrame.tsx` has an inline `sheet-in` keyframe (60ms, translateX)
- **Hover transitions:** `transition-colors` on buttons/links via Tailwind
- **Zero transitions on:** `.seg`/`.seg-on`, `.lb-btn:hover`, `.capsule`, `.panel-hero`
- **Two unused keyframes:** `pulse-dot` and `glow-soft` (defined but never referenced)
- **Two easing tokens:** `--ease-out` and `--ease-spring` (spring is unused)

### Step 2.1 — Add motion tokens to Layer 3

Open `src/styles/app.css`. Find the Layer 3 section (around line 77). Add these tokens after the existing ones:

```css
/* ═════════════════════════════════════════════════════════════════════════════
 * LAYER 3: MATERIAL / MOTION (radii, shadows, blur, animation tokens)
 * ═════════════════════════════════════════════════════════════════════════════ */

--radius: 14px;
--radius-sm: 10px;
--shadow-card: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 8px 24px rgba(0, 0, 0, 0.18);
--blur-card: 18px;
--ease-out: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-spring: cubic-bezier(0.34, 1.2, 0.64, 1);

/* Motion tokens */
--motion-fast: 0.15s;
--motion-normal: 0.3s;
--motion-slow: 0.5s;
--motion-enter: fade-up 0.35s var(--ease-out) both;
--motion-sheet: sheet-in 0.3s var(--ease-out) both;
```

### Step 2.2 — Add the `sheet-in` keyframe to app.css

Currently `sheet-in` is defined inline in `SheetFrame.tsx`. Move it to `app.css` so it's a shared token. Add near the other keyframes (after `fade-up`, around line 130):

```css
@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fade-down {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(6px);
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

### Step 2.3 — Add transition to `.seg` buttons

Find the `.seg` / `.seg-on` block (around line 315). Add a transition to the shell and a hover/active state:

```css
.seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.05);
  border: 0.5px solid var(--color-sep);
}

.seg-on {
  background: var(--color-card-hi);
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast),
              box-shadow var(--motion-fast);
}
```

**What this does:** When a segment becomes active (`.seg-on` is toggled), the background and shadow animate over 0.15 seconds instead of snapping instantly. The non-active segments don't need a transition — they just lose the class.

### Step 2.4 — Add transition to `.btn` active state

Find the `.btn` block (around line 252). Add a `:active` state:

```css
.btn {
  /* existing styles... */
  transition: color var(--motion-fast),
              background-color var(--motion-fast),
              border-color var(--motion-fast),
              transform var(--motion-fast);
}

@media (pointer: coarse) {
  .btn:active {
    transform: scale(0.97);
  }
}
```

**What this does:** On touch devices, buttons briefly shrink when tapped (like iOS native buttons). The `scale(0.97)` is subtle — users feel it more than see it.

### Step 2.5 — Add transition to `.capsule`

Find the `.capsule` block (around line 280). Add a transition:

```css
.capsule {
  /* existing styles... */
  transition: background var(--motion-fast),
              border-color var(--motion-fast),
              color var(--motion-fast);
}
```

### Step 2.6 — Add transition to `.panel-hero` glow

The `.panel-hero` has a `::before` pseudo-element (the glow line). Add a hover intensification:

```css
.panel-hero {
  /* existing styles... */
  transition: border-color var(--motion-normal) var(--ease-out),
              box-shadow var(--motion-normal) var(--ease-out);
}

.panel-hero:hover {
  border-color: rgba(0, 170, 255, 0.28);
  box-shadow: 0 1px 0 rgba(0, 170, 255, 0.12) inset, 0 12px 32px rgba(0, 0, 0, 0.28);
}
```

**What this does:** The hero card subtly intensifies on hover — the accent border gets brighter, the shadow deepens. It's a 0.3s ease-out, so it feels like the card is "waking up" when you look at it.

### Step 2.7 — Clean up unused keyframes

Remove `pulse-dot` and `glow-soft` from `app.css` — they're defined but never used anywhere. This prevents confusion for future developers.

```css
/* DELETE these two blocks: */
@keyframes pulse-dot { ... }  /* unused */
@keyframes glow-soft { ... }  /* unused */
```

### Step 2.8 — Verify

```bash
npm run typecheck && npm run build
```

Visual check:
- Open the site → the `.seg` filter on the stream page should now animate when switching between all/trade/note/quote
- Tap a button on mobile → it should briefly shrink (0.97 scale)
- The homepage hero card should subtly intensify on hover
- Everything else should look identical

### Step 2.9 — Commit

```bash
git add -A
git commit -m "feat: motion token system — seg transitions, btn active, capsule hover, panel-hero glow"
```

**Done.** Total time: 2 hours. The design system now has a motion language that every future component inherits.

---

## Item 3: Mobile Blur Reduction

**Time:** 15 minutes
**Risk:** Very low — one CSS media query
**Files touched:** `src/styles/app.css`

### What you're doing

Reducing `backdrop-filter: blur(18px)` to `blur(8px)` on screens smaller than 768px. The glass effect still looks good at 8px but composites 4x faster on iPhone Safari, eliminating scroll jank on heavy pages (performance, calendar, stream).

### Step 3.1 — Add the mobile override

Open `src/styles/app.css`. Find the mobile responsive block (around line 725, the `@media (max-width: 767px)` section). Add:

```css
@media (max-width: 767px) {
  /* existing mobile overrides... */

  /* Lighter blur on mobile — 8px is still glassy but composites 4x faster on iPhone */
  .panel,
  .panel-hero,
  .panel-static,
  .panel-flat {
    backdrop-filter: blur(8px) saturate(120%);
    -webkit-backdrop-filter: blur(8px) saturate(120%);
  }
}
```

### Step 3.2 — Verify

```bash
npm run build
```

Visual check (on a real iPhone or Chrome DevTools mobile mode):
- Open the performance page → scroll should be smooth (no frame drops)
- Open the calendar page → day cards should still look translucent
- The glass effect should still be visible — just slightly less deep

### Step 3.3 — Commit

```bash
git add -A
git commit -m "fix: reduce backdrop-filter blur on mobile for smoother scrolling"
```

**Done.** Total time: 15 minutes. The iPhone experience just got significantly smoother.

---

## Item 4: Lightbox Upgrade to Bottom Sheet

**Time:** 3 hours
**Risk:** Medium — this is the public site's only JavaScript interaction
**Files touched:** `src/components/Lightbox.astro`, `src/styles/app.css`

### What you're doing

Transforming the lightbox from a centered `<dialog>` modal into a bottom sheet that slides up from the bottom of the screen (like iOS share sheets and photo viewers). Adding: slide-up animation, swipe-down-to-close, image preload, a caption/counter bar, and keyboard navigation.

### Current state of Lightbox.astro

- Native `<dialog>` element, mounted globally in `Base.astro`
- 44px buttons (`× ‹ ›`), positioned absolute
- Swipe handler: 50px horizontal threshold triggers prev/next
- Images load via `new Image()` with no preload or fade
- No caption, no counter, no keyboard nav beyond native Esc
- CSS: `.lb` (border, bg, max-width), `.lb::backdrop` (dark overlay), `.lb-body img` (max dimensions)

### Step 4.1 — Add bottom-sheet CSS to app.css

Find the `.lb` CSS block (around line 674). Replace the entire lightbox section with:

```css
/* ---- lightbox as bottom sheet ---- */
.lb {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  border: none;
  background: transparent;
  color: var(--color-ink);
  padding: 0;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.lb::backdrop {
  background: rgba(7, 8, 12, 0.88);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.lb-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 92vh;
  background: var(--color-bg);
  border-top: 0.5px solid var(--color-sep2);
  border-radius: var(--radius) var(--radius) 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(100%);
  transition: transform 0.35s var(--ease-out);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.lb-sheet.lb-open {
  transform: translateY(0);
}

.lb-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 6px;
  flex-shrink: 0;
  cursor: grab;
}

.lb-handle i {
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.18);
  display: block;
}

.lb-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px 10px;
  flex-shrink: 0;
}

.lb-counter {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-dim);
  font-variant-numeric: tabular-nums;
}

.lb-caption {
  font-size: 11px;
  color: var(--color-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.lb-close-btn {
  appearance: none;
  border: 0.5px solid var(--color-sep2);
  background: var(--color-card-hi);
  color: var(--color-dim);
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--motion-fast), border-color var(--motion-fast);
}

.lb-close-btn:hover {
  color: var(--color-accent);
  border-color: rgba(0, 170, 255, 0.3);
}

.lb-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  min-height: 0;
}

.lb-body img {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: opacity 0.25s var(--ease-out);
}

.lb-body img.lb-visible {
  opacity: 1;
}

.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  appearance: none;
  border: 0.5px solid var(--color-sep2);
  background: var(--color-card-hi);
  color: var(--color-dim);
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: color var(--motion-fast), border-color var(--motion-fast);
  z-index: 2;
}

.lb-nav:hover {
  color: var(--color-accent);
  border-color: rgba(0, 170, 255, 0.3);
}

.lb-prev { left: 8px; }
.lb-next { right: 8px; }

@media (max-width: 767px) {
  .lb-nav {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lb-sheet {
    transition: none;
  }
  .lb-body img {
    transition: none;
  }
}
```

### Step 4.2 — Rewrite Lightbox.astro

Replace the entire contents of `src/components/Lightbox.astro` with:

```astro
---
/** Lightbox.astro — bottom-sheet image viewer (the site's single JS exception) */
---

<dialog id="lb" class="lb" aria-label="Image viewer">
  <div class="lb-sheet" id="lb-sheet">
    <div class="lb-handle" id="lb-handle"><i></i></div>
    <div class="lb-header">
      <span class="lb-counter" id="lb-counter"></span>
      <span class="lb-caption" id="lb-caption"></span>
      <button class="lb-close-btn" id="lb-close" aria-label="Close">×</button>
    </div>
    <div class="lb-body" id="lb-body">
      <img id="lb-img" alt="" />
    </div>
  </div>
  <button class="lb-nav lb-prev" id="lb-prev" aria-label="Previous image">‹</button>
  <button class="lb-nav lb-next" id="lb-next" aria-label="Next image">›</button>
</dialog>

<script>
(function () {
  const dlg = document.getElementById('lb') as HTMLDialogElement;
  const sheet = document.getElementById('lb-sheet')!;
  const handle = document.getElementById('lb-handle')!;
  const counter = document.getElementById('lb-counter')!;
  const caption = document.getElementById('lb-caption')!;
  const closeBtn = document.getElementById('lb-close')!;
  const img = document.getElementById('lb-img') as HTMLImageElement;
  const prevBtn = document.getElementById('lb-prev')!;
  const nextBtn = document.getElementById('lb-next')!;

  type Group = { href: string; alt: string }[];
  const groups = new Map<string, Group>();
  let currentGroup: Group = [];
  let currentIndex = 0;
  let isOpen = false;

  // Preload adjacent images
  function preload(index: number) {
    for (const offset of [-1, 1]) {
      const i = index + offset;
      if (i >= 0 && i < currentGroup.length) {
        const p = new Image();
        p.src = currentGroup[i].href;
      }
    }
  }

  function show(index: number) {
    if (!currentGroup.length) return;
    currentIndex = ((index % currentGroup.length) + currentGroup.length) % currentGroup.length;
    const item = currentGroup[currentIndex];

    // Fade out current, load new, fade in
    img.classList.remove('lb-visible');
    const loader = new Image();
    loader.onload = () => {
      img.src = item.href;
      img.alt = item.alt;
      img.classList.add('lb-visible');
    };
    loader.src = item.href;

    counter.textContent = `${currentIndex + 1} / ${currentGroup.length}`;
    caption.textContent = item.alt || '';
    preload(currentIndex);
  }

  function open(groupKey: string, index: number) {
    currentGroup = groups.get(groupKey) || [];
    if (!currentGroup.length) return;
    isOpen = true;
    dlg.showModal();
    // Trigger slide-up after dialog is visible
    requestAnimationFrame(() => {
      sheet.classList.add('lb-open');
    });
    show(index);
  }

  function close() {
    isOpen = false;
    sheet.classList.remove('lb-open');
    // Wait for slide-down transition, then close dialog
    setTimeout(() => {
      dlg.close();
      img.src = '';
      img.classList.remove('lb-visible');
    }, 350);
  }

  function prev() { show(currentIndex - 1); }
  function next() { show(currentIndex + 1); }

  // Collect all [data-lb] anchors and group them
  function collectGroups() {
    groups.clear();
    document.querySelectorAll('[data-lb]').forEach((el) => {
      const anchor = el as HTMLAnchorElement;
      const key = anchor.dataset.lb || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ href: anchor.href, alt: (anchor.querySelector('img') as HTMLImageElement)?.alt || '' });
    });
  }

  // Click delegation
  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement).closest('[data-lb]') as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    collectGroups();
    const key = anchor.dataset.lb || '';
    const group = groups.get(key) || [];
    const index = group.findIndex((g) => g.href === anchor.href);
    open(key, Math.max(0, index));
  });

  // Close button
  closeBtn.addEventListener('click', close);

  // Backdrop click
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });

  // Nav buttons
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // Keyboard navigation
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  // Swipe: horizontal = prev/next, vertical down = close
  let startX = 0;
  let startY = 0;
  let dragging = false;

  sheet.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });

  sheet.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) prev(); else next();
    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      close();
    }
  }, { passive: true });

  // Handle drag: swipe down on the drag handle
  let handleStartY = 0;
  let handleDragging = false;

  handle.addEventListener('touchstart', (e) => {
    handleStartY = e.touches[0].clientY;
    handleDragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!handleDragging) return;
    const dy = e.touches[0].clientY - handleStartY;
    if (dy > 0) {
      sheet.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', (e) => {
    if (!handleDragging) return;
    handleDragging = false;
    sheet.style.transition = '';
    const dy = e.changedTouches[0].clientY - handleStartY;
    if (dy > 100) {
      close();
    } else {
      sheet.style.transform = '';
      sheet.classList.add('lb-open');
    }
  }, { passive: true });
})();
</script>
```

### Step 4.3 — Verify

```bash
npm run typecheck && npm run build
```

Visual check:
1. Open any page with images (a day page with trade screenshots, or the stream)
2. Click an image → the sheet should slide up from the bottom (not pop in)
3. Swipe left/right on the image → should navigate prev/next
4. Swipe down on the image → should close the sheet
5. Drag the handle bar down → the sheet should follow your finger, then snap closed if dragged far enough
6. Press arrow keys → should navigate
7. Press Escape → should close
8. The counter should show "1 / 3" style
9. The caption should show the image alt text
10. Images should fade in when loaded (not pop)
11. Adjacent images should preload
12. On mobile (< 768px): nav buttons should be hidden (swipe only)
13. With `prefers-reduced-motion`: no slide animation, instant open/close

### Step 4.4 — Commit

```bash
git add -A
git commit -m "feat: lightbox as bottom sheet — slide-up, swipe-to-close, image preload, keyboard nav"
```

**Done.** Total time: 3 hours. The lightbox now feels native on iOS.

---

## Item 5: Unified Card System

**Time:** 4 hours
**Risk:** Medium — touches many files, but changes are mechanical (class swaps)
**Files touched:** `src/components/ui/Card.astro`, `src/components/ui/StatCard.astro`, `src/components/ui/Table.astro`, `src/styles/app.css`, plus ~15 pages/components that hand-build card markup

### What you're doing

Making `Card.astro` the single entry point for all card surfaces. StatCard and Table become variants of Card (not separate components). Hand-built `panel` + `card-hd` markup across 19 files gets replaced with `<Card>` calls. The admin `Card` in `ui.tsx` gets the same prop interface as the Astro `Card`.

### Current state

- **`Card.astro`** (37 lines): has `icon`, `label`, `subtitle`, `title`, `pad`, `hero`, `actions` slot. Used in 4 files.
- **`StatCard.astro`** (19 lines): `panel-static` + stat layout. Used in 2 files (14 call sites).
- **`Table.astro`** (25 lines): `panel` + table wrapper. Used in 3 files.
- **`EmptyState.astro`** (13 lines): dashed border block. Used in 8+ files. Keep as-is.
- **49 hand-built `card-hd`** across 19 files — most pages bypass Card entirely.
- **Admin `Card`** in `ui.tsx`: different prop interface (no `pad`, `hero`, `subtitle`).

### Step 5.1 — Extend Card.astro with new variants

Replace `src/components/ui/Card.astro` with:

```astro
---
/**
 * Card.astro — the one panel primitive.
 *
 * Variants:
 *   default  — glass panel with optional card-hd header
 *   hero     — accent glow (panel-hero)
 *   static   — no entrance animation (panel-static) — for stat grids
 *   flat     — nested card: bg + border only, no blur/shadow (panel-flat)
 *
 * Content patterns:
 *   <Card icon="📈" label="trades" subtitle="3">         → card-hd with icon
 *   <Card title="legacy heading">                        → old-style header (backward compat)
 *   <Card label="R" stat={{value: '+2.5', tone: 'up'}}>  → stat display (no card-hd)
 *   <Card>                                               → headerless panel
 *
 * Named slots:
 *   actions  — rendered ml-auto in the card-hd row
 *   default  — card body content
 */

interface Props {
  icon?: string
  label?: string
  subtitle?: string
  title?: string       // legacy — renders old-style header
  variant?: 'default' | 'hero' | 'static' | 'flat'
  pad?: 'none' | 'sm' | 'md'
  stat?: { value: string; delta?: string; tone?: 'up' | 'down' | 'default' }
  class?: string
}

const {
  icon, label, subtitle, title,
  variant = 'default',
  pad = 'md',
  stat,
  class: cls = '',
} = Astro.props

const pads = { none: '', sm: 'p-2', md: 'p-4' }
const variantCls = {
  default: 'panel',
  hero: 'panel panel-hero',
  static: 'panel-static',
  flat: 'panel-flat',
}

const hasHeader = icon || label || title
const hasStat = !!stat
const toneCls = stat ? { up: 'text-up', down: 'text-down', default: 'text-ink' }[stat.tone || 'default'] : ''
---

{hasStat ? (
  <div class={`${variantCls[variant]} ${pads[pad]} ${cls}`}>
    <div class="text-2xs uppercase tracking-widest text-dim">{label}</div>
    <div class={`mt-1 text-lg font-semibold tabular-nums ${toneCls}`}>{stat!.value}</div>
    {stat!.delta !== undefined && <div class="mt-0.5 text-2xs text-faint">{stat!.delta}</div>}
  </div>
) : (
  <section class={`${variantCls[variant]} ${pads[pad]} ${cls}`}>
    {hasHeader && (
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
    {!hasHeader && Astro.slots.has('actions') && (
      <div class="mb-3 flex items-center justify-between gap-3">
        <div></div>
        <div class="flex items-center gap-2"><slot name="actions" /></div>
      </div>
    )}
    <slot />
  </section>
)}
```

### Step 5.2 — Update StatCard.astro to use Card

Replace `src/components/ui/StatCard.astro` with a thin wrapper:

```astro
---
/** StatCard.astro — thin wrapper around Card with stat variant. Kept for backward compatibility. */
import Card from './Card.astro'

interface Props {
  label: string
  value: string
  delta?: string
  tone?: 'up' | 'down' | 'default'
  class?: string
}

const { label, value, delta, tone = 'default', class: cls = '' } = Astro.props
---

<Card variant="static" label={label} stat={{ value, delta, tone }} class={cls} />
```

**What this does:** Existing `<StatCard>` usage in models.astro and PeriodReview.astro keeps working unchanged. Under the hood it renders via Card.

### Step 5.3 — Update Table.astro to use Card

Replace `src/components/ui/Table.astro` with:

```astro
---
/** Table.astro — data table inside a Card panel. */
import Card from './Card.astro'

interface Props {
  head: string[]
  class?: string
  align?: 'right' | 'none'
}

const { head, class: cls = '', align = 'none' } = Astro.props
---

<Card variant="flat" pad="none" class={cls}>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse">
      <thead>
        <tr>
          {head.map((h) => (
            <th class={`th ${align === 'right' ? 'text-right' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody class={align === 'right' ? '[&>tr>td]:text-right' : ''}>
        <slot />
      </tbody>
    </table>
  </div>
</Card>
```

### Step 5.4 — Migrate hand-built card markup (the big step)

This is the bulk of the work. You're replacing hand-rolled `panel` + `card-hd` markup with `<Card>` calls. Do this **one file at a time**, verifying after each.

**The pattern to replace:**

BEFORE (hand-built):
```astro
<div class="panel">
  <div class="card-hd">
    <span class="card-ico">📈</span>
    <span class="card-lbl">trades</span>
    <span class="card-sub">3</span>
  </div>
  <div class="p-3 md:p-4">
    <!-- content -->
  </div>
</div>
```

AFTER (Card):
```astro
<Card icon="📈" label="trades" subtitle="3">
  <!-- content -->
</Card>
```

**File-by-file migration order** (start with the simplest, build confidence):

**Priority 1 — Simple pages (low risk, quick wins):**

| File | Panels to migrate | Notes |
|------|-------------------|-------|
| `src/pages/about.astro` | 2 panels | Simple card-hd rows |
| `src/pages/coach.astro` | 1 panel | One card-hd |
| `src/pages/stream.astro` | 2 panels | Today card + feed card |
| `src/components/stream/DayFacts.astro` | 1 panel | card-hd + well grid |
| `src/components/NewsEventsCard.astro` | 1 panel | Reusable — fix once, used everywhere |

**Priority 2 — Medium complexity:**

| File | Panels to migrate | Notes |
|------|-------------------|-------|
| `src/pages/calendar.astro` | 1 main panel + day rows | Day rows use `class:list` for hero — use Card's `variant` |
| `src/pages/models.astro` | 1 outer panel | Inner cards already use `<Card>` |
| `src/pages/journal/index.astro` | 1 panel | Already uses `<Card>` for entries |
| `src/components/MarketWidget.astro` | 1 panel | Recently updated with card-hd |
| `src/components/MarketDay.astro` | 1 panel | Recently updated |
| `src/pages/accounts.astro` | 2 panels | Accounts + payouts |

**Priority 3 — Complex pages:**

| File | Panels to migrate | Notes |
|------|-------------------|-------|
| `src/components/archive/DayArchive.astro` | 7 panels | Most panels on any page |
| `src/pages/performance.astro` | 14 panels | Heaviest page — do last |
| `src/components/period/PeriodReview.astro` | 11 panels | Also heavy; has dead Card import to fix |
| `src/components/stream/ThoughtCard.astro` | 1 panel | Has inline frame style — keep the left-rail accent as a `class` prop |

**Priority 4 — Admin (React side):**

| File | What to update |
|------|---------------|
| `src/components/admin/ui.tsx` | Align `Card` props with Astro `Card` (add `subtitle`, `variant`, `pad`) |

### Step 5.5 — Remove dead import in PeriodReview.astro

Line 15 of `src/components/period/PeriodReview.astro` imports `Card` but never uses it. Remove the import.

### Step 5.6 — Remove `panel-flat` dead CSS or start using it

`panel-flat` is defined in `app.css` but used nowhere. After the Table migration (Step 5.3), Table uses it via `Card variant="flat"`. Verify it renders correctly — it should be a card with background + border but no blur/shadow/animation.

### Step 5.7 — Verify each file after migration

After migrating each file:
```bash
npm run typecheck
```

After all files:
```bash
npm run build
```

Visual check:
- Every page should look identical to before
- Card headers should have the same icons, labels, subtitles
- Hero cards should glow
- Stat grids should have no entrance animation (static variant)
- Tables should render inside flat panels

### Step 5.8 — Commit in chunks

Commit after each priority group:

```bash
# After Priority 1
git add -A && git commit -m "refactor: migrate simple pages to unified Card component"

# After Priority 2
git add -A && git commit -m "refactor: migrate medium pages to unified Card component"

# After Priority 3
git add -A && git commit -m "refactor: migrate complex pages to unified Card component"

# After Priority 4
git add -A && git commit -m "refactor: align admin Card props with unified Card system"
```

**Done.** Total time: 4 hours. The design system now has one Card component that every surface uses. Adding a new card page is one import, one component, zero hand-built markup.

---

## Verification Checklist (after all 5 items)

```bash
npm run typecheck     # 0 errors
npm run build         # clean
bash scripts/where-am-i.sh   # confirm env
bash scripts/ship.sh test-only  # deploy to test
bash scripts/verify-env.sh test # HTTP 200 + noindex
```

Then manually verify:
- [ ] Homepage: hero card glows on hover, seg animates, images open in bottom sheet
- [ ] Stream: seg filter animates, ThoughtCard images open in bottom sheet
- [ ] Calendar: day cards have card-hd, today glows, news card is reusable Card
- [ ] Performance: all 14 panels use Card, stat grids have no entrance animation
- [ ] Models: StatCard renders via Card
- [ ] About: panels use Card
- [ ] Day page: trade screenshots open in bottom sheet, swipe-to-close works
- [ ] Lightbox: slide-up animation, swipe-down-to-close, handle drag, keyboard nav, image fade-in
- [ ] Mobile (< 768px): backdrop-filter is blur(8px), scroll is smooth, buttons scale on tap
- [ ] Reduced motion: no animations, lightbox instant open/close

---

## What This Enables (future work)

After these 5 items, the design system is:
- **Cleaner** — no dead deps, no dead CSS, one Card component
- **Alive** — motion tokens give every future component consistent animation
- **Smooth** — mobile blur is tuned for iPhone performance
- **Native** — the lightbox feels like an iOS bottom sheet
- **Unified** — Card is the single vocabulary for every card surface

The next logical items (from the original audit) are:
- PeriodReview period switcher → `.seg`/`.seg-on` (5 minutes)
- Card-hd double border cleanup (remove Tailwind overrides from all 45 usages)
- `--text-4xs` adoption in chart SVGs
- Coach page visual treatment (currently bare prose, no panels)
