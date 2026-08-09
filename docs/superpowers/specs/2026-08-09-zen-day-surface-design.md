# THE ZEN DAY SURFACE — FINAL INTEGRATED DESIGN

**Date:** 2026-08-09 · **Status:** design, pending owner approval
**Scope:** the `/zen` "day" tab (`DayWorkspace.tsx`) rebuilt on the planned admin batch
(cmdk ⌘K, @dnd-kit, TanStack Table v9, sonner, shadcn-style recipes). One coherent
surface — this is the plan the owner approves, then the build is execution.
**Out of scope:** react-colorful / emoji picker recipes exist for the library tab, not
this surface. (AI ghost-text writing assist is IN scope — §4.8.)

---

## 0 · The thesis

The day surface is **an instrument you live in, not a dashboard you visit.** It is
one column of five stacked zones, zero floating toolbars, one ambient statusline.
Everything that is *not* the day itself is **invoked, never persistent**: ⌘K is the
only chrome above the content, Sheets live beside it, dnd appears only while
dragging. Writing is the surface: thoughts publish instantly to the stream
(`/day` + `/stream` — same data, two slices), the reflection is a slower, framed
ritual with obligations. The aesthetic is terminal-native and severe: one
typeface, one radius, hairlines on a 4px grid, color reserved for **data and
state** (never decoration), and a motion budget of exactly three moments —
the caret, the due-pulse, and one 60ms fade.

The generational admin batch is the *native chrome* of this surface, not an
afterthought: the section-jump bar **becomes** ⌘K, the capture/ingest/day-picker
**become** Sheets, publish errors **are** sonner, model tags **are** Badge/Kbd,
reorder **is** dnd, the ingest proposal table **is** TanStack Table. Nothing is
retrofitted.

---

## 1 · The integrated shell

### 1.1 The layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ header  [1edge_ zen]   [overview][day][accounts][coach][media][library]   │
│                        [reviews]                    [⌘K  ▸]               │
├──────────────────────────────────────────────────────────────────────────┤
│ RebuildBar  ● published  · last rebuilt 22:38                    ▸        │
│             (or: ● 2 draft changes — not published   [rebuild to publish])│
├───┬──────────────────────────────────────────────────────────────────────┤
│   │  2026-08-09 fri · 08:xx hkt · market ● open          [⌘K]            │
│   │  ─────────────────────────────────────────────────────────────────── │
│ D │  Z1  morning check-in   mood 4/5 · sleep 7.2h · screen 5.1h ·         │
│ A │      mac 3.2h · habits 4/6 · +0.82R                     [capture ▸]   │
│ Y │  ─────────────────────────────────────────────────────────────────── │
│   │  Z2  thoughts           ┌ new thought — ⌘⏎ publishes ──────────────┐ │
│ S │                         │ 08:12 · · what the tape did at the open… │ │
│ T │                         └──────────────────────────────────────────┘ │
│ R │  Z3  habits             [quiet-time][read 30][no-scroll]              │
│ I │  ─────────────────────────────────────────────────────────────────── │
│ P │  Z4  trades (3) · +0.82R                                              │
│   │      ▸ ▲ MNQ  [orb-drive][vwap-reclaim] +1 · ny-am   +1.25R · +4.5pts │
│   │      ▸ ▼ MNQ  [orb-drive]                 · ny-am   −0.80R · −4.0pts │
│   │  ─────────────────────────────────────────────────────────────────── │
│   │  Z5  reflection         [due tonight 03:00]                            │
│   │      ┌ title ────────────┐ ┌ summary ─────────────┐ ┌ tags ───────┐  │
│   │      └───────────────────┘ └──────────────────────┘ └─────────────┘  │
│   │      ┌──────────────────────────────────────────────────────────────┐│
│   │      │  the day in prose — 15px / 1.8 — the one calm surface        ││
│   │      │  …                                                           ││
│   │      └──────────────────────────────────────────────────────────────┘│
├───┴──────────────────────────────────────────────────────────────────────┤
│ statusline  2026-08-09 · +0.82R · 3t · habits 4/6 · ⌘⏎ publish · saved    │
│             22:41                    reflection due tonight ▸             │
└──────────────────────────────────────────────────────────────────────────┘
```

**Who is where (current code → new):**

| Today (`DayWorkspace.tsx` / `AdminApp.tsx`) | Becomes |
|---|---|
| sticky section-jump bar (lines 701–715) | ⌘K palette, "jump" group |
| 210px aside: mini-calendar + recent days (lines 748–800) | 44px day-dot rail (`DayStrip`) + `DayPickerSheet` |
| capture card (lines 807–837) | `AIBuildSheet` (invoked) |
| `IngestPanel` inline (line 840) | `IngestSheet` (invoked) |
| header `save` / `save & rebuild` buttons (lines 740–742) | **gone** — autosave + RebuildBar + sonner |
| footer save buttons (lines 1234–1237) | **gone** — same |
| custom bottom-center toast (AdminApp lines 195–202) | sonner, top-right |
| `?` help modal (AdminApp lines 204–226) | ⌘K "shortcuts" row + the footer Kbd hints |
| header date input (line 740) | ⌘K `open day…` / `DayPickerSheet` |
| zenLine pending banner (AdminApp lines 173–181) | **gone** — folded into the statusline tail (§5) |
| day status dot "● published/unsaved" (lines 720–726) | `· saved HH:MM` in StatusLine + RebuildBar state |
| `MarketCard` (line 746) | stays above Z1 as the market line (it is ambient, one line, collapse to a dot) — see 2.1 |

### 1.2 The "invoked, never persistent" rule

**Persistent chrome is exactly five things:** the header tabs, the RebuildBar,
the 44px day rail, the five zones, the statusline. Everything else is invoked:

- **above it** — ⌘K (commands, jumps, days, build/import/publish)
- **beside it** — Sheets (`AIBuildSheet`, `IngestSheet`, `DayPickerSheet`), modal when open
- **in it only while used** — dnd drag handles appear on hover/focus inside a list and
  vanish when the pointer leaves; model chip `×`/`+` appear on hover of the chip row;
  editable-value dashed underlines appear on hover of the value.

The rule's job: **the quiet column stays quiet.** No toolbar rows of action buttons
float over the content. A zone's single primary verb may live inline (publish
thought, publish reflection — they are the zone's reason to exist); supporting verbs
move to ⌘K or a Sheet. If a control would sit on the page for more than the moment
it is used, it does not sit on the page.

### 1.3 ⌘K — the command palette (complete list)

`Command` recipe, dark, mono. Opens with **⌘K** (and `/` when not typing).
Filter-first fuzzy match, ↑↓ to move, ⏎ to run, esc to close. The palette is a
dialog: focus traps, first result autofocused, ⌘K from within a writing surface
returns focus to that surface on close (a thought's half-typed line survives —
publishing later via ⌘⏎ still targets it).

```
⌘K  go
      today                        ⌘T
      open day…                    (DayPickerSheet)
      previous day                 ⌘←
      next day                     ⌘→
      live stream                  ↪ new tab /day/<fmtDay(today)>
      preview this day             ↪ new tab /zen/preview/<date>

