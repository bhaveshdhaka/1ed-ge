# UIUX Design System Implementation Plan

> **Date:** 2026-08-10
> **Status:** Ready for execution
> **Session focus:** Thoughtful UIUX design — apply the design system foundation across all surfaces
> **Previous session:** Built the hue-swappable design system foundation (commit a6709e8)

---

## Context

### What was built (foundation — commit a6709e8)

The design system foundation is complete and verified:

**3-layer token architecture** in `src/styles/app.css`:
- **Layer 1 (Palette):** `--hue-*` tokens with raw color values
- **Layer 2 (Semantic):** `--color-*` tokens aliasing to palette (backward compatible)
- **Layer 3 (Material):** `--radius`, `--shadow-card`, `--blur-card`, `--ease-*` tokens

**Material/motion tokens:**
- `--radius: 10px` (soft corners, was 2px)
- `--radius-sm: 8px`
- `--shadow-card: 0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.18)`
- `--blur-card: 10px`
- `--ease-out: cubic-bezier(0.25, 0.1, 0.25, 1)`
- `--ease-spring: cubic-bezier(0.34, 1.2, 0.64, 1)`

**Keyframes:**
- `fade-up` (translateY 8px, 0.4s ease-out)
- `pulse-dot` (scale 1→1.2, opacity 1→0.45)

**`.panel` class:**
- Translucent bg (`var(--color-card)`)
- Backdrop blur (`blur(var(--blur-card)) saturate(150%)`)
- Soft corners (`border-radius: var(--radius)`)
- Shadow (`var(--shadow-card)`)
- Fade-up entrance animation (staggered 0.02s–0.18s for first 5 panels)
- Respects `prefers-reduced-motion`

**Primitive utilities:**
- `.capsule` — pill (rounded-full, accent-tint, hairline border)
- `.well` — inset row background
- `.seg` / `.seg-on` — segmented control shell + active
- `.card-hd` / `.card-lbl` / `.card-sub` — card header language

**Verification:**
- ✅ Typecheck: 0 errors
- ✅ Tests: 189/189 passed
- ✅ Build: succeeded
- ✅ Backward compatible: existing Tailwind classes still work

### What needs to be done

The foundation is built but not yet applied. Components still use raw `border border-line bg-panel` patterns instead of the `.panel` class. Text sizes are hardcoded (`text-[10px]`, `text-[11px]`, `text-[12px]`) instead of using tokens (`text-3xs`, `text-2xs`, `text-xs`).

The goal: apply the design system language across all surfaces (zen admin + public pages) to create a calm, inviting, cohesive aesthetic.

---

## Owner Constraints (DO NOT VIOLATE)

These are owner-locked decisions from this session. Do not re-litigate or override:

1. **Mono font stays** — `--font-mono` (JetBrains Mono)
2. **"Thought" vocabulary everywhere** — never "note" (stream type stays `note` internally; display = "thought")
3. **NO sticky headers, NO more badges, NO notification noise in the header**
4. **Notification drawer stays at the bottom** of the day page — that placement is final
5. **Rebuild stays with the notification drawer**
6. **Footer stats same size** — no bigger footer
7. **Zero values render neutral** (not green) — already fixed
8. **Date shown once** (in header) — already fixed
9. **Delete day at bottom** — already fixed
10. **Notification badge muted gray** — already fixed
11. **Day reflection:** "due tonight" until 03:00 next day, then "overdue" — already fixed
12. **Period reviews:** "due today" — already fixed
13. **Subtle, muted, minimal** — less is more, nothing big or obnoxious
14. **Public pages zero-JS** except the shared lightbox

---

## Reference Aesthetic

The owner loves the aesthetic of `/opt/whatsapp-logger-v2/templates/dashboard.html`. Key qualities:

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
| Pill/capsule | `border-radius:999px`, accent-tint bg, hairline border | `.capsule` utility |
| Segmented control | inset well + raised active segment | `.seg` / `.seg-on` utilities |
| Color hierarchy | white → `#8e8e93` → `#636366` | `text-ink` → `text-dim` → `text-faint` (clearer steps) |

**Read the reference file** before starting: `/opt/whatsapp-logger-v2/templates/dashboard.html`

