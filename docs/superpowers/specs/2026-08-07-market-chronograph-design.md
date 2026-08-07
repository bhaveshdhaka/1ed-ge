# Market Chronograph + Day-Events Design

**Status: approved (owner, 2026-08-07) → in implementation**

**Owner decisions locked in:** now-marker = caret + live clock; severity dots ON the
chronograph rail; news icons = completed emoji set + generic fallback (no Lucide
migration); day header = 3-letter weekday + **pipe separator**: `mon | 07-aug-2026`; day
panel = separate panel below the market widget.

---

## Goal

Make the market widget's time rail a distinctive "chronograph" — a flattened watch
face: tick markings on the line, hourly plots on wide screens, fewer on small
devices, a unique now-marker (no more green dot), and events plotted on the rail.
Countdowns under 15 minutes tick with seconds (mm:ss). Every news row carries an
icon; elapsed events stay on the day, dimmed + struck, for posterity. The homepage
day header gains the 3-letter weekday, and a new "the day" panel shows the CME
day-type (full / early close / closed) plus that day's red/orange events.

## Global Constraints

- **Public pages stay zero-JS** except the single Lightbox `<dialog>` script. The
  chronograph rail is server-rendered; the existing `setInterval(render, 1000)`
  loops in MarketWidget/MarketLive already tick — they are the only runtime JS on
  those surfaces (pre-existing, allowed).
- **Design system:** use `@theme` tokens from `src/styles/app.css` + `ui/*`
  primitives (Dot, Icon, Badge, Tag…). No arbitrary values (`text-[13px]`, hex
  literals) in new code. Tokens: `--color-up/down/warn/accent/line/line2/faint/
  dim/soft/ink/bg/panel/clay`.
- **CME Globex is the master clock** — day status from `cmeDay()`/`marketMarker()`
  (`src/lib/market.ts`); never present NYSE as "market open".
- **R is computed, never stored** — untouched by this work.
- **News stays zero-inference** — verbatim rows, `[TV]`/`[FF]` badges, `✦`
  verified. This work only ADDS icon coverage and a visual past-state; it never
  merges or re-levels rows.
- Money colors by sign; hazard dot = clay (`--color-clay`), severity dot = down
  (red) / warn (orange) — the existing news language.

## 1. The chronograph rail (MarketWidget)

Replace the current hairline + `.now-dot` + 13 floating labels with a
chronograph-style horizontal rail:

```
✕      ●      ●  now 14:32:07 hkt
──┬─┬─┬─┬─┬─┬─┬─┬─┼─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬──
 00    03    06    09    12    15    18    21   24
```

- **Ticks on the line:** every hour = short tick; every 6h (00/06/12/18/24) =
  tall tick with label. Responsive: wide (lg+) renders all 24 hour ticks; small
  screens render fewer (major 6h ticks + every-2h minor), via responsive CSS
  classes on a server-rendered 24-tick array — no JS.
- **Events plotted on the rail:** each red/orange event is a severity dot at its
  HKT time (left = `time/24 * 100%`), above the rail. Past events fade
  (opacity down); the NEXT event's dot gains a subtle pulse while its countdown
  is under 15 min (chronograph "alert" feel). Zero extra JS — the existing
  `render()` loop positions the now-marker; dot past/future state is
  server-rendered at build/SSR.
- **Now-marker — NO green dot:** a vertical hairline with a small caret on top
  + a live digital readout `HH:MM:SS hkt` riding beside it, accent-colored
  (`--color-accent`), moving every second (the existing `data-now-marker`
  position update already ticks; add the readout to the loop).
- The session-state rail tinting is **out of scope** (keep the line neutral).

## 2. Countdown seconds (mm:ss under 15 minutes)

Every live countdown < 15 minutes renders chronograph-style `m:ss` (e.g. `04:32`)
instead of `4m`; ≥ 15 min keeps the current `1h 34m` / `34m` form. Applies
consistently wherever countdowns tick:

- MarketWidget session rows ("closes in"), next-event row, speaker row.
- MarketLive site-wide ticker (`[data-mkt-live]`).
- MarketFooter countdowns.