⌘K  write
      new thought                  (focus Z2 composer, note type)
      new quote                    (focus Z2 composer, quote type + author field)
      new trade                    (append a collapsed TradeCard at Z4, focus its market)

⌘K  build
      build day from evidence      (AIBuildSheet)
      import trades                (IngestSheet)
      AI draft reflection          (writes the Z5 draft from daySnapshot())

⌘K  jump
      morning check-in · thoughts · habits · trades · reflection

⌘K  publish
      publish reflection           ⌘⏎   (hint below shows why it's disabled: "draft empty")
      rebuild to publish                 (only when pending changes exist)

⌘K  zen
      overview · accounts · coach · media · library · reviews · shortcuts
```

Footer of the palette, always: `{date} · {n} draft change(s) · esc to close` — the
"you are here" datum, in faint.

Group headers are faint uppercase tracking labels; rows are `name` left,
`Kbd` right. The palette itself is `panel` on `bg/80` scrim, 2px radius, the same
hairline grammar as everything else — **the palette is not a rounded glass card;
it is a terminal dialog.**

### 1.4 The 44px day rail (`DayStrip`)

A single vertical strip, 44px wide, on the left of the day column (desktop +
tablet). One square cell per logged day, most recent at top, today pinned
visible. Cell states:

- **no record** — not shown (the rail is only days that exist; `DayPickerSheet`
  covers the rest)
- **record, no trades** — faint 8px square
- **trades** — square whose height scales 8→16px with trade count; fill is
  `up` when ΣR ≥ 0, `down` when ΣR < 0 (data color discipline, §4)
- **today** — 1px accent ring around the cell
- **selected** — `raise` fill
- **hover** — 1px accent border + a left-side tooltip: `08-aug · +1.42R · 4t`

Click = open that day (same `selectDate` dirty-guard as today: if the current day
is dirty, the DayPickerSheet confirm stands in for the native `confirm`).
Arrow keys navigate the rail when it has focus (it is a `listbox`).
On coarse pointers (<768px) the rail becomes a horizontal 44px strip under the
header — same cells, one row, horizontally scrollable.

The rail replaces the mini-calendar *and* the recent-14 list; `DayPickerSheet`
(the month grid + a "jump to YYYY-MM-DD" input) is its overflow. `Sidebar`
recipe is deliberately **not** used — a full sidebar would make the surface
persistent-heavy; the rail is chrome, not furniture.

### 1.5 Sheets

Three Sheet wrappers, all the same anatomy: 420px, right side, `panel` + hairline
left border, header (title + close), body, footer with the single primary action.
Open = 60ms fade (no slide — §4 motion budget). Esc closes; focus returns to the
invoking surface.

- **`AIBuildSheet`** — replaces the capture card. Body: the ephemeral drop zone
  (paste screenshots — read by the AI, never uploaded, unchanged semantics) + the
  free-text field. Action: `build this day →`. While reading: the body becomes the
  progress ("reading everything…"), then the sheet closes and a sonner confirms
  `day built from your evidence — review, override if needed`. The structured
  result lands in the zones exactly as `applyStructured` does today.
- **`IngestSheet`** — wraps the existing `IngestPanel` ritual (approve every
  trade). The proposal table is **TanStack Table v9**: columns `market · dir ·
  entry→exit · pts · risk pts · R · fills · account (select) · dup badge`, row
  select, sticky header, tabular-nums. This is the surface's first and only table.
- **`DayPickerSheet`** — month grid (existing mini-calendar logic, same 12-week
  window) + recent 14 + jump input. Opened from ⌘K `open day…` or the rail's
  overflow.

### 1.6 Sonner

Top-right, dark, mono, 2px radius, hairline border — the terminal's toast, not a
pill. Roles: publish confirmations (`✓ thought published`), AI results
(`day built from your evidence`), and **errors** (`✗ publish failed — the draft
is safe, retry`). The toaster replaces `notify()` in `DayWorkspace` + the custom
toast in `AdminApp`. `role="status"`/`aria-live="polite"` preserved. The RebuildBar
"flash" (`✓ N changes live · view →`) becomes a sonner action-toast.

### 1.7 Keyboard contract (the whole surface)

| Key | Action | Owner |
|---|---|---|
| ⌘K / `/` | palette | shell |
| ⌘T | today | shell |
| ⌘← / ⌘→ | previous / next day | shell |
| ⌘S | autosave now (forces the debounce flush) | shell |
| 1…7 | tabs (unchanged) | shell |
| **⌘⏎ / Ctrl+⏎** | **publish the focused writing surface** | per-surface (§3) |
| esc | close topmost: sheet > palette > editing value | shell |
| ↑↓⏎ | palette/rail navigation | per-widget |
| ⠿ (grab) | dnd reorder | lists |

`isTyping()` guard stays: bare keys never fire while a field is focused; ⌘/Ctrl
combos always fire (that is the point of the modifier).

---

## 2 · The five zones

Order is the owner's new authority: **check-in → thoughts → habits → trades →
reflection.** (Maps to the QA day-page order as: facts≈check-in, moments≈thoughts,
trades, reflection last — the day *ends* on the ritual.)

### 2.1 Z1 · Morning check-in band (`CheckInBand`)

The day's facts as one quiet horizontal strip — same cells `dayFacts()` already
computes (`mood / sleep / screen / mac / habits / R`), each cell a `label` +
value pair, values **evidence-first direct-click editable** (the existing
`editableHint` dashed-underline affordance, unchanged). The band is read-only
feeling; correction is a rare gesture, not a form.

```
morning check-in · fri 08-aug               [capture evidence ▸] [⌘K ▸]
  mood 4/5 · sleep 7.2h · screen 5.1h · mac 3.2h · habits 4/6 · +0.82R
  evidence ▸ (details: screen-time screenshots strip + device notes)
```

- `capture evidence ▸` — opens `AIBuildSheet` (the single, quiet entry to the
  build ritual; the verb is always reachable, never loud).
- `evidence ▸` — a `<details>` under the cells holding the screen-time screenshot
  strip + device notes + sleep note (the proof artefacts; collapsed by default).
- The market line (current `MarketCard`) renders as a single ambient line above
  the band: `market ● open · closes in 3h 12m · next 20:30 cpi ▸` — collapsed
  to one line, expandable. It stays because the market is the master clock; it
  shrinks because it is *context*, not the surface.
- New day, nothing logged: the band renders `—` cells and the empty-state line
  from §4.

### 2.2 Z2 · Thoughts surface (`ThoughtsSurface`)

The day's stream, fast and low-ceremony. Top: the composer (one growing textarea,
placeholder `what happened — ⌘⏎ publishes`). Below: **draft** moments (private,
warn-tinted border, `not public`) then **published** moments (the `MomentCard`
rows: `at · type glyph · text · images`; trade moments reference `tradeIdx`
exactly as today).

```
thoughts (3 live · 1 draft)
  ┌──────────────────────────────────────────────────────────┐
  │ what happened — ⌘⏎ publishes                              │
  └──────────────────────────────────────────────────────────┘
  draft — not public
  ⠿ 08:31 · note  "flagging the tape — news at 20:30"   [publish →][polish][×]
  live — public after rebuild
  ⠿ 08:12 · · "what the tape did at the open…"      [×]
  ⠿ 07:58 · ▲ trade 1 · orb-drive · +1.25R          [×]
```

- Composer publish: **⌘⏎** (or the composer's own `publish →`) — creates the
  moment and moves it draft→live. A publish of a thought **is** the stream update
  (`/day` + `/stream` show it after rebuild); no separate "add to stream" step.
- Type selector: a 3-chip segmented control in the composer's footer
  (`note | quote | trade`) — quote reveals the author field, trade reveals a
  trade picker (the existing `tradeIdx` select). The composer defaults to `note`.
- `polish` stays (AI polish edits the draft text only, unchanged); the result is
  a sonner `polished — review it, then publish`.
- Draft list and live list are both **dnd reorderable** (⠿ handle, hover/focus
  only); published order = the order `resolveMoments` renders.
- Empty: `nothing on the stream yet — the day starts with one line.` (faint +
  the one actionable verb).

### 2.3 Z3 · Habits row (`HabitRow`)

One slim row between thoughts and trades — the owner's order. The existing
habit chips unchanged in behavior (toggle bool; count-habits show `value` and
increment), refined in skin: 28px chips, `raise` fill, done = the habit's color
fill with `bg` text (as today), label in `dim`→`ink` on hover.

```
habits  [quiet-time][read 30][no-scroll][meditate]
```

Empty: `habits are defined in zen · library.` — click jumps to the library tab.

### 2.4 Z4 · Trades accordion + the multi-model `TradeCard`

Header line: `trades (3) · +0.82R` + a quiet `+ trade` (⌘K `new trade` too).
Rows are a vertical accordion; drag handle ⠿ on each row (hover/focus) for
reorder. **dnd-kit**; the drag preview is the row at 60% opacity, drop = 60ms
fade. Collapsed/expanded below.

**Collapsed (the everyday glance):**

```
▸ ▲ MNQ  [orb-drive][vwap-reclaim] +1  · ny-am        +1.25R · +4.5pts   ⠿
```

- `▸/▾` chevron — the accordion affordance (the only affordance that is *always*
  visible; everything else on the row is data)
- `▲/▼ MNQ` — direction + market (15px, ink)
- **model chips — up to 2, then `+N` overflow** (`[orb-drive][vwap-reclaim] +1`
  means three models attached). Chips are `Badge variant="accent"`, 11px.
- `· ny-am` session (dim) — **setup is demoted out of the collapsed row** (it
  moves to the expanded tag row); the collapsed row shows session only
- R + points right-aligned, tabular-nums, `up`/`down`/`dim` by sign (the color
  discipline, §4)
- ⠿ drag handle — hover/focus only

**Expanded:**

```
▾ ▲ MNQ                                        +1.25R · +4.5pts · −$127
  [orb-drive ×] [vwap-reclaim ×] [meander ×] [+ add model ▾]
  commentary — what made this one count
  ┌────────────────────────────────────────────────────────────────┐
  │ news reversal — reclaimed the VWAP band and held the open…     │
  └────────────────────────────────────────────────────────────────┘
  entry 20800.5 · stop 20795 · exit 20812.5 · risk 5.5 · pts 12
  setup orb · session ny-am · direction long · confidence 4
  executions  lucid-50k-a ×1 · tpt-25k-a ×2
  charts  [▣][▣]                        (paste this trade's chart →)
```

The expanded body, top to bottom, in order of *what the owner reads*:

1. **model chip row** — every attached model as a removable chip (× on hover;
   Delete key removes the focused chip). `+ add model ▾` opens a `Popover`
   listing the models not yet attached — each row is the model name + its
   **premise one-liner** (from the `models` collection), so the attach decision
   is informed. Hovering an attached chip shows the same premise in a tooltip.
   Max sensible: 4–5; the collapsed `+N` handles the rest.
2. **commentary** — promoted to the primary field of the expanded card
   (it is the published voice of the trade; the current layout buries it).
3. **the numbers** — entry/stop/exit/risk/pts on one tabular-nums line, each
   direct-click editable (evidence-first, unchanged).
4. **the tag row (demoted)** — setup · session · direction · confidence as small
   selects, visually secondary (the owner said: setup demoted, commentary promoted).
5. **executions** — account × size rows (unchanged behavior).
6. **charts** — screenshot strip + paste zone (unchanged behavior, `onTradeScreens`
   keeps reading values off the chart via the vision model).

**Schema: `model: string` → `models: string[]`.**

- `src/content.config.ts` trade: add `models: z.array(z.string()).default([])`;
  keep `model` optional (back-compat read).
- Read path (`/api/admin/days` GET + `DayWorkspace` load): `models ?? (model ? [model] : [])`.
- Write path (POST): persist `models` (trimmed, deduped, order-preserving).
- `src/lib/stream.ts`: `DayTrade.models?: string[]`, `ResolvedMoment.trade.models` — `ROf`/`riskOf` untouched.
- **Public rendering — all chips:** `DayArchive.astro` renders `t.models.map(Badge)`
  (replaces the single `t.model` Badge at line 95); `MomentCard.astro` shows
  `models.join(' · ')` (replaces `moment.trade.model ?? setup`).
- `src/lib/models.ts` + `src/lib/period-stats.ts`: iterate `t.models ?? []` — a
  trade tagged to N models contributes to all N models' lists and sums. Correct
  semantics: "R when I traded model X" is true for both tags; a shared-setup
  trade appearing in two model pages is right, not a bug.
- `toDayData` in `src/pages/api/admin/reviews.ts` mirrors the read fallback.

### 2.5 Z5 · Reflection zone (`ReflectionZone`)

The ritual — deliberately the most *ceremonial* surface on the page. Anatomy:
a zone header carrying the **obligation chip** (§5), then title/summary/tags as
one small demoted row, then the writing surface (MarkdownEditor, unchanged), then
a single quiet action row (`AI draft from today` · `⌘⏎ publish reflection`).

```
reflection — the end-of-day ritual              [due tonight 03:00 ▸]  ← obligation chip
  title [……]  summary [……]  tags [……]
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │   the day in prose. 15px / 1.8. the one calm surface on the page.    │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
  [AI draft from today]   publish reflection  ⌘⏎
```

- **Publish = `⌘⏎`** (focused editor) or the publish button. It writes
  `journal/<date>.mdx` exactly as `publishReflection` does today (title/summary/
  tags/featured + body), queues the change, sonner `reflection published — queued
  for rebuild`.
- `AI draft from today` stays (same `runDraft`/`daySnapshot()` semantics).
- The `● published to /journal` status line stays inside the zone (below the
  header), faint `up` when the draft matches live.
- Ceremony cues, concretely: the zone is the widest on the page; the editor body
  is the only place 1.8 leading exists; the obligation chip is the only colored
  element in the header; the publish action is the only primary button on the
  page. **Restraint is the ceremony.**

### 2.6 The statusline (`StatusLine`)

The page's only bottom chrome — one hairline strip, one line, faint by design
(§4: `faint` is the ambient token). Never a button bar.

```
2026-08-09 · +0.82R · 3t · habits 4/6 · ⌘⏎ publish · saved 22:41      reflection due tonight ▸
```

Left: the day readout (date · R · trades · habits — the four numbers the owner
lives by, tabular-nums). Middle: `⌘⏎ publish` (a Kbd affordance that appears
only when the focused writing surface has content) and `· saved HH:MM` (autosave
confirmation, §3). **Right tail: the obligation** — one, nearest first
(`reflection due tonight` / `week 33 review due sun` / `Q3 review due tue` /
`H1 review due thu` / `year review due fri`); past grace it reads
`… overdue` in `down` with a soft 2s pulse (§5). The tail is a link:
daily → scrolls to Z5; period → switches to the reviews tab with that anchor
preselected. Hover brightens `faint → dim`; nothing else moves.

---

## 3 · The two writing surfaces

Thoughts and reflection are **separate entities with separate state and separate
publish actions** — the schema already separates them (`draft.moments` +
`stream[]` vs `draft.reflection` + `journal/`), the UI now treats them as the two
temporalities of the day.

| | **Thoughts (Z2)** | **Reflection (Z5)** |
|---|---|---|
| rhythm | many/day, throughout the day | one/day + period rungs |
| ceremony | low | high — framed, calm, last |
| unit | a moment: text + images | prose: body + title/summary/tags |
| publish target | `stream[]` (→ `/day` + `/stream`) | `journal/<date>.mdx` (→ `/journal`) |
| publish gesture | ⌘⏎ in the composer | ⌘⏎ in the editor |
| draft state | `draft.moments` (warn "not public") | `draft.reflection` |
| autosave | debounce 2s idle + blur → `· saved HH:MM` | same |
| empty state | `nothing on the stream yet — the day starts with one line.` | `no reflection yet — due tonight.` |
| urgency | none — ephemeral, replaceable | the obligation — the ritual |

**Shared contract (both):**

- **⌘⏎ publishes the focused surface.** `(metaKey||ctrlKey)&&Enter`, with the
  `isTyping()` guard inverted: it fires *only* when a writing surface is focused,
  and ⌘K never steals it (modifier combos bypass the guard, as today).
  macOS shows `⌘⏎`, elsewhere `Ctrl+⏎`; the Kbd hint renders the platform form.
- **No save / save & rebuild buttons anywhere on the page.** Autosave (2s idle
  debounce + blur) persists the draft to the day record and stamps
  `· saved HH:MM` in the statusline. Publication is a *separate, explicit*
  gesture (publish thought / publish reflection / RebuildBar rebuild) — the
  draft-vs-live distinction the owner built stays intact; only the ceremony of
  saving changes.
- Publish errors are **sonner** (`✗ publish failed — the draft is safe, retry`),
  never inline banners.
- Both surfaces remember focus across sheet/palette excursions (close ⌘K → back
  in the half-typed thought).

---

## 4 · UX-PRINCIPLES — the craft layer

The rules that make the surface feel considered. An implementer should be able
to ship from this section alone. These are *locked* — the owner's "everything a
thing of awe and beauty" is delivered here, in restraint.

### 4.1 Type

- One face: **JetBrains Mono Variable** everywhere in zen. Syne is the wordmark's
  alone. There is no second face — the variety comes from size/weight/tracking.
- **Writing is 15px / 1.8** (the `.prose` rhythm, the only 1.8 on the page) —
  thoughts composer and reflection editor share it. Data is 12–13px at 1.0–1.3.
- **Labels are 11px uppercase, tracking 0.14em, `dim`** — the site's voice.
  Never wrap (`whitespace-nowrap`); never exceed ~14 chars.
- Zone headers: 12px uppercase tracking-widest, `soft` (the current
  `text-2xs` card-title voice, promoted to a full-width hairline-slash).
- **Numbers are always `tabular-nums`** — tables, the R column, the statusline,
  the rail tooltips. No exceptions.

### 4.2 Spacing

- A strict **4px grid**. The page rhythm: zone gap 32 (`space-y-8`), intra-zone
  16, card padding 16, chip 28px tall, row hit target 36–40 (fine) / 44 (coarse).
- The page reads as **stacked slabs separated by hairlines** (`border-line` 1px)
  with generous breathing; never a wall of boxes. Zones are not cards — they are
  sections divided by hairlines, and only the reflection frame and sheets are
  `panel`-raised. The quiet column stays flat (`bg`).

### 4.3 Color — each token has exactly one job

| token | job |
|---|---|
| `bg` | the void — page, inputs, chips' rest |
| `panel` | raised surfaces — sheets, palette, reflection frame |
| `raise` | hover fill + selected day cell |
| `line` / `line2` | hairline hierarchy — structural 1px / interactive edge |
| `ink` | the one readable text |
| `soft` | body copy |
| `dim` | labels, meta |
| `faint` | ambient only — statusline, empty states, ghost affordances. **A `faint` element is never a CTA.** |
| `accent` | **one job: interactive focus** — focus rings, active tab, dashed editable-underlines, selected/emphasized day cell, model chips. Not decoration. |
| `up` | the good state — positive R/pnl, `published`, obligations *done* |
| `down` | the bad state — losses, delete, build failure, *overdue* |
| `warn` | the pending state — unsaved, in-grace due, draft moments |
| `purp` | reserved: AI-generated content markers (AI draft, polished text) — rare |

Rules: **color is data or state, never decoration.** No gradients in zen (the
starfield stays on the public theme; the instrument stays flat). Profit is
`up` everywhere and never green-for-negative (this kills the Phase-4 money-color
bug class by construction). Chips for state: a model chip is `accent`-edged
(interactive data), a done-obligation chip is `up`-textured-faint (state).

### 4.4 Micro-interactions

- **Hover**: edges re-color (`line2`→`accent`, `dim`→`ink`), 120ms ease.
  Nothing moves, scales, or slides on hover.
- **Press**: `raise` fill, no bounce.
- **Focus** (global): `:focus-visible` = 2px `accent` ring, offset 2px, on every
  keyboard-reachable element. Never `outline: none` without a replacement. Focus
  rings are the only accent allowed to touch data rows.
- **Editable values** (evidence-first): dashed `line2` underline →
  `accent` on hover, `cursor: pointer`, `title="click to correct"` — the current
  `editableHint`, unchanged, everywhere a value is overridable.
- **The caret**: native caret, `caret-color: accent`, on the two writing
  surfaces. No fake blinking block cursors — the owner retired `▋`.

### 4.5 Empty states

Crafted, one line, faint, terminal voice, always ending in the one actionable
verb. Never "no data".

```
thoughts   nothing on the stream yet — the day starts with one line.
trades     no trades — paste charts or ⌘K "new trade".
reflection no reflection yet — due tonight.
habits     habits are defined in zen · library.
```

### 4.6 Motion budget — exactly three moments

1. **the caret** (native blink — not ours)
2. **the due-pulse** — soft 2s opacity pulse (the existing `tape-pulse`
   keyframe), *only* when an obligation is past grace
3. **one 60ms fade** — the single transition used for sheet open/close, palette
   open/close, sonner enter/leave, dnd drop, accordion expand/collapse.
   Opacity only. **No slide, no scale, no stagger, no scroll-triggered entrance.**

The surface is an instrument: it responds, it never performs. `prefers-reduced-motion:
reduce` turns all three off; the due-pulse's *state* survives as color
(`down` text), never motion alone.

### 4.7 The feeling of a well-made tool

44px hit targets on coarse pointers (already global in zen), 36–40 on fine;
labels never orphan; hairlines sit on the 4px grid; every list is keyboard
navigable; every dialog traps focus and returns it; every number is tabular;
the statusline is the only bottom chrome; the quiet column stays quiet. The
test of the surface: **at any moment, the owner can say where their eyes should
go** — and the answer is the thing they were writing.

### 4.8 AI ghost-text writing assist (IN SCOPE)

The writing surfaces (thoughts composer + reflection editor) get inline
next-word suggestions — the muted-gray "autocorrect on steroids" the owner
saw in modern writing panels. A suggestion is a few words ahead of the caret
in dim non-italic mono; **Tab accepts, Esc dismisses, any diverging keystroke
kills it**. It is a caret-position overlay on the *existing* native textarea
(`MarkdownEditor.tsx` — the DOM contract, value/onChange, autosave, paste-sink,
preview tab are untouched; the overlay is an additive sibling).

**Mechanics (verified against the current stack):**

- **Rendering** — `textarea-caret-position` computes the caret's pixel
  coordinates; an absolutely-positioned `pointer-events-none` overlay div
  renders the suggestion there. Non-italic (italic is a serif convention — in
  mono it looks broken), `faint`/~50–60% opacity, optional hairline start
  underline. **The native caret stays solid** — never hide or dim it.
  `aria-hidden="true"` — decorative until accepted.
- **Streaming** — mandatory. `orChat()` in `src/lib/ai.ts` is non-streaming
  today; add `orChatStream()` (~30 lines, same headers/env, `stream: true`,
  `res.body.getReader()` loop) + an Astro route `POST /api/admin/complete`
  (zen-session auth, re-emits text deltas) + `eventsource-parser` (handles
  OpenRouter's `: OPENROUTER PROCESSING` comment lines and mid-stream errors).
  First word lands in <1s; the rest fills in. Non-streaming = a dead 1–3s
  pause = the difference between "beautiful" and "laggy".
- **Trigger** — ~500–800ms typing pause, min ~10 chars, prose-line gate only:
  never on prices/numbers (`20800.5`), `MNQ` ticker lines, markdown fences,
  URLs, or mid-typo-burst. Request carries `max_tokens` ~40–60 + `stop:
  ["\n\n", "```"]`. Abort on dismiss (DeepSeek supports cancellation — no
  wasted tokens).
- **Model + cost** — DeepSeek V3 (`deepseek/deepseek-chat`, the current
  `modelAssist()`), streaming via the existing OpenRouter wiring. ~$0.01/day
  at the owner's writing volume. Cost is a non-issue; latency is the only
  constraint, and streaming solves it.
- **Accept keyboard** — Tab accepts (the universal convention: Cursor,
  Copilot, Google Docs Smart Compose). Esc dismisses. Caret-move / blur /
  diverging keystroke dismiss + abort.
- **Autocorrect/spellcheck** — none. The AI continuation *is* the correction
  (the typo is in the prompt, the continuation is clean). Set
  `spellcheck="false"` + `autocorrect="off"` on the textareas so the OS
  doesn't inject red underlines into the mono surface.
- **Default ON with a quiet toggle** — the owner asked for this explicitly in
  the writing surfaces. A single quiet toggle in zen settings; no "AI"
  branding, no nudge wall — just gray text.
- **Motion budget impact** — none. No fade/anim on the suggestion; the §4.6
  budget (caret blink, due-pulse, 60ms sheet fade) is unchanged.

**Not using:** `@copilotkit/react-textarea` (legacy v1, Slate-based — swaps
the native textarea DOM the autosave/paste-sink depend on), TipTap/ProseMirror
(overkill for a plain-markdown surface), Vercel AI SDK (saves ~40 lines of
plumbing, costs a protocol dependency), autocorrect libs (`typo-js`/`nspell`
— Hunspell-style red-squiggle, fights the aesthetic).

---

## 5 · The reflection obligations timeline

From `src/lib/accountability.ts` — five rungs, each a duty with a grace:

| rung | due | after grace |
|---|---|---|
| **daily** (Mon–Fri) | reflection by **03:00 HKT next day** | `reflection overdue` |
| **week** | Mon–Fri week review by **Mon 03:00 HKT** | `week 33 review overdue` |
| **quarter** | review by **03:00 HKT day after end** | `Q3 review overdue` |
| **H1** | review by 03:00 day after end | `H1 review overdue` |
| **year** | review by 03:00 day after end | `year review overdue` |

(Reuse `accountabilityStatus()` + the `copy.ts` fragments verbatim; the surface
renders, it does not re-derive.)

**Surfaces:**

- **Statusline tail** — the single nearest obligation, one phrase, `faint`.
  In grace: plain. Past grace: `down` + the 2s pulse. Click → daily scrolls to
  Z5; period switches to the reviews tab with the anchor preselected.
- **Z5 header chip** — the same obligation, contextual to the zone:
  - due: `due tonight 03:00` (warn — the ritual is expected)
  - past grace: `overdue` (down + pulse)
  - **done: `· fri` in faint `up`, relaxed** — no pulse, no ring, just the
    quiet green of a finished duty. The chip for the week rung reads
    `week 33 · done`, etc.
- **"Done" definition** — daily: a `journal/<date>.mdx` exists (the existing
  `content.trim()` check). Period: a review note exists for the anchor (the
  `notes` set in accountability). Drafts never count; only publication clears
  the duty.

---

## 6 · Component inventory

**New, day-surface-specific** (all in `src/components/admin/`):

| component | one-line responsibility |
|---|---|
| `DayStrip` | the 44px day-dot rail — per-day cells, today ring, hover tooltip, arrow-key nav |
| `CheckInBand` | Z1 — dayFacts cells, direct-click override, evidence `<details>`, capture entry |
| `ThoughtsSurface` | Z2 — composer + draft/live moment lists, type segmented control, publish, dnd |
| `HabitRow` | Z3 — the habit chip row (bool/count, done fill) |
| `TradeCard` | Z4 — the multi-model accordion row: collapsed glance + expanded editor |
| `ModelChipRow` | the chip strip inside TradeCard — attach Popover, premise tooltip, remove, `+N` overflow |
| `ReflectionZone` | Z5 — obligation chip header, title/summary/tags, editor, publish |
| `StatusLine` | the page footer — day readout, ⌘⏎ hint, `saved HH:MM`, obligation tail |
| `CommandPalette` | ⌘K — the full command list (§1.3), fuzzy filter, Kbd affordances |
| `AIBuildSheet` | the capture ritual: ephemeral paste → structure → apply + sonner |
| `IngestSheet` | the import ritual: existing IngestPanel on a TanStack Table |
| `DayPickerSheet` | month grid + recent 14 + jump input (the rail's overflow) |
| `GhostText` | §4.8 — caret-position overlay on the textareas: suggestion render, Tab-accept, Esc-dismiss, abort-on-diverge |
| `useGhostText` | §4.8 — the hook: debounce + prose-line gate + abortable streaming fetch + keyboard contract |
| `orChatStream()` | `src/lib/ai.ts` — streaming variant of `orChat` (same headers/env, `stream: true`, reader loop) |
| `POST /api/admin/complete` | Astro route — zen-session auth, re-emits OpenRouter text deltas to the client |

**Reused from the planned shadcn-style batch** (native chrome, not wrappers):
`Command` (palette), `Sheet` (the three sheets), `Sonner` (toasts), `Badge`
(model chips), `Kbd` (shortcut affordances), `Field` (the demoted tag-row
fields), `Popover` (model quick-add), `Empty` (the crafted empty states),
`@dnd-kit` (trade/moment reorder), TanStack Table v9 (ingest proposals).

**Deliberately not used:** `Sidebar` (the rail is chrome, not furniture — §1.4),
`DropdownMenu` (⌘K + inline controls cover every action; a right-click menu is
furniture), react-colorful/emoji picker (library-tab chrome — the recipes ship
with the batch, not this surface).

**Retired:** the sticky section-jump bar, the 210px aside, the capture card, the
inline IngestPanel, the header/footer save buttons, the custom toast, the `?`
help modal, the zenLine banner, the header date input.

---

## 7 · Build-order note (for the executing agent)

1. **Batch first** — the recipes (Command/Sheet/Sonner/Badge/Kbd/Field/Popover/
   Empty/Table/dnd) are the foundation; the surface is built on them.
2. Schema: `models` migration (read fallback first, write new shape).
3. Shell: rail + statusline + ⌘K (the persistent skeleton).
4. Zones bottom-up: HabitRow → CheckInBand → ThoughtsSurface → TradeCard →
   ReflectionZone (each independently shippable + typecheckable).
5. Sheets last (they wrap existing rituals).
6. **Ghost-text** (§4.8): `orChatStream()` + `/api/admin/complete` →
   `useGhostText` + `GhostText` overlay → gate into `MarkdownEditor`
   (covers both thoughts + reflection). The quiet toggle lands with it.
7. Each step: `npm run typecheck`; public renderers (`DayArchive`/`MomentCard`)
   updated in the same commit as the schema change.

**Verified against current code:** AdminApp.tsx (shortcuts/tabs/toast/help/
banner), DayWorkspace.tsx (zones/save/publish/editing), ui.tsx (Field/Button/
Card), RebuildBar.tsx (pending/rebuild/flash), api.ts (bus/notify/rebuild),
accountability.ts (rungs/grace), stream.ts (`model`→`models` touchpoints),
copy.ts (obligation fragments), app.css (tokens/type/prose/zen hardening),
content.config.ts (trade schema), DayArchive/MomentCard (public chips).
