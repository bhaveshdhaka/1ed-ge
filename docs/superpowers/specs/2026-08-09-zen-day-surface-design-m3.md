# THE ZEN DAY SURFACE — FINAL INTEGRATED DESIGN (m3)

**Date:** 2026-08-09 · **Status:** design, awaiting owner approval
**Scope:** the `/zen` "day" tab (`DayWorkspace.tsx`) rebuilt on the planned admin
batch (cmdk ⌘K, @dnd-kit, TanStack Table v9, sonner, shadcn-style recipes).
**Companion to:** `2026-08-09-zen-day-surface-design.md` (flash pass). This is a
parallel opinionated pass; the two should be compared.
**Out of scope:** react-colorful / emoji picker (library-tab recipes, not this
surface). AI ghost-text writing assist **is** in scope (§6).

---

## 0 · The thesis

The day surface is a **single instrument you live in, not a stack of panels you
visit.** One column. One typeface. One radius. Hairlines, not cards. Five zones
flow top-to-bottom in the order the day itself moves: check the day, think out
loud, tick the habits, log the trades, then — only at the end — sit with the
reflection. Every other surface is *invoked, never persistent*: ⌘K absorbs the
jump bar, three Sheets cover capture/ingest/day-picker, dnd handles appear only
while dragging, sonner replaces the toast. The reflection zone is **the** zone —
it carries the obligation as a ring on its frame, not a nagging banner; when the
owner focuses the editor, the rest of the page dims into ceremony. Thoughts are
the opposite: a single growing textarea that publishes on blur, because the
entire point of a thought is that it shouldn't require a gesture. The trade
card is the place the multi-model reality lives — chips with a *primary* (the
first tag, the heaviest), premise tooltips, quick-add, `+N` overflow. Color is
data and state, never decoration. Motion is the caret, the due-pulse, and a
60ms fade — and nothing else. Everything in this design exists to make the
owner's eyes return to the thing they were writing.

---

## 1 · The integrated shell

### 1.1 The layout (the only chrome in the world)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ header  [1edge_ zen]   [overview][day][accounts][coach][media][library]   │
│                        [reviews]                  [⌘K  ▸]                 │
├──────────────────────────────────────────────────────────────────────────┤
│ RebuildBar  ● published · last rebuilt 22:38                    ▸        │
│             (or: ● 2 draft changes — not published    [rebuild to publish])│
├──┬───────────────────────────────────────────────────────────────────────┤
│  │  2026-08-09 fri · 08:xx hkt · market ● open · closes in 3h 12m        │
│  │  ──────────────────────────────────────────────────────────────────── │
│R │  Z1  check-in  ·  mood 4/5 · sleep 7.2h · screen 5.1h · mac 3.2h ·    │
│A │       habits 4/6 · +0.82R              [evidence ▸] [capture ▸]       │
│I │  ──────────────────────────────────────────────────────────────────── │
│L │  Z2  thoughts  ·  3 live · 1 draft                                    │
│  │       ┌────────────────────────────────────────────────────────────┐  │
│  │       │ what happened — ⌘⏎ publishes, blur auto-publishes          │  │
│  │       └────────────────────────────────────────────────────────────┘  │
│  │       08:12 · note   "what the tape did at the open…"            ⠿ ×  │
│  │       07:58 · ▲ trade 1 · orb-drive · +1.25R                  ⠿ ×  │
│  │  ──────────────────────────────────────────────────────────────────── │
│  │  Z3  habits · [quiet-time ✓][read 30][no-scroll][meditate ✓]         │
│  │  ──────────────────────────────────────────────────────────────────── │
│  │  Z4  trades (3) · +0.82R                          + trade            │
│  │       ▸ ▲ MNQ  [orb-drive ⌗][vwap-reclaim]+1  ny-am   +1.25R  ⠿      │
│  │       ▸ ▼ MNQ  [orb-drive ⌗]                  ny-am   −0.80R  ⠿      │
│  │  ──────────────────────────────────────────────────────────────────── │
│  │  Z5  reflection · the end-of-day ritual        ⌗ due in 4h 22m        │
│  │       title [……]  summary [……]  tags [……]                             │
│  │       ┌────────────────────────────────────────────────────────────┐  │
│  │       │ the day in prose. 15px / 1.8. the one calm surface.        │  │
│  │       │                                                            │  │
│  │       └────────────────────────────────────────────────────────────┘  │
│  │       [AI draft from today]   publish reflection  ⌘⏎                 │
├──┴───────────────────────────────────────────────────────────────────────┤
│ statusline   2026-08-09 · +0.82R · 3t · habits 4/6 · saved 22:41          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Persistent chrome is exactly six things:** the header tabs, the RebuildBar,
the 44px day rail, the five zones (divided by hairlines on a flat `bg`), the
statusline, and the ⌘K trigger button. That's it. No cards. No panels. The
`panel` token is reserved for the three Sheets, the ⌘K palette, and the
reflection frame — the only places that *raise* above the page. **The page
itself is flat** (the only surface that breathes is the one being written on).

**Where the current code lives (current → new):**

| today (`DayWorkspace.tsx` / `AdminApp.tsx`) | becomes |
|---|---|
| sticky section-jump bar (lines 701–715) | ⌘K palette, "jump" group |
| 210px aside: mini-calendar + recent days (lines 748–800) | **44px day rail** (`DayRail`, time axis with a `now` marker) + `DayPickerSheet` |
| capture card (lines 807–837) | `AIBuildSheet` (invoked) |
| `IngestPanel` inline (line 840) | `IngestSheet` (invoked) |
| header `save` / `save & rebuild` (lines 740–742) | **gone** — autosave + RebuildBar + sonner |
| footer save buttons (lines 1234–1237) | **gone** — same |
| custom bottom-center toast (AdminApp 195–202) | sonner, top-right |
| `?` help modal (AdminApp 204–226) | ⌘K "shortcuts" row + footer Kbd hints |
| header date input (line 740) | ⌘K `open day…` / `DayPickerSheet` |
| `zenLine` pending banner (AdminApp 173–181) | **gone** — folded into the **Z5 obligation ring** (§5) |
| day status dot `● published/unsaved` (lines 720–726) | `· saved HH:MM` in StatusLine + RebuildBar state |
| `MarketCard` (line 746) | stays as a one-line market strip above Z1 (ambient, collapses to a single line) |
| `editing` for mood/sleep (lines 849–887) | **same affordance** (dashed-underline, direct-click) — but inline in the band, not in a card |
| reflection card's `● published to /journal` line (lines 1203–1207) | moves into Z5 header as a quiet `up` chip; the card's own block is gone (the whole page is a card) |

### 1.2 The "invoked, never persistent" rule

The rule has teeth: **if a control would sit on the page for more than the
moment it is used, it does not sit on the page.** Five kinds of things qualify
to be persistent (above); every other verb is invoked:

- **above it** — ⌘K (the only floating command; opens over the content with a
  60ms fade and an `accent` focus ring on the first result).
- **beside it** — the three Sheets (`AIBuildSheet`, `IngestSheet`,
  `DayPickerSheet`) anchor to the right edge (420px wide), `panel`-raised, with
  a hairline left border. They appear, you do what you came for, they close.
