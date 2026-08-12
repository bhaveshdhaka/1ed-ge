# Design: WhatsApp Logger v2 Aesthetic Applied to 1ed.ge

> **Date:** 2026-08-10
> **Status:** Owner-approved (direction confirmed)
> **Reference:** `/opt/whatsapp-logger-v2/templates/dashboard.html`
> **Predecessor:** `2026-08-10-hue-swappable-design-system.md` (token foundation — done)

## The essence

1ed.ge has the WhatsApp Logger's CSS tokens defined (3-layer palette, `.panel` class, `.well`, `.capsule`, `.seg`, `.card-hd`/`.card-lbl`/`.card-sub`) but components barely use them. The glass effect is invisible (no body gradients behind the blur). The structured card headers are unused. The density is loose on mobile. This spec applies the reference aesthetic across all surfaces — making the existing tokens actually work.

## 1. Palette shift

- Accent: `--hue-accent: #0af` (electric blue, from `#8ab4ff`)
- Accent-dim: `--hue-accent-dim: rgba(0,170,255,.12)`
- Accent-glow: `--hue-accent-glow: rgba(0,170,255,.22)`
- All downstream semantic roles (`--color-accent`, `--color-accent-dim`, `--color-accent-glow`) inherit automatically.

## 2. Body gradients (make glass visible)

Add three radial gradients to `body`:

```css
background-image:
  radial-gradient(ellipse 90% 50% at 50% -15%, rgba(0,170,255,.07), transparent 55%),
  radial-gradient(ellipse 50% 35% at 100% 60%, rgba(0,170,255,.03), transparent 50%),
  radial-gradient(ellipse 40% 30% at 0% 90%, rgba(48,209,88,.02), transparent 45%);
```

These are behind every translucent surface. Without them, `backdrop-filter: blur(18px)` has nothing to blur — you just see dark bg through dark glass.

## 3. Card variants (new CSS classes in `app.css`)

### `.panel-hero` — the featured card

The reference's signature: accent-tinted border, gradient background, deeper shadow, accent gradient top-line.

```css
.panel-hero {
  border-color: rgba(0,170,255,.18);
  background: linear-gradient(165deg, rgba(0,170,255,.08) 0%, var(--color-card) 42%);
  box-shadow: 0 1px 0 rgba(0,170,255,.08) inset, 0 10px 28px rgba(0,0,0,.22);
}
.panel-hero::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,170,255,.45), transparent);
  pointer-events: none;
}
```

Usage: the day's most important card (today's check-in on homepage, the pulse card equivalent).

### `.panel-compact` — tighter padding for mobile

```css
.panel-compact {
  --panel-pad: 12px;
}
```

Cards use `.panel-compact` by default on `<768px`. On `≥768px`, standard padding applies.

## 4. Structured card headers

Components that use `panel p-4` get structured headers using existing tokens:

```
┌─────────────────────────────────────────────┐
│ [icon]  LABEL                    [timer]    │  ← .card-hd
│         subtitle                            │  ← .card-sub
├─────────────────────────────────────────────┤
│ content...                                  │  ← .card-in (p-3 md:p-4)
```

- **`.card-hd`**: `flex items-center gap-2 px-3 py-3 min-h-[44px] border-b border-sep`
- **`.card-ico`**: 28x28 accent-tinted rounded square with emoji/icon
- **`.card-lbl`**: 11px uppercase bold, `text-dim`, tracking `.6px`
- **`.card-sub`**: 10px `text-faint`, inline after label
- **`.tmr`**: auto-margin-right pill, accent-dim bg, 10px tabular-nums

Applied to: CheckInBand, WriteZone, TradeCard (expanded), NotificationDrawer, DayArchive sections, public ThoughtCard header, MarketWidget sections.

## 5. Inset wells for nested data

`.well` (already defined: `bg: var(--color-inset); border: 0.5px solid var(--color-sep); border-radius: var(--radius-sm)`) applied to:

- Trade card expanded details (numbers, executions, tags)
- Stat grids (R, P&L, win rate)
- History rows (previous thoughts in composer)
- Forecast cells (period stats)
- Nested rows inside cards (message-like rows)

## 6. Micro-label scale

Add `--text-3xs: 0.5625rem` (9px) to the type scale in `@theme`. Used for:
- Forecast cell labels
- Table headers
- Stat sub-labels
- Timestamp micro-text

## 7. Responsive density

### Mobile (`<768px`)
- Shell: `px-4` (16px sides), no max-width (edge-to-edge)
- Card padding: `12px` (`.panel-compact`)
- Card gap: `12px` (`space-y-3`)
- Card headers: `px-3 py-2.5` (tighter)
- Min touch target: 44px (already global)

### Tablet (768–1023px)
- Shell: `max-w-2xl mx-auto px-6`
- Card padding: `14px`
- Card gap: `14px`

### Desktop (`≥1024px`)
- Shell: `max-w-6xl mx-auto px-8` (already)
- Card padding: `16px` (standard)
- Card gap: `16px` (`space-y-4`)

## 8. Segmented controls

`.seg`/`.seg-on` applied to:
- Day navigation (Today/Yesterday toggle in admin)
- Date picker tabs
- Type toggles (thought/quote/trade in composer)
- Period type selectors (week/month/quarter in reviews)

## 9. What stays unchanged

- Mono font (`--font-mono`)
- "Thought" vocabulary
- No sticky headers, no notification noise in header
- Notification drawer at bottom of day page
- Rebuild with notification drawer
- Footer stats same size
- Zero values render neutral
- Date shown once (header)
- Delete day at bottom
- Public pages zero-JS (except lightbox)
- Star-field background (`.tb-stars`) — stays, body gradients layer on top
- All owner-locked decisions from previous specs

## 10. Verification

- `npm run typecheck` — 0 errors
- `node --import tsx --test "tests/**/*.test.ts"` — all pass
- `npm run build` — succeeds
- Visual: glass cards visible on all pages (body gradients make blur effect work), hero card glows, structured headers on key surfaces, mobile is denser, iPad/desktop feel polished
- iPhone Safari: safe-area insets respected, touch targets 44px, pull-to-refresh works
- iPad Safari: 768-1023px breakpoint clean, cards properly sized
- Desktop Safari: full-width shell, glass effect most visible
