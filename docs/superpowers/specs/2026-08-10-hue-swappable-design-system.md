# Design System — Hue-Swappable Theme Layer + Reference Aesthetic — Design

> **Date:** 2026-08-10
> **Status:** Owner-approved ("Evolve toward the reference aesthetic… soft radius 10px, subtle blur 10px, fade-up animations… mono stays… I should be able to create new templates with different hues without changing a lot of code")
> **Reference:** `/opt/whatsapp-logger-v2/templates/dashboard.html` (the aesthetic the owner loves)

## The essence

The design must be built as a **layered token system**, not a set of one-off fixes. The palette (actual color values — the "hue layer") must be separable from the semantic roles (what components reference). Then a new template = swapping one block of hex values, zero component changes.

## 1. Token architecture (the "do it properly" part)

Current state: `@theme` in `src/styles/app.css` mixes raw hex into semantic names (`--color-bg: #07080c`). Components reference `--color-bg` directly. To re-theme you'd have to touch every value.

**New structure — three layers:**

```
Layer 1: PALETTE (the hue layer — swap these to re-theme)
  --hue-bg / --hue-panel / --hue-raise / --hue-line / --hue-line2
  --hue-ink / --hue-soft / --hue-dim / --hue-faint
  --hue-accent / --hue-up / --hue-down / --hue-warn
  --hue-card / --hue-card-hi / --hue-inset / --hue-sep / --hue-sep2

Layer 2: SEMANTIC ROLES (stable — components reference these, never change)
  --color-bg: var(--hue-bg)
  --color-panel: var(--hue-panel)
  ... one line per role, all aliasing to palette

Layer 3: MATERIAL / MOTION (radii, shadows, blur, animation tokens)
  --radius: 10px
  --radius-sm: 8px
  --shadow-card: inset highlight + soft drop
  --blur-card: 10px
  --ease-spring / --ease-out keyframe tokens
```

**New template = a new palette block.** E.g. a warm "clay" skin would redefine only `--hue-*` values; every component, token role, and public page picks it up automatically.

**Tailwind mapping:** keep the existing `--color-*` names (so `bg-bg`, `text-ink`, `border-line` still work everywhere in existing code) — they just become aliases of `--hue-*`. No component renames needed for the swap.

## 2. Reference aesthetic — the design language (from whatsapp-logger)

| Element | Reference | How it maps |
|---------|-----------|-------------|
| Cards | translucent `rgba(18,18,24,.78)` + `backdrop-filter: blur(18px)` | `--color-card` translucent + `backdrop-filter: blur(10px) saturate(150%)` |
| Card highlight | `rgba(28,28,36,.88)` (active/hover) | `--color-card-hi` |
| Inset wells | `rgba(0,0,0,.28)` | `--color-inset` for nested rows/wells |
| Hairlines | `rgba(255,255,255,.06)` / `.1` | `--color-sep` / `--color-sep2` |
| Accent | cyan `#0af` with `rgba(0,170,255,.12)` tint + `.22` glow | `--color-accent` + `--color-accent-dim` + `--color-accent-glow` |
| Radius | 14px cards / 10px small / 999px pills | `--radius: 10px`, `--radius-sm: 8px`, pills `rounded-full` |
| Shadows | `0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px rgba(0,0,0,.18)` | `--shadow-card` |
| Motion | `fade-up` (translateY 8px, 0.4s ease), staggered 0.04s; `pulse-dot`; spring `cubic-bezier(.34,1.2,.64,1)` | keyframes `fade-up`, `pulse-dot`; `--ease-out` + spring for active states |
| Type scale | 9px micro-labels → 10px timestamps → 11px secondary → 13px body → 15px key numbers → 17px brand | use existing `text-3xs…text-5xl` tokens deliberately (labels `text-2xs`, timestamps `text-3xs`, numbers `tabular-nums`) |
| Pill/capsule | `border-radius:999px`, accent-tint bg, hairline border | capsule utility / pattern (mood chips, counts, badges) |
| Segmented control | inset well + raised active segment | composer type tabs + tab bar active states |
| Color hierarchy | white → `#8e8e93` → `#636366` | `text-ink` → `text-dim` → `text-faint` (clearer steps) |

## 3. Where each layer lands

- **Layer 1 + 2 + 3**: `src/styles/app.css` `@theme` block (restructure in place; keep Tailwind utility names working).
- **Global keyframes + `.panel` material**: `app.css` (`.panel` gets translucent bg + blur + radius + fade-up entrance + `prefers-reduced-motion` off).
- **New primitive utilities** (component classes, not React components, so Astro + React both use them):
  - `.capsule` (pill: rounded-full, accent-tint, hairline)
  - `.well` (inset row background for nested content)
  - `.seg` / `.seg-on` (segmented control shell + active)
  - `.card-hd` / `.card-lbl` / `.card-sub` (card header row, label, sub — the reference's heading language)
- **Type usage discipline**: replace ad-hoc `text-[10px]`/`text-[11px]`/`text-[12px]` with token classes (`text-3xs`/`text-2xs`/`text-xs`) where the designer touches files.

## 4. Application order (layers, not files)

1. **Foundation** — restructure `@theme` into palette→roles→material, add keyframes, `.panel` material, new primitive utilities. Nothing else changes; typecheck + build must pass (site looks ~same, slightly softer).
2. **Zen day surface** — apply the language to WriteZone (composer as segmented control, bigger textarea, calm), CheckInBand (mood pills, screen-time strip), DayWorkspace (rhythm `space-y-4`, header date once, footer neutral zero), NotificationDrawer (muted badge).
3. **Public pages** — ThoughtCard + DayArchive card treatment; footer/stat cards; keep zero-JS.
4. **Micro-consistency** — × buttons, empty states, hover states, badge mutedness.

## 5. Constraints (owner-locked, do NOT re-litigate)

- Mono font stays (`--font-mono`).
- "Thought" vocabulary everywhere — never "note" (stream type stays `note` internally; display = "thought").
- **NO sticky headers, NO more badges, NO notification noise in the header.** Notification drawer stays at the bottom of the day page. Rebuild stays with it.
- Footer stats same size. Zero values render neutral (not green).
- Date shown once (header).
- Delete day at bottom. Notification badge muted gray.
- Day reflection: "due tonight" until 03:00 next day, then "overdue". Period reviews: "due today".
- Subtle, muted, minimal. Less is more. Nothing big or obnoxious.
- Public pages zero-JS except the shared lightbox.

## 6. Verification

- `npm run typecheck` — 0 errors
- `node --import tsx --test "tests/**/*.test.ts"` — all pass
- `npm run build` — succeeds
- Visual: zen day surface looks calm/inviting, cards have soft corners + subtle blur, entrance animation is gentle; a hue swap of the palette block (e.g., warm clay test) re-themes the whole UI without touching components
- Deploy preprod → verify → sync to prod → verify