- **in it, only while used** — dnd ⠿ handles appear on hover/focus of a list
  row and vanish when the pointer leaves; model chip `×` and the `+ add model`
  popover trigger appear on hover of the chip row; editable-value dashed
  underlines appear on hover of the value; the obligation ring on Z5 only
  *pulses* when past grace (in grace, the chip is plain `warn` text).
- **never anywhere** — Sidebar recipe, DropdownMenu, right-click menus, floating
  toolbars, a "save" button. The owner's writing is the surface; chrome that
  doesn't serve writing has no business being on the page.

### 1.3 The 44px day rail (`DayRail`) — a time axis with a `now` marker

A single vertical strip, 44px wide, on the left of the day column (desktop +
tablet, ≥768px). It is **not a list of days** — it is a **time scroll**: each
square is a day positioned on a vertical axis where distance = time. Today's
cell is always pinned; the user scrolls the rail to move through history. The
**`now` marker** is a 1px `accent` horizontal line that crosses the rail at the
current HKT minute (it moves every minute; rendered server-side, hydrated on
mount, ticked client-side — the only time-aware element on the page).

**Cell states (one cell per logged day):**

- **no record** — not shown. Empty days are gaps in the rail; the rail is the
  truth of *what happened*, not the calendar.
- **record, no trades** — faint 8px square (`line` fill)
- **trades** — square height 8→16px with trade count; fill `up` when ΣR ≥ 0,
  `down` when ΣR < 0 (color discipline, §4.3)
- **today** — 1px `accent` ring; the cell is *always* the one straddling the
  `now` marker (today IS now, conceptually)
- **selected** — `raise` fill + 1px `accent` left border
- **hover** — 1px `accent` border + a left-side tooltip:
  `08-aug · +1.42R · 4t · 3 published`
- **pending reflection** (Z5 obligation due or overdue) — a 2px `down` bar on
  the right edge of the cell; the rail becomes the *ambient* signal of
  obligation state (the *primary* signal is the Z5 ring, §5)

**Navigation:** click = open that day (the existing `selectDate` dirty-guard
becomes a `DayPickerSheet` confirm, not `window.confirm`). ↑↓ move the rail
focus when the rail has focus (it is a `listbox` — `role="listbox"`,
`aria-activedescendant`). The `now` marker is a `div` with
`aria-hidden="true"` — it is decorative, the time is in the header strip.

**Coarse (<768px):** the rail rotates to a horizontal 44px strip under the
header — same cells, one row, horizontally scrollable, today pinned. The `now`
marker becomes a vertical 1px line crossing the strip.

**Why a time axis, not a list:** the day surface is about *where you are in
time*, not *which file you have open*. The `now` marker is the visual proof.
You scroll *back* through the days; the marker is always at the top. Future
days (above `now`) are blocked — you cannot scroll above the marker, only
around it. This is the only place the page is opinionated about time, and it
should be the most visible.

### 1.4 ⌘K — the command palette

`Command` recipe, `panel` on `bg/80` scrim, 2px radius, hairline border — the
palette is a **terminal dialog**, not a glass card. Opens with `⌘K` (and `/`
when not typing). Filter-first fuzzy match, ↑↓ to move, ⏎ to run, esc to
close. The palette is a dialog: focus traps, first result autofocused, ⌘K from
within a writing surface returns focus to that surface on close (a thought's
half-typed line survives — publishing later via ⌘⏎ still targets it).

```
⌘K  go
      today                                ⌘T
      open day…                            (DayPickerSheet)
      previous day                         ⌘←
      next day                             ⌘→
      live stream                          ↪ /day/<fmtDay(today)>
      preview this day                     ↪ /zen/preview/<date>

⌘K  write
      new thought                          (focus Z2 composer, note type)
      new quote                            (focus Z2 composer, quote + author)
      new trade                            (append collapsed TradeCard, focus market)
      polish focused thought               (AI polish on the focused draft)
      add model to focused trade           (open model Popover)

⌘K  build
      build day from evidence              (AIBuildSheet)
      import trades                        (IngestSheet)
      AI draft reflection                  (writes Z5 draft from daySnapshot())
      rebuild to publish                   (only when pending changes exist)

⌘K  jump
      check-in · thoughts · habits · trades · reflection

⌘K  zen
      overview · accounts · coach · media · library · reviews · shortcuts

⌘K  view
      ghost-text: on | off                 (quiet toggle, persists in localStorage)
```

Footer of the palette, always: `{date} · {n} draft change(s) · esc to close`.
Group headers are faint uppercase tracking labels; rows are `name` left, `Kbd`
right. Items that are not currently valid (e.g. `rebuild to publish` with no
pending changes) render dim and are skipped on filter; the row is never hidden
because the user might want to learn the command exists.

### 1.5 Sheets — three, same anatomy

`Sheet` recipe, right side, 420px wide, `panel` + hairline left border, header
(title + close `×`), body, footer with the single primary action. Open/close =
60ms opacity fade (no slide — the motion budget is the one fade, §4.4). Esc
closes; focus returns to the invoking surface. The body of each sheet is the
existing ritual on a different chrome:

- **`AIBuildSheet`** — replaces the capture card. Body: the ephemeral drop zone
  (paste screenshots — read by the AI, never uploaded, unchanged semantics) +
  the free-text field. Action: `build this day →`. While reading: the body
  becomes the progress (`reading everything…`), then the sheet closes and a
  sonner confirms `day built from your evidence — review, override if needed`.
  The structured result lands in the zones exactly as `applyStructured` does
  today.
- **`IngestSheet`** — wraps the existing `IngestPanel` ritual (approve every
  trade). The proposal table is **TanStack Table v9**: columns
  `market · dir · entry→exit · pts · risk pts · R · fills · account (select) ·
  dup badge`, row select, sticky header, tabular-nums. This is the surface's
  first and only table.