---

## Execution Plan (11 Chunks)

Each chunk follows this process:
1. **Implement** the changes (small scope, clear instructions)
2. **Test** — run `npm run typecheck` and `npm run build` (must pass)
3. **Designer review** — dispatch designer to visually verify the result
4. **Commit** — only after designer approves

### Tier 1 — Zen Surfaces (4 chunks)

#### Chunk 1: WriteZone — apply .panel + .seg + .well

**Scope:** `src/components/admin/WriteZone.tsx` only

**Goal:** Replace raw `border border-line bg-bg` with `.panel` class; use `.seg`/`.seg-on` for composer type tabs; use `.well` for stream moments list

**Instructions:**
1. WriteZone outer wrapper (line ~152): already has `panel` class — verify it renders correctly
2. Composer type tabs (line ~160-165): replace `bg-raise text-ink` active state with `.seg-on` class; wrap tabs in `.seg` container
3. Reflection section header: use `.card-hd` + `.card-lbl` pattern
4. Stream moments list (line ~423): replace `border border-line bg-bg` with `.well` class
5. Replace hardcoded `text-[11px]` → use `text-2xs` token

**Testing gates:**
```bash
npm run typecheck  # 0 errors
npm run build      # succeeds
```

**Designer review gate:**
- Open zen → day tab → WriteZone
- Verify: composer tabs look like segmented control (inset well + raised active)
- Verify: reflection section has proper header treatment
- Verify: stream moments list has inset well background
- Verify: overall feel is calmer, softer corners
- **Designer approves visual before committing**

**Commit:** `feat(zen): WriteZone applies .panel + .seg + .well material`

---

#### Chunk 2: CheckInBand — apply .panel + .capsule

**Scope:** `src/components/admin/CheckInBand.tsx` only

**Goal:** Replace raw borders with `.panel`; mood chips use `.capsule`

**Instructions:**
1. Outer wrapper: add `panel` class (remove `border border-line bg-bg`)
2. Mood pills (line ~130-140): replace raw styling with `.capsule` class
3. Screen-time strip: use `.well` for nested rows
4. Section headers: use `.card-hd` + `.card-lbl`
5. Replace `text-[10px]`/`text-[11px]` → `text-3xs`/`text-2xs`

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open zen → day tab → CheckInBand
- Verify: mood pills look like capsules (rounded-full, accent-tint, hairline border)
- Verify: screen-time rows have inset well background
- Verify: section headers use card-hd treatment
- Verify: overall panel has soft corners + subtle blur
- **Designer approves visual before committing**

**Commit:** `feat(zen): CheckInBand applies .panel + .capsule material`

---

#### Chunk 3: NotificationDrawer — apply .panel + muted badge

**Scope:** `src/components/admin/NotificationDrawer.tsx` only

**Goal:** Replace raw `border border-line bg-panel` with `.panel`; mute the badge

**Instructions:**
1. Drawer container (line ~66): replace `border border-line bg-panel shadow-2xl` with `panel` class
2. Section headers (line ~67, 73, 119): use `.card-hd` + `.card-lbl`
3. Notification badge: ensure it's muted gray (not accent color)
4. Replace `text-[11px]` → `text-2xs`

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open zen → day tab → scroll to bottom → notification drawer
- Verify: drawer has panel material (soft corners, blur, shadow)
- Verify: badge is muted gray
- Verify: section headers use card-hd treatment
- **Designer approves visual before committing**

**Commit:** `feat(zen): NotificationDrawer applies .panel material`

---

#### Chunk 4: DayWorkspace — rhythm + zero-state neutrality

**Scope:** `src/components/admin/tabs/DayWorkspace.tsx` only

**Goal:** Ensure `space-y-4` rhythm; footer zero values render neutral (not green)

**Instructions:**
1. Verify outer wrapper uses `space-y-4` or `space-y-6` (already done in commit)
2. Footer (line ~940-950): verify zero values render `text-soft` (not `text-up`) — already done in commit
3. Date shown once in header (already done in commit)
4. Delete day at bottom (already done in commit)
5. Remove any remaining `CeremonyDim` references (already done in commit)

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open zen → day tab
- Verify: vertical rhythm is calm (not cramped)
- Verify: footer zero values are neutral gray (not green)
- Verify: date appears once in header
- Verify: delete day button is at bottom
- **Designer approves visual before committing**

