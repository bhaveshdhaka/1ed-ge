# /zen Radical Simplification + Terminology Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix everything in one go: rename "moments" → "thoughts" everywhere, radically simplify the /zen day workspace (3 sections, zero redundant chrome, one design language), polish public page inconsistencies, sync to prod, verify live.

**Architecture:** Three parallel lanes (terminology sweep, /zen simplification, public polish) followed by sync+deploy. Lanes touch mostly disjoint files so they can run in parallel.

**Tech Stack:** Astro 5, Tailwind CSS v4, TypeScript, React (admin only)

## Global Constraints

- Public pages must stay zero-JS (except the shared `<dialog>` lightbox)
- All design tokens from `src/styles/app.css` — no new CSS, no custom components
- Muted emojis (`opacity-60` / `text-faint`), label is primary
- One `<Card>` component, one `<Button>` component — no mixed patterns
- Active empty states with visible CTAs, not passive "nothing here" text
- Every change must pass `npm run typecheck` (0 errors) and `node --import tsx --test "tests/**/*.test.ts"` (all pass)
- Work on preprod branch first, then sync to prod

---

### Lane A: Terminology Sweep — "moments" → "thoughts"

**Files:** ~25 files, ~80 occurrences

#### Task A1: Rename core types and functions in stream.ts

**Files:**
- Modify: `src/lib/stream.ts`

**Changes:**
- `MomentType` → `ThoughtType`
- `StreamMoment` → `StreamThought`
- `ResolvedMoment` → `ResolvedThought`
- `resolveMoments()` → `resolveThoughts()`
- `momentMeta()` → `thoughtMeta()`
- `MomentMeta` → `ThoughtMeta`
- All comments and internal references

#### Task A2: Rename MomentCard.astro → ThoughtCard.astro

**Files:**
- Rename: `src/components/stream/MomentCard.astro` → `src/components/stream/ThoughtCard.astro`
- Modify: all files that import MomentCard

**Imports to update:**
- `src/pages/index.astro`
- `src/pages/stream.astro`
- `src/pages/day/[date].astro`
- `src/components/archive/DayArchive.astro`
- `src/components/period/PeriodReview.astro`

#### Task A3: Update public page copy

**Files:**
- Modify: `src/pages/stream.astro` — "published moments" → "published thoughts", "moments yet" → "thoughts yet"
- Modify: `src/components/archive/DayArchive.astro` — "/ moments" → "/ thoughts"
- Modify: `src/components/period/PeriodReview.astro` — "/ stream moments" → "/ stream thoughts"
- Modify: `src/lib/brief.ts` — "USD NEWS (HKT)" → "News events (HKT)"

#### Task A4: Update admin components

**Files:**
- Modify: `src/components/admin/ThoughtsSurface.tsx` — "draft moments" → "draft thoughts", "live moments" → "live thoughts", "new moment" → "new thought", `sec-moments` → `sec-thoughts`
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — `MomentForm` → `ThoughtForm`, `draftMoments` → `draftThoughts`, `momentPayload` → `thoughtPayload`, `publishMoment` → `publishThought`, `unstreamMoment` → `unstreamThought`, `onMomentImages` → `onThoughtImages`, `toMomentForm` → `toThoughtForm`, section jump "moments" → "thoughts"
- Modify: `src/components/admin/CommandPalette.tsx` — `sec-moments` → `sec-thoughts`

#### Task A5: Update API and schema

**Files:**
- Modify: `src/pages/api/admin/days.ts` — schema field references
- Modify: `src/content.config.ts` — schema field references

---

### Lane B: /zen Radical Simplification

**Files:** ~10 files

#### Task B1: Remove sticky section-jump nav

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx:803-816`

Remove the entire sticky section-jump nav div. Natural scrolling is enough.

#### Task B2: Remove MarketCard from admin

**Files:**
- Modify: `src/components/admin/CheckInBand.tsx:58`

Remove the `<MarketCard />` line. The public widget is sufficient.

#### Task B3: Remove "preview →" from header

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx:836-838`

Remove the preview link. CommandPalette has it.