- **`DayPickerSheet`** — month grid (existing mini-calendar logic, same 12-week
  window) + recent 14 + jump input. Opened from ⌘K `open day…` or the rail's
  overflow (a tiny `⋯` at the rail's bottom).

### 1.6 Sonner — the terminal toast

Top-right, dark, mono, 2px radius, hairline border, `bg` background, `line2`
border — the terminal's toast, not a pill. Roles:

- **publish confirmations** — `✓ thought published`, `✓ reflection published —
  queued for rebuild`
- **AI results** — `day built from your evidence — review, override if needed`,
  `polished — review it, then publish`
- **errors** — `✗ publish failed — the draft is safe, retry`
- **autosave** — silent (no toast — `· saved HH:MM` in the statusline is the
  only audible feedback)
- **rebuild flash** — `✓ N changes live · view →` (the existing RebuildBar
  flash becomes a sonner action-toast)

`role="status"` / `aria-live="polite"` preserved. The toaster replaces
`notify()` in `DayWorkspace` and the custom toast in `AdminApp`.

### 1.7 Keyboard contract (the whole surface)

| key | action | owner |
|---|---|---|
| ⌘K / `/` | palette | shell |
| ⌘T | today | shell |
| ⌘← / ⌘→ | previous / next day | shell |
| ⌘S | autosave now (flush the 2s debounce) | shell |
| 1…7 | tabs (unchanged) | shell |
| **⌘⏎ / Ctrl+⏎** | **publish the focused writing surface** | per-surface (§3) |
| **blur on thoughts composer** | **auto-publish the thought** (§3) | per-surface |
| Tab | accept ghost-text suggestion (when visible) | per-surface |
| Esc | close topmost: sheet > palette > editing value > ghost-text dismiss | shell |
| ↑↓⏎ | palette/rail navigation | per-widget |
| ⠿ (grab, hover) | dnd reorder | lists |

`isTyping()` guard stays: bare keys never fire while a field is focused; ⌘/Ctrl
combos always fire (that is the point of the modifier). The ghost-text Tab is
the *only* Tab that does anything; all other Tabs cycle focus as the browser
default.

---

## 2 · The five zones

Order is the owner's new authority: **check-in → thoughts → habits → trades →
reflection.** (Maps to the QA day-page order as: facts≈check-in,
moments≈thoughts, trades, reflection last — the day *ends* on the ritual.)
The zones are **not cards** — they are sections of a single canvas divided by
hairlines (`border-line` 1px). Only the reflection frame (Z5) is `panel`-raised
when focused (the ceremony mode, §3.2). Everything else sits on the flat `bg`.

### 2.1 Z1 · Morning check-in (`CheckInBand`)

The day's facts as one quiet horizontal strip — the same cells `dayFacts()`
already computes (`mood / sleep / screen / mac / habits / R`), each a `label`
+ value pair, values **evidence-first direct-click editable** (the existing
`editableHint` dashed-underline affordance, unchanged). The band is read-only
*feeling*; correction is a rare gesture, not a form.

```
check-in  ·  fri 08-aug                          [evidence ▸] [capture ▸]
   mood 4/5  ·  sleep 7.2h  ·  screen 5.1h  ·  mac 3.2h  ·  habits 4/6  ·  +0.82R
```

- The **header line** carries the date (`fmtDayW`), the day, and the two
  ambient entry points: `evidence ▸` (a `<details>` below holding the
  screen-time screenshot strip + device notes + sleep note — the proof
  artefacts, collapsed by default) and `capture ▸` (opens `AIBuildSheet`).
- The **values line** is the strip. One line. Mono 12px. `dim` labels, `ink`
  values, `·` separators. R uses `num-up`/`num-down`/`text-dim` by sign
  (color discipline, §4.3).
- The **market strip** (current `MarketCard`, ambient one-liner) renders above
  the band: `market ● open · closes in 3h 12m · next 20:30 cpi ▸` — collapsed
  to one line, expandable. It stays because the market is the master clock; it
  shrinks because it is *context*, not the surface.
- **New day, nothing logged:** the band renders `—` cells and the empty-state
  line `the day starts here — paste evidence or just write a thought.`
- **Habit totals** are always of the *active* set (`active: true` in
  `src/content/habits/`), to match the public day archive.

### 2.2 Z2 · Thoughts surface (`ThoughtsSurface`)

The day's stream, fast and low-ceremony. Top: a single growing composer
textarea (placeholder `what happened — ⌘⏎ publishes, blur auto-publishes`).
Below: the draft and live moments in time order, dnd-reorderable (⠿ handle,
hover/focus only).

```
thoughts  ·  3 live · 1 draft                                + thought
  ┌─────────────────────────────────────────────────────────────┐
  │ what happened — ⌘⏎ publishes, blur auto-publishes           │
  │ 08:31  flagging the tape — news at 20:30              [tab]  │
  └─────────────────────────────────────────────────────────────┘
  draft — not public
  ⠿ 08:31  ·  note  flagging the tape — news at 20:30  [publish →][polish][×]
  live — public after rebuild
  ⠿ 08:12  ·  ·     what the tape did at the open…            [×]
  ⠿ 07:58  ·  ▲     trade 1 · orb-drive · +1.25R               [×]
```

**The auto-publish-on-blur contract — the single biggest opinionated departure:**

- **Default: thoughts auto-publish on blur.** The composer is a single growing
  textarea. When the user clicks away, tabs out, opens ⌘K, or scrolls past it,
  the current line is published as a `note` moment (the default type) and the
  composer clears with a brief `· saved` in the statusline. The stream is
  *the draft log* — every thought you have today ends up in the stream, and
  the stream is what `/day` and `/stream` show. This is **the** low-ceremony
  gesture: no button, no command, no publish event. You write; you look up; the
  thought is on the stream.
- **Override: ⌘⏎ publishes now, regardless of focus.** Useful for when the
  user is mid-flow and wants to lock a thought in (rare). The statusline
  confirms `thought published`.
- **Override: ⌘⇧⏎ (publish + new line) keeps focus in the composer for a
  chain of thoughts.** Used for the "I have 3 thoughts" case.
- **Type selector** — a 3-chip segmented control in the composer's footer
  (`note | quote | trade`). Note is default. Quote reveals an `author` field
  inline; trade reveals a `tradeIdx` picker (the existing `Select` of trades).
  Switching type on a half-typed thought preserves the text.
- **Per-moment `at`** — defaults to the current HKT minute on publish; the
  `at` is a `TextInput` on the draft row (rare override, since the order is
  also editable by dnd).
- **`polish`** stays (AI polish edits the draft text only); the result is a
  sonner `polished — review it, then publish`. A polished line is
  re-highlighted with a 1px `purp` left border for 3s (the only "AI happened"
  visual in zen; `purp` is the reserved AI-state token, §4.3).
- **Drag** is dnd-kit; the drag preview is the row at 60% opacity, drop is the
  60ms fade. The `⠿` handle is on hover/focus of the row only.
- **Empty state:** `nothing on the stream yet — the day starts with one line.`
  The composer placeholder is the only actionable verb; no CTA button.

### 2.3 Z3 · Habits row (`HabitRow`)

One slim row between thoughts and trades — the owner's order. The existing
habit chips unchanged in behavior (toggle bool; count-habits show `value` and
increment via `+`/`-` micro-buttons or by clicking to cycle), refined in skin:
28px chips, `raise` fill, done = the habit's color fill with `bg` text
(currently `style={background: h.color}` — keep), label in `dim`→`ink` on
hover, count-habits show `12/30` in mono on the chip.

```
habits  ·  4/6 active                          [library ▸]
  [quiet-time ✓]  [read 30 12/30]  [no-scroll]  [meditate ✓]  [walk]  [hydrate]
```

- `library ▸` jumps to the library tab (one quiet cross-tab nav from the row).
- The progress on count-habits is the only number in the row — small, faint,
  aligned right on the chip.
- **Empty** (no habits defined): `habits are defined in zen · library.`

### 2.4 Z4 · Trades accordion + the multi-model `TradeCard`

Header line: `trades (3) · +0.82R` + a quiet `+ trade` (⌘K `new trade` too).
Rows are a vertical accordion; drag handle ⠿ on each row (hover/focus) for
reorder. **dnd-kit**; the drag preview is the row at 60% opacity, drop = 60ms
fade. Clicking the chevron expands; the chevron is the only always-visible
affordance on the row.

**Collapsed (the everyday glance):**

```
▸ ▲ MNQ  [orb-drive ⌗][vwap-reclaim]+1  ·  ny-am     +1.25R  ·  +4.5pts   ⠿
▸ ▼ MNQ  [orb-drive ⌗]                  ·  ny-am     −0.80R  ·  −4.0pts   ⠿
```

- `▸/▾` chevron — accordion affordance
- `▲/▼ MNQ` — direction + market (15px, ink; `text-up`/`text-down` for the
  arrow, market name always `text-ink`)
- **model chips — primary first, then up to 1 secondary, then `+N` overflow.**
  The **primary** is the first item in `models[]`; it gets a 1px `accent` border
  + a 2px `accent` left bar (the `⌗` mark in the ASCII art — a single fat
  vertical line that says "this is the model this trade is *for*"). The
  secondary chips are plain `line2`-edged. Hover on any chip shows the
  premise one-liner (from the `models` collection's `premise` field). Click
  `×` on a chip (hover only) to remove it. The collapsed row shows at most 2
  chips + `+N`.
- `· ny-am` session (dim) — **setup is demoted out of the collapsed row**; it
  moves to the expanded tag row
- R + points right-aligned, tabular-nums, `up`/`down`/`dim` by sign
- ⠿ drag handle — hover/focus only

**Expanded:**

```
▾ ▲ MNQ                                              +1.25R  ·  +4.5pts  ·  −$127
  [orb-drive ⌗ ×]  [vwap-reclaim ×]  [meander ×]  [+ add model ▾]
  commentary — what made this one count
  ┌──────────────────────────────────────────────────────────────────┐
  │ news reversal — reclaimed the VWAP band and held the open…       │
  └──────────────────────────────────────────────────────────────────┘
  entry 20800.5  ·  stop 20795  ·  exit 20812.5  ·  risk 5.5  ·  pts 12
  setup orb  ·  session ny-am  ·  direction long  ·  confidence 4
  executions  lucid-50k-a ×1  ·  tpt-25k-a ×2
  charts  [▣][▣]                          (paste this trade's chart →)
```

The expanded body, top to bottom, in the order the owner reads:

1. **Model chip row** — every attached model as a removable chip
   (`accent`-edged primary first, `line2`-edged secondaries; `×` on hover;
   `Delete` key removes the focused chip). `+ add model ▾` opens a `Popover`
   listing models not yet attached — each row is the model name + premise
   one-liner. Hovering an attached chip shows the premise in a tooltip.
   Reorder by drag (the order *is* the primary-vs-secondary designation). Max
   sensible: 4–5; the collapsed `+N` handles the rest.
2. **Commentary** — promoted to the primary field of the expanded card
   (it is the published voice of the trade; the current layout buries it).
   Mono 13px, 1.5 leading, `soft` text, full-width.
3. **The numbers** — `entry · stop · exit · risk · pts` on one tabular-nums
   line, each direct-click editable (evidence-first, unchanged from the
   current `editableHint` affordance).
4. **The tag row (demoted)** — `setup · session · direction · confidence` as
   small `Field` selects, visually secondary, on one line.
5. **Executions** — `account × size` rows (unchanged behavior, `+ execution` to
   add; an empty row is `— account — · 1` by default).
6. **Charts** — screenshot strip + paste zone (unchanged behavior;
   `onTradeScreens` reads values off the chart via the vision model).

**Schema: `model: string` → `models: string[]`.** Migration rules:

- `src/content.config.ts` trade: add `models: z.array(z.string()).default([])`;
  keep `model` optional (back-compat read).
- **Read path** (`/api/admin/days` GET + `DayWorkspace` load + `toDayData` in
  `src/pages/api/admin/reviews.ts`): `models ?? (model ? [model] : [])`.
  Existing day files with `model: "orb-drive"` surface as `models: ["orb-drive"]`
  everywhere — no broken links, no migration commit.
- **Write path** (POST): persist `models` (trimmed, deduped, order-preserving).
  The first model is the primary; the schema does not enforce this — it is a
  UI contract.
- `src/lib/stream.ts`: `DayTrade.models?: string[]`,
  `ResolvedMoment.trade.models?: string[]`. `ROf`/`riskOf` untouched.
- **Public rendering — all chips, primary first.** `DayArchive.astro` line 95
  replaces the single `{t.model && <Badge>…</Badge>}` with
  `t.models?.map((m, i) => <Badge variant={i===0 ? "accent" : "default"}>{m}</Badge>)`.
  `MomentCard.astro` line 42 changes `model ?? setup` to
  `models?.length ? models.join(' · ') : setup ?? 'no model'`.
- **`src/lib/models.ts` + `src/lib/period-stats.ts`:** iterate `t.models ?? []`
  — a trade tagged to N models contributes to all N models' lists and sums.
  Correct semantics: "R when I traded model X" is true for both tags; a
  shared-setup trade appearing in two model pages is right, not a bug.
- **Back-compat at the content layer:** the schema keeps `model` optional; a
  day file with `model: "orb-drive"` is valid forever, the read fallback
  always wins.

### 2.5 Z5 · Reflection zone (`ReflectionZone`) — the ritual

The end-of-day ritual — deliberately the most *ceremonial* surface on the
page. Anatomy, top to bottom:

1. **The header** — `reflection · the end-of-day ritual` (left) + the
   **obligation chip** (right). The chip is a `Badge variant="default"` with
   the obligation text. In grace: `due in 4h 22m` in `warn`. Past grace:
   `overdue · 2h past` in `down` with the 2s pulse. Done: `· fri` in faint
   `up` (relaxed, no pulse). The chip is the only colored element in the
   header; it is the primary signal of the obligation (§5).
2. **The frame** — when the reflection editor is focused, the zone's container
   becomes `panel`-raised and the rest of the page dims to 40% opacity
   (ceremony mode, §3.2). When focus leaves, the panel and the dim return
   to their rest state with a 200ms ease.
3. **The title row** — `title · summary · tags` on one line, three `Field`s,
   `text-2xs` labels, mono inputs. Demoted — these are the metadata; the
   body is the surface.
4. **The writing surface** — `MarkdownEditor` (unchanged, the same component
   the journal preview uses), `15px / 1.8` prose, full width, the **only
   place 1.8 leading exists on the page**.
5. **The action row** — `AI draft from today` (left) and
   `publish reflection  ⌘⏎` (right, primary). Single quiet row.
6. **The status row** (only when published) — a single faint `up` line
   `● published to /journal` + a quiet `view →` link. When the draft differs
   from the live version: `● draft differs from live · republish to overwrite`
   in `warn` (faint, not loud — this is not an error, it is a fact).

```
reflection · the end-of-day ritual                  ⌗ due in 4h 22m
  title [……]  summary [……]  tags [……]
  ┌──────────────────────────────────────────────────────────────────┐
  │ the day in prose. 15px / 1.8. the one calm surface on the page.  │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
  [AI draft from today]                  publish reflection  ⌘⏎
```

- **Publish = `⌘⏎`** (focused editor) or the publish button. Writes
  `journal/<date>.mdx` exactly as `publishReflection` does today (title/
  summary/tags/featured + body), queues the change, sonner
  `reflection published — queued for rebuild`. No autosave-then-publish
  surprise — publish is a separate, explicit gesture.
- `AI draft from today` stays (same `runDraft`/`daySnapshot()` semantics); the
  resulting draft is `purp`-tinted for 3s (the AI-happened signal).
- The `● published to /journal` line stays in the zone (per spec), faint `up`
  when the draft matches live.
- **Restraint is the ceremony:** this zone is the widest on the page (full
  content width, no max-width clamp), the only 1.8 leading, the only
  `panel`-raised zone on focus, the only place the page dims around it, the
  only place the obligation is a physical chip on the frame. The reading is
  *the page is for this*. The single primary action is here; everything else
  on the page is secondary.

### 2.6 The statusline (`StatusLine`)

The page's only bottom chrome — one hairline strip, one line, `faint` by
design (§4.3: `faint` is the ambient token). Never a button bar.

```
2026-08-09 · +0.82R · 3t · habits 4/6 · ⌘⏎ publish · saved 22:41
```

- **Left:** the day readout (date · R · trades · habits — the four numbers
  the owner lives by), tabular-nums. The `saved HH:MM` is the autosave stamp
  — appears for 3s after each save, then fades to `faint` (the only fade on
  the page besides the 60ms sheet/palette one).
- **Right tail:** `⌘⏎ publish` — a `Kbd` affordance that appears only when
  the focused writing surface has content. Hover brightens to `dim`.
- **No obligation tail.** The obligation is on the Z5 frame (§5) — it lives
  where the obligation is fulfilled, not in a bottom bar the user has to
  correlate back to a zone. The statusline is the *day readout*, period.

---

## 3 · The two writing surfaces

Thoughts and reflection are **separate entities with separate state, separate
publish actions, and separate ceremony.** The schema already separates them
(`draft.moments` + `stream[]` vs `draft.reflection` + `journal/<date>.mdx`).
The UI now treats them as the two temporalities of the day — and the contract
between them is the entire point of the design.

| | **Thoughts (Z2)** | **Reflection (Z5)** |
|---|---|---|
| rhythm | many/day, throughout the day | one/day + period rungs |
| ceremony | **none** — auto-publish on blur | **high** — ceremony mode, the frame, the only 1.8 leading |
| unit | a moment: text + images | prose: body + title/summary/tags |
| publish target | `stream[]` (→ `/day` + `/stream`) | `journal/<date>.mdx` (→ `/journal`) |
| default publish | **blur** (auto) | **⌘⏎** (explicit) |
| override publish | `⌘⏎` (publish now), `⌘⇧⏎` (publish + new line) | `⌘⇧⏎` (publish + collapse) |
| draft state | `draft.moments` (warn "not public") | `draft.reflection` |
| autosave | debounce 2s idle + blur → `· saved HH:MM` | same |
| empty state | `nothing on the stream yet — the day starts with one line.` | `no reflection yet — due tonight.` |
| urgency | none — ephemeral, replaceable | the obligation — the ritual |
| AI ghost-text | yes, default on | yes, default on (longer context window) |
| polish indicator | `purp` left border for 3s on polished line | `purp` left border for 3s on drafted body |

**Shared contract (both):**

- **⌘⏎ publishes the focused surface.** `(metaKey||ctrlKey)&&Enter`, with the
  `isTyping()` guard inverted: it fires *only* when a writing surface is
  focused, and ⌘K never steals it (modifier combos bypass the guard, as
  today). macOS shows `⌘⏎`, elsewhere `Ctrl+⏎`; the `Kbd` hint renders the
  platform form via `navigator.platform` (set once on mount).
- **No save / save & rebuild buttons anywhere on the page.** Autosave (2s idle
  debounce + blur) persists the draft to the day record and stamps
  `· saved HH:MM` in the statusline. Publication is a *separate, explicit*
  gesture (publish thought / publish reflection / RebuildBar rebuild) — the
  draft-vs-live distinction the owner built stays intact; only the ceremony of
  saving changes. The save buttons in the header and footer (current lines
  740–742 and 1234–1237) are gone.
- **Publish errors are sonner** (`✗ publish failed — the draft is safe, retry`),
  never inline banners. The draft is *always* safe — autosave has it.
- **Both surfaces remember focus** across sheet/palette excursions (close ⌘K
  → back in the half-typed thought, cursor position intact).
- **AI ghost-text** (§6) works the same on both: prose-line gate, streaming,
  Tab to accept, Esc to dismiss.

### 3.1 The auto-publish-on-blur contract (thoughts, the departure)

The single biggest opinionated departure from the flash design. Why it is
right:

- **The whole point of a thought is that it shouldn't require a gesture.**
  The owner is mid-day. They have 12 thoughts. If each one needs ⌘⏎, the
  thought stops being a thought and becomes a publish event. The blur moment
  is the *natural* boundary — you look up, the thought is on the stream, you
  type the next one. The stream is the *thought log*; it is meant to be
  ambient, not curated.
- **It maps the data model exactly.** Thoughts → `stream[]` is a write-many
  public surface; reflection → `journal/<date>.mdx` is a write-one, slower
  surface. The publish gesture should match: many-fast vs one-slow.
- **The ⌘⏎ override is still there** for when the user wants to lock a
  thought in immediately (rare — but useful for "publish this then close the
  sheet" or "publish then open ⌘K"). It is a fast-publish *override*, not the
  default.
- **Implementation:** the composer textarea wraps in a `<form>` whose `onBlur`
  handler reads the value, builds a `note` moment with `at` = the current HKT
  minute (from the day rail's `now` marker), and calls `publishMoment`. The
  composer then clears and re-focuses. If the textarea is empty on blur, do
  nothing. If the user has the `quote` or `trade` type selected with a
  half-typed value, the same auto-publish fires with the type intact.
- **Edge case — sheets/palette:** when a sheet opens, the composer's blur
  fires; the half-typed thought auto-publishes. The focus return from the
  sheet puts the caret back in the (now empty) composer. **This is a
  feature**: the user opened a sheet to do something else; their thought
  lands on the stream; they come back to a fresh composer. If the user wants
  to keep the thought unpublished, they can ⌘Z (the publish is to `stream[]`,
  not a server write — but undo across the stream would mean the same code
  path the current `unstreamMoment` uses, called from a `Cmd+Z` handler in
  the composer wrapper).

### 3.2 The ceremony mode (reflection, the visual anchor)

The single biggest visual departure from the flash design. When the reflection
editor gains focus, three things happen, with a 200ms ease:

1. The **Z5 container** becomes `panel`-raised (the only `panel` zone on the
   page while focused; everything else is on flat `bg`).
2. The **other four zones** (Z1–Z4) dim to 40% opacity. They are not hidden —
   they are *there* but quiet. The reflection becomes the only thing the
   page wants you to look at.
3. The **header strip** (date, market) dims to 60% — it's still there (you
   need to know what day you're reflecting on) but it isn't competing.

When the reflection loses focus (click outside, ⌘K, tab to another surface):

1. Z5 returns to flat `bg`.
2. Z1–Z4 return to 100% opacity.
3. Header returns to 100%.

The transition is the only place the page uses a 200ms ease (the motion
budget's one fade is 60ms for sheets; this is the 200ms reflection, an
explicit exception because the transition *is* the ceremony). When the page
is in ceremony mode, ⌘K is the only escape — pressing it opens the palette
and the zones return to 100% (focus moved away from the editor).

**Why this is right:** the owner said *restraint is the ceremony* in the
prior session. Restraint taken to its visual limit is *removing the rest of
the world from the user's attention* — not with a modal (which would block
the rest of the day) but with a dim (which keeps it available, just quiet).
The reflection editor doesn't have to be a separate page or a modal; it just
has to be the loudest thing on the page when you're in it.

**Edge case — ghost-text suggestion:** the ghost-text suggestion does not
trigger ceremony mode on its own; only an actual focus on the editor does.
When you Tab-accept a suggestion, the editor stays focused, ceremony mode
stays on.

---

## 4 · UX-PRINCIPLES — the craft layer

The rules that make the surface feel considered. An implementer should be
able to ship from this section alone. These are *locked* — the owner's
"everything a thing of awe and beauty" is delivered here, in restraint.

### 4.1 Type

- One face: **JetBrains Mono Variable** everywhere in zen. Syne is the
  wordmark's alone. There is no second face — variety comes from
  size/weight/tracking.
- **Writing is 15px / 1.8** (the `.prose` rhythm) — used **only** in the
  reflection editor. It is the rarest leading on the page, and that rarity
  is the point. The thought composer is 14px / 1.5 — same family, denser,
  because thoughts are quick and the stream is dense.
- **Data is 12–13px at 1.0–1.3.** Tables, chips, the R column, the rail
  tooltips, the obligation chip, the ⌘K rows.
- **Labels are 11px uppercase, tracking 0.14em, `dim`** — the site's voice.
  Never wrap (`whitespace-nowrap`); never exceed ~14 chars. The current
  `text-2xs` voice.
- **Zone headers: 12px uppercase tracking-widest, `soft`** — `text-2xs`
  card-title voice, promoted to a full-width hairline-slash. The header is
  on the same baseline as the section, not above it.
- **Numbers are always `tabular-nums`** — tables, the R column, the
  statusline, the rail tooltips, the obligation countdown. No exceptions.

### 4.2 Spacing

- A strict **4px grid.** The page rhythm: zone gap 32 (`space-y-8`),
  intra-zone 16, card padding 16 (for the reflection frame, sheets, and
  palette), chip 28px tall, row hit target 36–40 (fine) / 44 (coarse).
- **The page reads as stacked slabs separated by hairlines** (`border-line`
  1px) with generous breathing; never a wall of boxes. Zones are not cards —
  they are sections of a single canvas. Only the reflection frame (Z5) and
  the sheets/palette are `panel`-raised.
- **The quiet column stays flat (`bg`).** This is the surface's primary
  visual identity. Cards are noise.

### 4.3 Color — each token has exactly one job

| token | job |
|---|---|
| `bg` | the void — page, inputs, chips' rest, the canvas |
| `panel` | raised surfaces — sheets, palette, reflection frame *only* (when focused) |
| `raise` | hover fill + selected day cell + accordion open |
| `line` / `line2` | hairline hierarchy — structural 1px / interactive edge |
| `ink` | the one readable text |
| `soft` | body copy |
| `dim` | labels, meta, secondary chips |
| `faint` | ambient only — statusline, empty states, ghost affordances, day cells with no record. **A `faint` element is never a CTA.** |
| `accent` | **one job: interactive focus + the primary model chip** — focus rings, active tab, dashed editable-underlines, selected/emphasized day cell, the primary model chip's left bar. Not decoration. |
| `up` | the good state — positive R/pnl, `published`, obligations *done*, day cells with ΣR ≥ 0 |
| `down` | the bad state — losses, delete, build failure, *overdue*, day cells with ΣR < 0 |
| `warn` | the pending state — unsaved, in-grace due, draft moments |
| `purp` | reserved: AI-generated content markers (AI draft, polished text) — rare, 3s tint, then fades |

**Rules:**

- **Color is data or state, never decoration.** No gradients in zen (the
  starfield stays on the public theme; the instrument stays flat).
- **Profit is `up` everywhere and never green-for-negative** (kills the
  Phase-4 money-color bug class by construction).
- **The primary model chip's accent is structural, not decorative** — it
  encodes "this is the model this trade is FOR," a real semantic distinction.
  Removing it would make the trade card less informative, not less loud.
- **No chip is ever `up` or `down` colored** — state is for the data, not
  the metadata.

### 4.4 Micro-interactions

- **Hover**: edges re-color (`line2`→`accent`, `dim`→`ink`), 120ms ease.
  Nothing moves, scales, or slides on hover.
- **Press**: `raise` fill, no bounce.
- **Focus** (global): `:focus-visible` = 2px `accent` ring, offset 2px, on
  every keyboard-reachable element. Never `outline: none` without a
  replacement. Focus rings are the only accent allowed to touch data rows.
- **Editable values** (evidence-first): dashed `line2` underline → `accent`
  on hover, `cursor: pointer`, `title="click to correct"` — the current
  `editableHint`, unchanged, everywhere a value is overridable.
- **The caret**: native caret, `caret-color: accent`, on the two writing
  surfaces. No fake blinking block cursors — the owner retired `▋`.
- **The obligation pulse**: a soft 2s opacity pulse on the Z5 obligation
  chip *only when past grace*. The keyframe is the existing `tape-pulse`
  in `src/styles/app.css:499-502`. The pulse is the visual signal of
  *overdue*; the text color (`down`) is the static signal. The two are
  redundant on purpose — motion alone is never the only signal.

### 4.5 Empty states

Crafted, one line, faint, terminal voice, always ending in the one
actionable verb (or a `▸` linking to it). Never "no data."

```
day          the day starts here — paste evidence or just write a thought.
thoughts     nothing on the stream yet — the day starts with one line.
trades       no trades — paste charts or ⌘K "new trade".
reflection   no reflection yet — due tonight.
habits       habits are defined in zen · library.
ingest       drop a Tradovate export — the AI proposes, you approve each.
```

### 4.6 Motion budget — exactly three moments

1. **The caret** (native blink — not ours)
2. **The due-pulse** — soft 2s opacity pulse, *only* when an obligation is
   past grace (the existing `tape-pulse` keyframe)
3. **A 60ms opacity fade** — the single transition used for sheet open/close,
   palette open/close, sonner enter/leave, dnd drop, accordion expand/collapse.
   **No slide, no scale, no stagger, no scroll-triggered entrance.**

**One explicit exception:** the **200ms ceremony mode** (Z5 focus → other
zones dim to 40%) — the *one* place the page uses a longer transition,
because the transition *is* the ceremony. The exception is documented in the
Z5 section (§2.5) and is the only place the budget rule is broken.

The surface is an instrument: it responds, it never performs.
`prefers-reduced-motion: reduce` turns all three off; the due-pulse's *state*
survives as color (`down` text), never motion alone.

### 4.7 The feeling of a well-made tool

44px hit targets on coarse pointers (already global in zen, §3 in
`app.css`), 36–40 on fine. Labels never orphan. Hairlines sit on the 4px
grid. Every list is keyboard-navigable. Every dialog traps focus and
returns it. Every number is tabular. The statusline is the only bottom
chrome. The page is one canvas divided by hairlines, not a stack of
cards. The quiet column stays quiet. The test of the surface: **at any
moment, the owner can say where their eyes should go** — and the answer
is the thing they were writing. **The page's job is to make writing feel
inevitable.**

---

## 5 · The reflection obligations timeline

From `src/lib/accountability.ts` — five rungs, each a duty with a grace:

| rung | due | after grace |
|---|---|---|
| **daily** (Mon–Fri) | reflection by **03:00 HKT next day** | `overdue · Xh past` |
| **week** | Mon–Fri week review by **Mon 03:00 HKT** | `week 33 review overdue` |
| **quarter** | review by **03:00 HKT day after end** | `Q3 review overdue` |
| **H1** | review by 03:00 day after end | `H1 review overdue` |
| **year** | review by 03:00 day after end | `year review overdue` |

(Reuse `accountabilityStatus()` + the `copy.ts` fragments verbatim; the
surface renders, it does not re-derive.)

**The obligation is a chip on the Z5 frame** — the single departure from
the flash design and the right one. Why:

- **The obligation is about the reflection; it lives where the reflection
  is.** A statusline tail is an ambient reminder that the user has to
  correlate back to a zone. A chip on the zone's own frame is the zone
  *being* the reminder. The Z5 frame is the visual contract: *this is the
  ritual, and it has a time.*
- **The chip is contextual to time, not just state.** In grace: `due in
  4h 22m` (warn, with a live countdown that ticks every minute). Past
  grace: `overdue · 2h past` (down + 2s pulse). Done: `· fri` in faint
  `up` (relaxed, no pulse, no ring — just the quiet green of a finished
  duty).
- **The statusline is freed to be the day readout** — date, R, trades,
  habits, saved time, ⌘⏎. It is the *day's* bar, not the *todo*'s bar.
  The day-rail's `pending` bar (§1.3) carries the *ambient* obligation
  signal (a 2px `down` bar on a day's cell) for period-level scanability
  while scrolling history; the Z5 chip carries the *focal* obligation
  signal for today's writing. The two reinforce each other; neither is
  a nag.

**Surfaces (the obligation in three places, each with a different role):**

- **Z5 obligation chip** — primary. The chip on the zone's frame,
  contextual to time. In grace: `due in 4h 22m` (warn, with live
  countdown). Past grace: `overdue · 2h past` (down + 2s pulse). Done:
  `· fri` in faint `up` (relaxed). Click on the chip scrolls to the
  top of Z5 and focuses the editor; for a period rung, it switches to
  the reviews tab with the anchor preselected.
- **Day-rail pending bar** — ambient. A 2px `down` bar on the right
  edge of a cell when that day has a pending (in-grace or overdue)
  reflection. Scannable while scrolling history. `aria-label="pending
  reflection"`. Hidden when the duty is done.
- **Empty state on Z5** — when no reflection exists yet and the day is
  in grace: `no reflection yet — due tonight.` When past grace:
  `no reflection yet — overdue.`

**"Done" definition** (unchanged from `accountability.ts`): daily = a
`journal/<date>.mdx` exists (the current `content.trim()` check). Period =
a review note exists for the anchor (the `notes` set in
`accountability`). Drafts never count; only publication clears the duty.

**The countdown** ticks every minute client-side (same hook the rail's
`now` marker uses, factored into `useHktNow()` in `src/lib/clock.ts` —
new file, ~15 lines, lives next to `src/lib/market.ts`). The chip's
countdown text is `useHktNow()`-derived, so opening the page at 23:58
and checking again at 00:01 both show the right number. Server-render
the chip on mount; hydrate the countdown on the client.

---

## 6 · AI ghost-text writing assist (IN SCOPE)

The writing surfaces (thoughts composer + reflection editor) get inline
next-word suggestions — the muted-gray "autocorrect on steroids" the owner
saw in modern writing panels. A suggestion is a few words ahead of the
caret in dim non-italic mono; **Tab accepts, Esc dismisses, any diverging
keystroke kills it**. It is a caret-position overlay on the *existing*
native textarea (`MarkdownEditor.tsx` — the DOM contract, value/onChange,
autosave, paste-sink, preview tab are untouched; the overlay is an
additive sibling).

**Mechanics (verified against the current stack):**

- **Rendering** — `textarea-caret-position` (npm, ~3KB, MIT) computes
  the caret's pixel coordinates; an absolutely-positioned
  `pointer-events-none` overlay `div` renders the suggestion there.
  Non-italic (italic is a serif convention — in mono it looks broken),
  `faint` color at 60% opacity, with a **faint `[tab]` `Kbd` affordance**
  at the end of the suggestion (this is the visible cue — the owner
  should always know they can accept). The native caret stays solid —
  never hide or dim it. `aria-hidden="true"` — decorative until accepted.
- **Streaming** — mandatory. `orChat()` in `src/lib/ai.ts` is
  non-streaming today; add `orChatStream()` (~30 lines, same
  headers/env, `stream: true`, `res.body.getReader()` loop) + an Astro
  route `POST /api/admin/complete` (zen-session auth, re-emits text
  deltas to the client) + `eventsource-parser` (npm, MIT, ~2KB, handles
  OpenRouter's `: OPENROUTER PROCESSING` comment lines and mid-stream
  errors). First word lands in <1s; the rest fills in. Non-streaming =
  a dead 1–3s pause = the difference between "beautiful" and "laggy."
- **Trigger** — ~500–800ms typing pause (debounce 600ms), min ~10 chars
  in the current line, prose-line gate only: never on prices/numbers
  (`20800.5`), `MNQ` ticker lines, markdown fences, URLs, or
  mid-typo-burst. The gate is a single `shouldComplete(text, caret)`
  helper (~15 lines, pure function, tested): false if the line contains
  `\d+\.\d+`, `\`\`\``, `://`, or a number > 3 digits; true otherwise
  once the debounce + min-chars pass. Request carries `max_tokens` ~40–60
  + `stop: ["\n\n", "```", "\n#"]`. Abort on dismiss (the
  `AbortController` is the only state the hook owns besides the
  suggestion text).
- **Model + cost** — DeepSeek V3 (`deepseek/deepseek-chat`, the
  current `modelAssist()`), streaming via the existing OpenRouter
  wiring. ~$0.01/day at the owner's writing volume. Cost is a
  non-issue; latency is the only constraint, and streaming solves it.
- **Accept keyboard** — Tab accepts (the universal convention: Cursor,
  Copilot, Google Docs Smart Compose). Esc dismisses. Caret-move / blur
  / diverging keystroke dismiss + abort (the controller's `.abort()` is
  called in the `keydown` handler whenever the key isn't `Tab` or
  `Esc`). On Tab, the suggestion is inserted at the caret and the caret
  advances to its end; on Esc or diverge, the suggestion vanishes
  (CSS transition: 80ms opacity fade — the budget's 60ms is for
  sheets; ghost-text is faster because it's per-keystroke).
- **Autocorrect/spellcheck** — none. The AI continuation *is* the
  correction (the typo is in the prompt, the continuation is clean).
  Set `spellcheck="false"` + `autocorrect="off"` on the textareas so
  the OS doesn't inject red underlines into the mono surface.
- **Default ON with a quiet toggle** — the owner asked for this
  explicitly in the writing surfaces. The toggle lives in ⌘K `view →
  ghost-text: on | off` and persists in `localStorage` under
  `1edge.ghostText`. No "AI" branding in the UI, no nudge wall — just
  gray text and a `[tab]` to accept.
- **Motion budget impact** — none. No fade-in on the suggestion itself
  (it's already streaming in); the 80ms dismiss is the budget's
  60ms family (close enough not to count as a new moment). The §4.6
  budget is unchanged.
- **Polished draft / AI-drafted reflection** — when the AI has touched
  the text, the `purp` left border appears for 3s (the only "AI
  happened" visual in zen). Ghost-text is *streaming* AI, not
  *polished* AI, so it does not get the `purp` tint — the user can see
  what they typed, what the AI added, and decide. The `purp` is only for
  one-shot AI actions (polish, draft from today).

**Not using:**

- `@copilotkit/react-textarea` — legacy v1, Slate-based, swaps the
  native textarea DOM the autosave/paste-sink depend on. The current
  `MarkdownEditor` is a plain `<textarea>` and the entire autosave
  pipeline is built on it.
- TipTap / ProseMirror — overkill for a plain-markdown surface.
- Vercel AI SDK — saves ~40 lines of plumbing, costs a protocol
  dependency. The 30-line `orChatStream()` is enough.
- Autocorrect libs (`typo-js` / `nspell`) — Hunspell-style red-squiggle
  fights the mono aesthetic and adds 200KB. The AI continuation is the
  correction.

---

## 7 · Component inventory

**New, day-surface-specific** (all in `src/components/admin/`,
unless noted):

| component | one-line responsibility |
|---|---|
| `DayRail` | the 44px day-dot rail — per-day cells, today ring, `now` marker, hover tooltip, arrow-key nav (`listbox` semantics) |
| `useHktNow()` | hook (in `src/lib/clock.ts`) — current HKT minute, ticked client-side, 60s interval |
| `ObligationChip` | the chip on the Z5 frame — in-grace/past-grace/done states, live countdown, click navigates |
| `CheckInBand` | Z1 — dayFacts cells, direct-click override, evidence `<details>`, capture entry |
| `ThoughtsSurface` | Z2 — composer + draft/live moment lists, type segmented control, auto-publish on blur, ⌘⏎ override, dnd |
| `HabitRow` | Z3 — the habit chip row (bool/count, done fill) |
| `TradeCard` | Z4 — the multi-model accordion row: collapsed glance + expanded editor, primary chip treatment |
| `ModelChipRow` | the chip strip inside `TradeCard` — attach Popover, premise tooltip, remove, dnd reorder, `+N` overflow |
| `ReflectionZone` | Z5 — obligation chip header, title/summary/tags, editor, publish, ceremony mode (dim siblings) |
| `CeremonyMode` | hook + provider — focuses Z5 dims Z1–Z4 + header to 40–60%, 200ms ease |
| `StatusLine` | the page footer — day readout, ⌘⏎ hint, `saved HH:MM` |
| `CommandPalette` | ⌘K — the full command list (§1.4), fuzzy filter, Kbd affordances |
| `AIBuildSheet` | the capture ritual: ephemeral paste → structure → apply + sonner |
| `IngestSheet` | the import ritual: existing IngestPanel on a TanStack Table |
| `DayPickerSheet` | month grid + recent 14 + jump input (the rail's overflow) |
| `GhostText` | §6 — caret-position overlay on the textareas: suggestion render, `[tab]` accept affordance, Esc dismiss, abort-on-diverge |
| `useGhostText` | §6 — the hook: 600ms debounce + prose-line gate + abortable streaming fetch + keyboard contract |
| `orChatStream()` | `src/lib/ai.ts` — streaming variant of `orChat` (same headers/env, `stream: true`, reader loop) |
| `POST /api/admin/complete` | Astro route — zen-session auth, re-emits OpenRouter text deltas to the client |

**Reused from the planned shadcn-style batch** (native chrome, not
wrappers): `Command` (palette), `Sheet` (the three sheets), `Sonner`
(toasts), `Badge` (model chips, obligation chip, `+N` overflow), `Kbd`
(shortcut affordances — the `⌘⏎`, `[tab]` indicators), `Field` (the
demoted tag-row fields), `Popover` (model quick-add), `Empty` (the
crafted empty states), `@dnd-kit` (trade/moment reorder), TanStack
Table v9 (ingest proposals).

**Deliberately not used:** `Sidebar` (the rail is chrome, not furniture —
§1.3), `DropdownMenu` (⌘K + inline controls cover every action; a
right-click menu is furniture), react-colorful/emoji picker (library-tab
chrome — the recipes ship with the batch, not this surface).

**Retired:** the sticky section-jump bar, the 210px aside, the capture
card, the inline IngestPanel, the header/footer save buttons, the custom
toast, the `?` help modal, the `zenLine` banner, the header date input,
the section cards (the page is one canvas, not a stack).

---

## 8 · Build-order note (for the executing agent)

1. **Batch first** — the recipes (`Command` / `Sheet` / `Sonner` / `Badge` /
   `Kbd` / `Field` / `Popover` / `Empty` / `Table` / `@dnd-kit`) are the
   foundation; the surface is built on them. Land these in one PR before
   touching the day surface.
2. **Schema** — `models` migration (read fallback first, write new shape).
   Touch `content.config.ts` + the two read sites (`days` API + `toDayData`
   in reviews API). The day file format is forward-compatible; no migration
   commit needed.
3. **Shell** — `useHktNow()` + `DayRail` (with the `now` marker) + `StatusLine`
   + `CommandPalette` (the persistent skeleton, no zones yet). This is the
   first thing the owner sees — make sure the rail scrolls correctly and the
   `now` marker ticks.
4. **Zones bottom-up** — `HabitRow` → `CheckInBand` → `ThoughtsSurface` →
   `TradeCard` (+ `ModelChipRow`) → `ReflectionZone` (+ `ObligationChip` +
   `CeremonyMode`). Each independently shippable + typecheckable. The
   `TradeCard` schema change lands with the `TradeCard` PR; `DayArchive` and
   `MomentCard` updates land in the same commit.
5. **Sheets last** — `AIBuildSheet` + `IngestSheet` + `DayPickerSheet` (they
   wrap existing rituals; the rituals already work, the chrome is the new
   work).
6. **Ghost-text** (§6) — `orChatStream()` + `/api/admin/complete` →
   `useGhostText` + `GhostText` overlay → gate into `MarkdownEditor` and the
   thoughts composer (covers both writing surfaces). The quiet toggle lands
   with it (⌘K `view → ghost-text: on | off`, `localStorage`).
7. **Polish pass** — public renderers updated in the same commits as the
   schema change (`DayArchive` multi-model chips, `MomentCard` joined
   models). `aria-label`s for the rail cells, the obligation chip, the
   ghost-text suggestion. Run `npm run typecheck` and the test suite at
   each step.
8. **Verify** — `bash scripts/audit-pipeline.sh` and `bash scripts/verify-env.sh
   test` to confirm the preprod still works. Then `bash scripts/ship.sh
   preprod-to-main` per the pipeline contract, and verify live.

**Verified against current code:** `AdminApp.tsx` (shortcuts/tabs/toast/help/
banner), `DayWorkspace.tsx` (zones/save/publish/editing), `ui.tsx`
(`Field`/`Button`/`Card`), `RebuildBar.tsx` (pending/rebuild/flash), `api.ts`
(bus/notify/rebuild), `accountability.ts` (rungs/grace), `stream.ts`
(`model`→`models` touchpoints), `copy.ts` (obligation fragments),
`app.css` (tokens/type/prose/zen hardening), `content.config.ts` (trade
schema), `DayArchive` / `MomentCard` (public chips), `ai.ts` (`orChat` →
`orChatStream`), `MarkdownEditor.tsx` (textarea contract for the overlay).