**Commit:** `feat(zen): DayWorkspace rhythm + zero-state neutrality verified`

---

### Tier 2 — Public Pages (3 chunks)

#### Chunk 5: ThoughtCard + DayFacts — apply .panel

**Scope:** `src/components/stream/ThoughtCard.astro`, `src/components/stream/DayFacts.astro`

**Goal:** Replace `border border-line bg-panel` with `.panel` class for consistent material

**Instructions:**
1. ThoughtCard (line ~33): replace `border border-line bg-panel ${cls}` with `panel ${cls}`
2. DayFacts (line ~28): replace `bg-panel` with `panel` class
3. Verify both render with soft corners + blur + shadow + fade-up entrance

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open `/stream` page
- Verify: thought cards have soft corners + subtle blur + shadow
- Verify: cards fade up on page load (staggered entrance)
- Open `/day/<date>` page
- Verify: day facts strip has panel material
- **Designer approves visual before committing**

**Commit:** `feat(public): ThoughtCard + DayFacts apply .panel material`

---

#### Chunk 6: DayArchive — apply .panel + .capsule

**Scope:** `src/components/archive/DayArchive.astro`

**Goal:** Replace `bg-panel/50` and `bg-panel` with `.panel` class; use `.capsule` for chips

**Instructions:**
1. News block (line ~188): replace `border border-line bg-panel/50` with `panel`
2. Brief block (line ~200): replace `border border-line bg-panel/50` with `panel`
3. Reflection block (line ~209): replace `border border-accent bg-panel` with `panel` (keep accent border if intentional)
4. Habit chips: replace raw styling with `.capsule` class
5. Replace `text-[10px]`/`text-[11px]` → `text-3xs`/`text-2xs`

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open `/day/<date>` page
- Verify: news/brief/reflection blocks have panel material
- Verify: habit chips look like capsules
- Verify: consistent soft corners across all blocks
- **Designer approves visual before committing**

**Commit:** `feat(public): DayArchive applies .panel + .capsule material`

---

#### Chunk 7: Public pages — consistent .panel usage

**Scope:** `src/pages/calendar.astro`, `src/pages/about.astro`, `src/pages/performance.astro`, `src/pages/journal/index.astro`

**Goal:** Ensure all card-like surfaces use `.panel` class (not `bg-panel` directly)

**Instructions:**
1. Search for `bg-panel` usage in these files
2. Replace `border border-line bg-panel` or `bg-panel` with `panel` class
3. Verify consistent material treatment across all public pages

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open `/calendar`, `/about`, `/performance`, `/journal`
- Verify: all card surfaces have consistent soft corners + blur + shadow
- Verify: fade-up entrance animation on all panels
- **Designer approves visual before committing**

**Commit:** `feat(public): consistent .panel usage across public pages`

---

### Tier 3 — Micro-Polish (4 chunks)

#### Chunk 8: Text size token cleanup — admin

**Scope:** `src/components/admin/*.tsx` — replace hardcoded `text-[10px]`/`text-[11px]`/`text-[12px]` with tokens

**Goal:** Use `text-3xs` (10px), `text-2xs` (11px), `text-xs` (12px) tokens

**Instructions:**
1. Search for `text-[10px]` → replace with `text-3xs`
2. Search for `text-[11px]` → replace with `text-2xs`
3. Search for `text-[12px]` → replace with `text-xs`
4. Focus on WriteZone, CheckInBand, DayWorkspace, NotificationDrawer first

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open zen → day tab
- Verify: text sizes look consistent (no visual change expected — tokens map to same sizes)
- Verify: no layout shifts
- **Designer approves visual before committing**

**Commit:** `chore(zen): text size tokens replace hardcoded pixels`

---

#### Chunk 9: Text size token cleanup — public

**Scope:** `src/components/archive/*.astro`, `src/components/stream/*.astro`, `src/pages/*.astro`

**Goal:** Replace hardcoded text sizes with tokens