Implementation: update the `fmtHuman` formatting in the three inline scripts
(MarketWidget, MarketLive, MarketFooter) AND the server-side `fmtHuman` in
`src/lib/strip.ts` to a shared rule — seconds shown when the remaining time is
< 900s. The strip.ts comment says "no phrase logic duplicated in inline JS" —
formatting lives in the payload via `until`; the duplication that exists is the
`fmtHuman` helper itself. Prefer a single canonical implementation where the
server payload already carries the countdown target; the inline copies stay
(they are pre-existing) but adopt the same mm:ss rule.

## 3. News rows — icon on every row + past-state (posterity)

- **Every row gets an icon.** Complete `EMOJI_RULES` in `src/lib/market-news.ts`
  so categories already present (payrolls 💼, unemployment 👥, CPI 🛒, crude 🛢️,
  Fed/speeches 🗣️, GDP 🏭, housing 🏠, retail 🛍️, PMI 🏭, sentiment 💬, treasury 🏦,
  trade ⚖️, income 💵) cover all titles, and add a **generic fallback** (e.g. 📰)
  for anything unmatched — `newsEmoji()` must never return `''`.
- **Past events stay for posterity.** `NewsBlock` gains an optional
  `dayIso`/`now` reference: an event is *past* when its HKT datetime < now.
  Past rows render **dimmed + struck through** (text-line-through, faded dot,
  icon kept, time kept) — never removed, always time-ordered. Future rows stay
  normal. Applies everywhere NewsBlock renders (MarketWidget "USD news · all
  today" details, day pages, calendar, and the new homepage day panel).
  - Homepage (SSR): fresh `now` per request.
  - Static day pages: `now` freezes at build; a past-day archive is entirely
    dimmed (correct), today's page may lag until the next rebuild (documented
    limitation).

## 4. Homepage — day header + "the day" panel

- **3-letter weekday on day labels:** add `fmtDayW(iso)` (or extend a display
  helper) in `src/lib/dates.ts` → `mon | 07-aug-2026` (3-letter weekday, pipe
  separator, no comma). Use it on the homepage `/ today` header, the `/stream` "today so far" header, day-page day
  headers, and the MarketWidget header date (replacing the current non-padded
  `prettyDate` "7 aug 2026"). URL slugs keep `fmtDay` (`07-aug-2026`) — slugs
  never change. Compact inline links (MomentCard day links) keep `fmtDay`.
- **"the day" panel** (new, homepage, below the MarketWidget): a second panel
  titled `the day · {fmtDayW(iso)}` containing:
  - **Day-type line** from `cmeDay()`/`marketMarker()`: `● open · full day`
    (up) / `◐ early close 1:15pm ct` (warn) / `✕ closed · holiday` (down),
    consistent with the existing market-marker vocabulary.
  - **That day's red/orange events** (NewsBlock with icons + past-state) — the
    posterity picture. Empty state: quiet line `no USD red/orange events today.`
  - No news duplication with the widget: the widget keeps its live countdown
    rows ("next event", speaker); the panel is the full day list.

## 5. Design-system + lightbox hardening

- All new markup uses tokens + primitives. Lightbox already token-based; fold in
  the two deferred review findings: `if (!body) return` null guard and
  `e.target instanceof Element` check in `Lightbox.astro`'s inline script.
- DayArchive trade screenshots gain `data-lb` (same chart opens in the lightbox
  from both MomentCard and the archive) — deferred minor from the moment-images
  review, folded here.

## Out of scope

- Session-state rail tinting.
- Lucide icon migration for news categories (emojis stay — owner decision).
- Anything in the admin DayWorkspace (moment-images final fixes already shipped
  separately, commit 76a0644).
- Newsletter/weekly review surfaces.

## 6. Same-time event grouping (owner amendment, 2026-08-07)

When multiple red/orange events share one HKT time slot, show ONE representative
(the most important: red beats orange; first-in-source within a kind) with the
rest collapsed under it (`+N more at HH:MM`, expandable, native `<details>` —
zero-JS). Applies inside NewsBlock (so every surface inherits it: widget details,
footer, day pages, calendar, the-day panel) and the chronograph rail's event dots
dedupe to one per slot (red priority).
