# Stream Card Identity + Writing Surface Simplification — Design

> **Date:** 2026-08-09
> **Status:** Owner-approved ("Ok this and all the bugs. Go at it.")
> **Predecessor:** `docs/superpowers/plans/2026-08-09-zen-day-surface.md` (15-task day-surface rebuild)

## The essence

Everything the owner posts is a **text note**. A thought is a line. A quote is a line +
who said it. A reflection is a longer note. A trade is a note with numbers. No metadata
ceremony, no title/summary/tags, just the text. On the stream, the card's **frame** tells
the type before you read a word.

## 1. Stream card identity system — distinct frames per type

Each published moment type gets a visually distinct card frame. Same design language,
different outline. Rendered in `src/components/stream/MomentCard.astro` (thought/quote/trade)
and the reflection card (DayArchive / stream reflection entries).

| Type | Frame | Body |
|------|-------|------|
| **thought** (`note`) | `border-line`, 1px hairline — quiet, nothing more | the text |
| **quote** | `border-line` + left 2px accent rail + `"…"` | the quote + `— author` line below |
| **trade** | `border-line` + left 2px rail colored by outcome (up-green ▲ / down-red ▼) | market · setup · models · R right-aligned |
| **reflection** | full `border-accent` frame (heavier — the formal one) | the reflection text |

Card header (`HH:MM hkt · TYPE`) stays. The frame is the additional at-a-glance signal.

## 2. Reflection zone — title/summary/tags totally gone

`src/components/admin/ReflectionZone.tsx`: remove the title/summary/tags `Field` inputs
entirely. The zone is just the editor + `publish ⌘⏎`. The AI still *derives* title/summary/
tags for the journal file; the owner never sees or types them.

Files: `ReflectionZone.tsx` (remove 3 fields), `DayWorkspace.tsx` (drop the state wiring
for title/summary/tags — keep the state so the derived values still save on publish).

## 3. Quote composer — inline author field

`src/components/admin/ThoughtsSurface.tsx` composer: when the type toggle is `quote`, an
inline author field appears in the composer footer so ⌘⏎ includes it. Fixes the
lost-author bug (DayWorkspace.tsx:311 creates moments with `author: ''`).

## 4. Habit reorder — dnd-kit sortable in the library

`src/components/admin/tabs/LibraryTab.tsx`: replace the numeric "order" input with
dnd-kit drag-reorder on the habit rows (same `SortableContext` + `useSortable` pattern
used in TradeCard/ThoughtsSurface from Task 15). Drag updates `order`; the API already
persists it.

## 5. Queued bugs (from the earlier consolidated list, in scope)

- 1: publish latency (cache headers + immediate save) — **done** (a0b7347)
- 2: today empty state — **done** (9f471f8)
- 3: mood/sleep word+emoji pickers — **done** (15bb3b9) + always-visible (2e6094c)
- 4: money-color sign-aware — **done** (7c496f1)
- 5: tablet gap — **done** (a87d758)
- 8: dead CSS — **done** (022a4bb)
- 10: lighthouserc — **done** (9a75246)
- 11: rebuild mutex — **done** (d9d4a35)
- 12: quote font — **done** (ef18ec0)
- 13: timestamp default — **done** (e4e9b58)

All shipped to preprod + prod except `2e6094c` (mood/sleep always-visible) which is on
preprod only — the owner stopped the ship after that commit. This design's execution
will carry it along with the new work.

## Verification

- `npm run typecheck` — 0 errors, 0 warnings
- `node --import tsx --test "tests/**/*.test.ts"` — 189/189
- `npm run build` — succeeds
- Live curl: publish a thought + a quote + a trade, verify distinct frames on /stream and /day
- Deploy preprod → verify → sync to prod → verify