**Instructions:**
1. Search for `text-[10px]`/`text-[11px]`/`text-[12px]` in public components
2. Replace with `text-3xs`/`text-2xs`/`text-xs`
3. Verify no visual regression

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:**
- Open `/stream`, `/day/<date>`, `/calendar`, `/performance`
- Verify: text sizes consistent (no visual change expected)
- Verify: no layout shifts
- **Designer approves visual before committing**

**Commit:** `chore(public): text size tokens replace hardcoded pixels`

---

#### Chunk 10: Dead code cleanup

**Scope:** Remove orphaned `CeremonyMode.tsx`

**Goal:** Delete dead code

**Instructions:**
1. Delete `src/components/admin/CeremonyMode.tsx`
2. Verify no imports remain (already confirmed zero imports)

**Testing gates:**
```bash
npm run typecheck
npm run build
```

**Designer review gate:** None (no visual change)

**Commit:** `chore: remove orphaned CeremonyMode`

---

#### Chunk 11: Final verification + deploy

**Scope:** Full test suite + deploy to preprod

**Goal:** Verify everything works end-to-end

**Instructions:**
1. Run full test suite: `node --import tsx --test "tests/**/*.test.ts"`
2. Run typecheck: `npm run typecheck`
3. Run build: `npm run build`
4. Deploy to preprod: `bash scripts/deploy-test.sh`
5. Verify live on test.1ed.ge
6. Owner reviews on test → then sync to prod

**Testing gates:**
```bash
node --import tsx --test "tests/**/*.test.ts"  # all pass
npm run typecheck                                # 0 errors
npm run build                                    # succeeds
bash scripts/deploy-test.sh                      # deploy succeeds
bash scripts/verify-env.sh test                  # verify live
```

**Designer review gate:**
- Full walkthrough of zen day surface + public pages on test.1ed.ge
- Verify: calm, inviting, soft corners, subtle blur, fade-up animations
- Verify: consistent material language across all surfaces
- **Owner approves before syncing to prod**

**Commit:** `chore: design system foundation complete — deploy to preprod`

---

## Execution Order

1. **Start with Tier 1** (zen surfaces) — the owner lives here, highest priority
2. **Then Tier 2** (public pages) — minimal polish
3. **Then Tier 3** (micro-polish) — consistency cleanup
4. **Final deploy** — only after all chunks pass + owner approves

## Testing Process

Each chunk follows this process:
1. **Implement** — make the changes (small scope)
2. **Test** — run `npm run typecheck` and `npm run build` (must pass)
3. **Designer review** — dispatch designer to visually verify the result
4. **Commit** — only after designer approves

The designer should:
- Open the relevant page(s) in a browser
- Verify the visual result matches the reference aesthetic
- Check for consistency with other surfaces
- Approve or request changes

## Owner Review

After all 11 chunks are complete:
- Deploy to preprod (test.1ed.ge)
- Owner reviews the full zen day surface + public pages
- Owner approves before syncing to prod

## Estimated Effort

- **Tier 1 (4 chunks):** ~1 hour of focused work + designer review time
- **Tier 2 (3 chunks):** ~45 minutes + designer review time
- **Tier 3 (4 chunks):** ~30 minutes + designer review time
- **Total:** ~2-3 hours of focused work + designer review time

## Success Criteria

After all 11 chunks are complete:
- ✅ All surfaces use `.panel` class (consistent material)
- ✅ All text sizes use tokens (no hardcoded pixels)
- ✅ Zen day surface feels calm, inviting, soft
- ✅ Public pages match the zen aesthetic
- ✅ Fade-up animations on all panels
- ✅ Soft corners (10px radius) everywhere
- ✅ Subtle blur on cards
- ✅ Consistent color hierarchy
- ✅ Owner approves the result

---

## Notes for the Next Agent

- **Read the reference** (`/opt/whatsapp-logger-v2/templates/dashboard.html`) before starting
- **Read the spec** (`docs/superpowers/specs/2026-08-10-hue-swappable-design-system.md`) for the token architecture
- **Follow the chunked plan** — don't try to do everything at once
- **Test after each chunk** — typecheck + build must pass
- **Get designer review** — visual verification before committing
- **Respect owner constraints** — they are non-negotiable
- **Subtle, muted, minimal** — less is more

Good luck!
