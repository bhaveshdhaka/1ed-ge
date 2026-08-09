# /zen Radical Simplification + Terminology Sweep — Design

> **Date:** 2026-08-09
> **Status:** Owner-approved ("just do this all now")
> **Predecessor:** Audit report (40 findings across bugs, UI/UX, testing, design)

## The essence

The /zen day workspace is cluttered (~30 zones, ~70 buttons, stats triplicated, terminology inconsistent). The owner wants a calm, inviting daily surface where they spend all their time. Three sections, zero redundant chrome, one design language.

## 1. Terminology sweep: "moments" → "thoughts" (everywhere)

Every occurrence of "moment" in user-facing strings, internal types, function names, component names, schema fields, and comments becomes "thought" (or "thoughts").

| Current | New |
|---------|-----|
| `MomentType` | `ThoughtType` |
| `StreamMoment` | `StreamThought` |
| `ResolvedMoment` | `ResolvedThought` |
| `resolveMoments()` | `resolveThoughts()` |
| `flattenStream()` | stays (flattens thoughts) |
| `momentMeta()` | `thoughtMeta()` |
| `MomentCard.astro` | `ThoughtCard.astro` |
| `MomentForm` (admin) | `ThoughtForm` |
| `draftMoments` | `draftThoughts` |
| `momentPayload()` | `thoughtPayload()` |
| `publishMoment()` | `publishThought()` |
| `unstreamMoment()` | `unstreamThought()` |
| `onMomentImages()` | `onThoughtImages()` |
| `onReorderDraft/Stream` | stays (operates on thoughts) |
| `sec-moments` | `sec-thoughts` |
| "published moments" (public) | "published thoughts" |
| "/ moments" (section header) | "/ thoughts" |
| "draft moments" (admin) | "draft thoughts" |
| "live moments" (admin) | "live thoughts" |
| "USD NEWS (HKT)" in brief | "News events (HKT)" |

**Files touched:** ~25 (stream.ts, MomentCard.astro, DayArchive.astro, stream.astro, PeriodReview.astro, ThoughtsSurface.tsx, DayWorkspace.tsx, CommandPalette.tsx, days.ts API, content.config.ts, brief.ts)

## 2. /zen radical simplification — 3 sections, zero redundant chrome

### Current layout (5 zones, ~30 sub-zones, ~70 buttons)

```
sticky section-jump nav (5 buttons)
header row (view live, preview, delete, date input)
DayRail sidebar
  MarketCard (duplicates public widget)
  CheckInBand capture zone (text + images + build button)
  CheckInBand day facts (mood 5 buttons, sleep 5 buttons + input, screen-time)
  CheckInBand readouts (R, habits) ← DUPLICATE #1
import trades button (orphan)
ThoughtsSurface composer (textarea + 3 type buttons + author field)
ThoughtsSurface draft moments (per-item: type select, text, author, images, 4 buttons)
ThoughtsSurface live moments (per-item: drag handle, remove button)
HabitRow (N chips + library button)
trades header (expand all, add trade)
TradeCard (collapsed: direction, market, setup, models, R, pts, accounts, screenshot, ×, drag)
TradeCard expanded (~15 inputs, executions, images, publish)
ReflectionZone (editor + AI draft + publish)
footer stats bar ← DUPLICATE #2
StatusLine ← DUPLICATE #3
```

### New layout (3 sections, one stats line)

```
┌──────────────────────────────────────┐
│  / day · 09-aug-2026                 │  ← ONE header (date + status)
│  [view live →]  [⌘K]                │  ← minimal actions
├──────────────────────────────────────┤
│  ☀️ mood: [😌 calm] [😊 good] […]   │  ← compact inline chips
│  🌙 sleep: [7.5h] [😴 rested] […]   │  ← compact inline
│  📱 screen: iphone 5.2h · social …   │  ← one line
│  ✅ habits: [quiet-time] [read] …    │  ← inline chips
├──────────────────────────────────────┤
│  what happened? ──────────────────   │  ← THE composer
│  ┌──────────────────────────────┐    │
│  │ write a thought…       ⌘⏎   │    │  ← single textarea
│  └──────────────────────────────┘    │
│  [thought] [quote] [trade]           │  ← compact type toggle
│                                      │
│  ● live thoughts (3)                 │  ← published stream
│  ┌─ thought ─────────────────────┐   │
│  │ 08:30 · news tonight — flat…  │   │
│  └───────────────────────────────┘   │
│  ┌─ trade ───────────────────────┐   │
│  │ 09:15 · ▲ MNQ · ORB · +0.82R │   │
│  └───────────────────────────────┘   │
│                                      │
│  trades (2)  [import ▸]              │  ← collapsible
│  ┌─ ▲ MNQ · ORB · +0.82R ────────┐  │
│  │ [expanded on click]            │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  reflection ───────────────────────  │
│  ┌──────────────────────────────┐    │
│  │ write your reflection…       │    │
│  │                    [publish] │    │
│  └──────────────────────────────┘    │
├──────────────────────────────────────┤
│  day · +0.82R · 2 trades · 4/6 habits · autosaves on idle  │  ← ONE footer
└──────────────────────────────────────┘
```

### Specific changes

1. **Remove sticky section-jump nav** — natural scroll is enough
2. **Remove MarketCard from admin** — public widget is sufficient
3. **Remove "preview →" from header** — CommandPalette has it
4. **Remove "delete day" from header** — move to a less prominent spot or keep in header but smaller
5. **Remove orphan "import trades" button** — integrate into trades section header
6. **Consolidate stats to ONE line** — remove CheckInBand readouts + StatusLine, keep only the footer bar
7. **Remove "⌘⏎ publish" hint from StatusLine and TradeCard** — keep only in composer
8. **Simplify mood/sleep pickers** — compact inline word+emoji chips, not 10 separate buttons
9. **Simplify HabitRow** — remove ± buttons for count habits (or make them appear on hover)
10. **Make habit "library ▸" navigate to library tab** — not just a toast
11. **Unify Card component** — use `<Card>` everywhere, not mixed with raw `<div className="panel">`
12. **Unify Button component** — use `<Button>` everywhere, not mixed with raw `<button>`
13. **Replace passive empty states with active CTAs** — "write your first thought →" not "nothing yet"
14. **Remove dead ReflectionZone props** — title/summary/tags inputs are gone (already removed from render but props still passed)

## 3. Public page polish

1. **models.astro h1** → "/ models" (add `/` prefix)
2. **DayArchive.astro h1** → `text-2xl` (not `text-[13px]`)
3. **Unify empty states** → use `<EmptyState>` component everywhere
4. **Add sticky section nav to DayArchive** (8+ sections, needs jump nav like /performance)

## 4. Verification

- `npm run typecheck` — 0 errors, 0 warnings
- `node --import tsx --test "tests/**/*.test.ts"` — all pass
- `npm run build` — succeeds
- Live curl: post a thought, verify it appears on / and /stream within 1s
- Verify all 4 card frames (thought, quote, trade, reflection) render correctly
- Deploy preprod → verify → sync to prod → verify