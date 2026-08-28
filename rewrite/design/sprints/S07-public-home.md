# S07 — Public home

Goal: visitor gets the point in 5 seconds and the whole process in 30.
Data first; the site explains itself through its content.

## Scope
`design/mocks/public/index.html`:

1. Masthead: wordmark + one-line thesis + live pulse (trader-live) +
   market day state — one line, not a paragraph block.
2. **Today card**: facts strip (mood/sleep/device/habits/trades/day R),
   news events, CME state — the at-a-glance contract.
3. Stream: today's thoughts/quotes/trades as published cards w/ rails;
   images lightbox via native dialog.
4. Equity sparkline + R histogram strip (server-SVG style) linking to
   /performance.
5. Footer: RSS, models/rules links, colophon line. No /zen link anywhere.
6. Empty-today state: falls back to last logged day gracefully.

## Acceptance checklist
- [x] 5-second test: live status + up/down readable instantly on iPhone
      (market strip + day-r hero above the 844 fold — gate-asserted)
- [x] zero framework JS; lightbox = <dialog> only
      (vanilla: theme.js + feedback.js house exceptions, lightbox native dialog)
- [x] Lighthouse-bait patterns avoided (no layout shift, sized media boxes)
      (all stream media width/height'd + loading=lazy; charts are static svg)
- [x] green/red appears ONLY on data values
      (pulse/market dots on the accent ladder — gate-asserted; divergence
      from zen's up-hue live dots documented in DECISIONS)
- [x] board + resume protocol followed

## Out of scope
Archive/performance pages (S08).

## Session log

- **C14 · r0 shipped live** — `/public/` on frozen S00 only (+ `st/css/public.css`
  public layer). Masthead one-liner (pulse + wordmark + thesis + cme chip, accent
  dots per the sprint's green/red-only-on-data discipline — deliberate divergence
  from zen's up-hue live dots, flagged for owner). Today card: day-r hero (the one
  green on first paint) + 5-cell facts strip (3-col on phone, no truncation) +
  news rows (red/orange impact dots, stem-dedupe, T-15m seconds) + cme day %.
  Perf strip: static server-SVG-style equity + daily-r charts (generated fixtures,
  token-hued classes — chromatic-invariant). Stream: 9 cards on a timeline rail
  (trade nodes accent-ringed), native-dialog lightbox, sized media boxes.
  `?day=empty` pins the graceful thu-27-aug fallback; `?at=` freeze ported.
  CME engine ported from the frozen frame — diff-verified after a hand-typed
  easter() TDZ crash proved the C13 lesson again. Gates: none yet (pre-freeze);
  probes: zero pageerrors, lightbox opens, countdown grammar scan clean.
- **C14 · standing gate shipped** — `_verify/public.gate.cjs` (67 checks, lib.cjs
  harness, live-URL) joins zen/composer/today/rituals/evening/secondary as the
  regression bar. Covers: chrome-discipline color asserts (pulse/market dots
  never up/down; spark/r-chips/dir-chips/news dots only data hues), countdown
  grammar incl. T-15m seconds + past-row silence, news stem-dedupe, sized lazy
  media, native-dialog lightbox open/Esc, 44pt targets (perf link, footer
  links, shots) desktop + 390, day-r above the fold on iPhone, ?day=empty
  fallback contract, ?at freeze honesty (open / weekend / early-close +
  short-session "closes 03:15 hkt" honesty). CANON FINDINGS (frozen-engine
  parity, probe-caught, logged for S09/DECISIONS-at-freeze): holidays produce
  no bounds so a holiday Monday reads "cme · closed · weekend" (the
  "cme · holiday" label branch is dead in the frozen zen frame too), and the
  frozen holiday table has no labor day (real CME early-closes it) — the
  engine says "open" on labor day by construction. Not amended (frozen; port
  is by-diff faithful).
- **C14 · r1 — masthead became a real header** (owner: "where is the system
  theme switcher / main market clock / upcoming news / main menu navigation").
  Shipped live + gated (79/79): theme seg (auto/light/dark, theme.js self-wires,
  persists) in the brand row; nav rail (today · news · performance · models ·
  about — in-page anchors + S08 urls, scrollable on phone, 44pt links); market
  strip = the main clock (accent dot · cme state · day % · close countdown ·
  next upcoming news event w/ countdown · hkt wall clock) — the tiny mkt chip
  is deduped away; today-card keeps its local cme context line. Phone: strip
  stacks (state line, then next+clock) so the clock never clips. Public stays
  zero-JS beyond theme.js + feedback.js + lightbox — nav needs no hamburger.
- **C14 · FROZEN at r1** by owner direction ("just lock and wrap up" on live
  r1). Pre-freeze sweep clean: zero annotator notes on /public/, nothing fresh
  anywhere mine. Acceptance checklist green (above); public.gate.cjs 79/79 vs
  live. One stale S01-era note pair remains on /zen/ (red band markers —
  addressed by the S01 r2.x revisions, notes predate that freeze) — left
  untouched, notes are never deleted. Residual knick-knacks → S09 polish pass
  (dead "cme · holiday" label branch, missing labor day in the frozen cme
  table, sessions-rail NYC clip). Program moves to S08 (public rest).
