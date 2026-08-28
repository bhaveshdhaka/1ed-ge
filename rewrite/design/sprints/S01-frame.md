# S01 — Zen frame (cockpit chrome)

Goal: the shell the trader lives inside all session. Clock/calendar is a
first-class citizen here — this is where iteration time goes.

## Scope
`design/mocks/zen/index.html` (+ partials as needed):

1. Top bar: brand mark · CME day state (open/closed/holiday w/ next-change
   countdown) · session band strip (Asia/London/NY as compact timeline) ·
   live pulse dot · date.
2. **Calendar strip**: horizontal 7–14 day scroller centered on today;
   states: today / logged / trading-day-no-log / weekend / holiday;
   tap → day; long-press → mini stats popover (mock).
3. HKT/CT dual clock readout with next-open/next-close line (per AUDIT Z1
   replacement of tabs: nav = palette + strip, not tab bars).
4. ⌘K palette overlay (mock): fuzzy list, sections (jump to day, compose,
   rituals, archive, settings); `/` opens too; Escape closes; recent items.
5. Empty-state cockpit: what the frame looks like before any content.

## Acceptance checklist
- [x] top bar readable at-a-glance on iPhone SE width (~375px) — verified live @390 + zero h-overflow @320 (gate)
- [x] calendar strip swipe-scrolls momentum-style, snap-to-day — native momentum + `scroll-snap-type: x mandatory`; centers today (gate: off=0px); arrows move selection too
- [x] clock shows correct CME open/closed for ≥3 mock states (?state= param) — open/closed/holiday all drive capsule+pulse+band+countdown; countdown walks the real weekly model (6-scenario unit-checked)
- [x] palette fully keyboard-navigable on desktop Safari; touch-friendly on iOS — ⌘K + `/` open, arrows/enter/escape, roving highlight, aria-activedescendant; 44px rows; fab trigger for touch
- [x] no hover-only interactions anywhere — hover only brightens btn-primary; everything else tap/click/key
- [x] safe-area insets respected in standalone (add-to-home-screen) mode — env() in topbar/content/fab/devrail; viewport-fit=cover; standalone metas present
- [x] board + resume protocol followed

### R2 acceptance (C06–C06e, all verified live)
- [x] wide monitors read a centered 768px column, strip fades not cuts — gate: content ≤768px @1512 + centered
- [x] month-start signal visible in strip — gate: tick count matches real calendar crossings
- [x] TOK/LON/NYC rail: city-mark icons, live/opens/back-in/closed states, standardized countdown grammar, absolute hkt windows — gate: rail probes + 8-scenario matrix
- [x] cme master capsule w/ inline countdown; next-change carries absolute hkt anchor
- [x] events tape: polled tv+ff fixture, hero colour-coded w/ T-15s seconds (grammar: h m / m s), day|wk tabs, wk accordion, band pins w/ compact pop — gates
- [x] virtual time ?at= freezes everything ("mock time" chip); 11 scenario presets deep-link
- [x] 58-gate standing harness green ×3 stable; 12-check offline model test green

## Out of scope
Composer internals (S02), rail content (S03), real clock logic (mock data ok).

## Session log
(Compressed 2026-08-24 handover audit — full narratives in git history;
extracted principles + invariants live in DECISIONS.md.)

### C05 · 2026-08-24 · R1 SHIPPED (superseded by C06)
Full frame built in st/css/frame.css (topbar glass, 21-day snap strip, dual
clock, ⌘K palette, demo rail); base.css untouched. 36 live gates green.
Three revision loops — r1a root-absolute /st/ refs, r1b overflow-x:clip
bleed fix, r1c real-model countdown walk — each caught by the live-DOM
gate; lessons logged as DECISIONS invariants.

### C06 · 2026-08-24 · R2 SHIPPED → freeze review
Owner verdict on R1 drove scope: 768px centered shell column (--shell-w +
.shell-fit), month-start ticks in strip, TOK/LON/NYC city-mark rail,
standardized countdown grammar, events tape (polled TV+FF fixture news.json,
hero T-15 countdown, day|wk accordion tabs, band pins), virtual-time ?at=
doctrine w/ 11 scenario presets. Gate grew to 58 checks (_verify/
zen.gate.cjs). Revision trail r2a–r2d (halt-vs-close bounds, phaseAt
self-anchor, HKT-vs-CME day duality, mockd data/ router case) logged in
DECISIONS.

### C06b–e · 2026-08-24 · feedback rounds r2.1–r2.4 → FROZEN at r2.4
Four annotation passes (13 notes total), all dispositioned live: tape head
redesign ("economic calendar" + scope line), 8wk tab removed (owner call),
wk accordion w/ today auto-open, "sim" → "mock time", city-mark glyphs
(tokyo tower / big ben / empire state), hollow red folders, T-15 hero:
outline-only kind colour, normal ink text, no pulse dot (r2.3 + r2.4
regression fix), ev-panel s4 padding. 58 gates green throughout. Owner:
last round → S01 frozen; residual knick-knacks deferred to later sprints.

Gotchas for next sessions (standing):
- New /st/ subpaths need a mockd case (`design/server/main.go`) — INVARIANT;
  all /st/ asset refs are root-absolute AND extensionless.
- Gate is .cjs (repo is type:module); run with playwright installed
  (/tmp/opencode/verify has it); ZEN_BASE overrides the target URL.
- Scenario times anchor to next-weekday for tue/wed/thu presets —
  thanksgiving + half-day use fixed Nov dates (2026-11-26/28).
- Gate wk-expand test must pick a CLOSED row — today auto-opens and shifts
  indices.
- Bump ?v= on every deploy (currently v=r6).
- Full-bleed scrollers need an overflow-x:clip ancestor; tint surfaces,
  never text into its own background (see BRIEF sensibilities).