#### Task B4: Move "import trades" into trades section header

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx:900-906`

Move the import button from its orphan position into the trades section header (next to "expand all" and "+ add trade").

#### Task B5: Consolidate stats to ONE footer line

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx:1015-1024` (footer bar — keep this one)
- Modify: `src/components/admin/CheckInBand.tsx:185-188` (remove readouts)
- Modify: `src/components/admin/StatusLine.tsx` (remove entire component or simplify to just the date line)
- Modify: `src/components/admin/tabs/DayWorkspace.tsx:1030-1038` (remove StatusLine usage)

Keep only the footer bar at the bottom of DayWorkspace. Remove CheckInBand readouts and StatusLine.

#### Task B6: Simplify mood/sleep pickers

**Files:**
- Modify: `src/components/admin/CheckInBand.tsx:110-137`

Make mood and sleep pickers more compact. Instead of 5+5 separate button elements, use a single inline flex row with smaller chips. Keep the word+emoji pattern but reduce visual weight.

#### Task B7: Simplify HabitRow

**Files:**
- Modify: `src/components/admin/HabitRow.tsx`

Remove ± buttons for count habits (or make them appear on hover only). Make "library ▸" actually navigate to the library tab (emit a bus event or call a callback).

#### Task B8: Replace passive empty states with active CTAs

**Files:**
- Modify: `src/components/admin/ThoughtsSurface.tsx:315-317` — "nothing on the stream yet" → "write your first thought →" with a button
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — trades empty state
- Modify: `src/components/admin/CheckInBand.tsx:69-71` — "the day starts here" → active CTA

#### Task B9: Remove dead ReflectionZone props

**Files:**
- Modify: `src/components/admin/ReflectionZone.tsx` — remove title/summary/tags/featuredImage props and their UI
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — stop passing those props

#### Task B10: Unify Card and Button usage

**Files:**
- Modify: `src/components/admin/CheckInBand.tsx` — use `<Card>` consistently
- Modify: `src/components/admin/ThoughtsSurface.tsx` — use `<Card>` consistently
- Modify: `src/components/admin/ReflectionZone.tsx` — use `<Card>` consistently
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` — use `<Button>` consistently

---

### Lane C: Public Page Polish

**Files:** ~6 files

#### Task C1: Fix models.astro h1

**Files:**
- Modify: `src/pages/models.astro:24`

Change `text-ink` to include `/` prefix: `/ models` with `text-2xl` to match other subpages.

#### Task C2: Fix DayArchive h1

**Files:**
- Modify: `src/components/archive/DayArchive.astro:89`

Change `text-[13px]` to `text-2xl` to match other subpage headers.

#### Task C3: Unify empty states

**Files:**
- Modify: `src/pages/stream.astro` — use `<EmptyState>` component
- Modify: `src/pages/coach.astro` — use `<EmptyState>` component
- Modify: `src/components/archive/DayArchive.astro` — use `<EmptyState>` component consistently
- Modify: `src/pages/calendar.astro` — use `<EmptyState>` component

#### Task C4: Add sticky section nav to DayArchive

**Files:**
- Modify: `src/components/archive/DayArchive.astro`

Add a sticky section-jump nav (matching /performance pattern) for the 8+ sections: facts, trades, news, brief, reflection, thoughts, habits, screen-time, coach.

---

### Lane D: Sync to Prod + Verify

#### Task D1: Typecheck + tests + build

Run on preprod:
- `npm run typecheck` — 0 errors
- `node --import tsx --test "tests/**/*.test.ts"` — all pass
- `npm run build` — succeeds

#### Task D2: End-to-end test on preprod

- Write a test day file with a thought, a quote, a trade, a reflection
- Curl `https://test.1ed.ge/` and verify it appears within 1s
- Verify all 4 card frames render correctly on /stream and /day
- Delete the test file

#### Task D3: Sync to prod

```bash
cd /root/1ed.ge
bash scripts/sync-to-prod.sh -y
```

#### Task D4: Deploy prod

```bash
bash scripts/deploy-prod.sh
```

#### Task D5: Verify live

```bash
bash scripts/verify-env.sh prod
curl -sL --resolve 1ed.ge:443:104.21.7.179 https://1ed.ge/ | head -50
```