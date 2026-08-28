# S05 — Evening mode (reviews + accountability + CSV import)

Goal: after the close, zen becomes a guided review ritual — obligation-
driven, not menu-driven. Plus trade-bulk-entry via CSV.

## Scope
`design/mocks/zen/evening.html` (+ states):

1. Evening switch: when CME closed (or manual), cockpit offers review mode:
   today's stats recap card → reflection editor (AI-draft stub) → week
   review link when due.
2. Accountability queue: overdue reflections / pending period reviews as a
   calm checklist with grace countdowns; tap → jump into that day's editor.
3. Week/month review screens: R distribution, win/loss runs, habit adherence
   heat, rule-violations log; narrative text area; compare-with-previous.
4. **CSV import**: drop/select Tradovate CSV → preview table of parsed round
   trips → map to day(s) → confirm merge; conflict rows highlighted;
   mental-stop prompt state.
5. Payout entry flow (account select, amount, date) with equity impact hint.

## Acceptance checklist
- [x] full happy-path: open evening → reflect → submit → accountability clears (mock)
- [x] CSV preview readable on iPhone (horizontal scroll allowed within table)
- [x] review charts are server-SVG-style divs/SVG (no chart libs)
- [x] all states reachable via ?state= params for owner review
- [x] board + resume protocol followed

## Out of scope
Real parsing; period math truth (S08 covers public rollups).

## Session log

- **C12 · R1 shipped 2026-08-28** — `zen/evening.html` + `st/css/evening.css`
  on frozen S00–S04. Six sections under the frozen frame: 01 recap
  (day-r / trades / best / worst tiles + facts line) · 02 reflect (real
  form, ai-draft stub, S03 obligation grammar) · 03 accountability queue
  (calm checklist, severity = hue on the dot only, grace countdowns,
  tap → opaque day-editor sheet) · 04 review week/month (svg histogram,
  run cells, habit heat, violations log, narrative form, vs-previous
  deltas) · 05 csv import (drop → preview table w/ horizontal scroll,
  conflict rows warn-outlined + tap-to-skip, mental-stop prompt sheet,
  merged card) · 06 payout (real form, live equity-impact hint).
  States: `?state=done|due|overdue` · `?csv=drop|preview|conflict|stop|merged`
  · `?view=week|month` · `?cmp=1` · `?queue=empty` · `?at=` freeze.
  Countdown grammar extension: ≥1 day reads "5d 1h" (121h-class strings
  unreadable on grace windows). Happy path verified headless end-to-end;
  zero console errors. Awaiting owner review.
- **C12 · standing gate shipped 2026-08-28** —
  `_verify/evening.gate.cjs` (81 checks, lib.cjs harness, live-URL):
  shell/annotator/css-literals, six sections, recap math, reflect form +
  ai draft + obligation pins, queue sort/clear/empty-state, review svg +
  month/cmp, csv full flow incl. conflict skip + mental-stop sheet +
  pins, payout math + no-threshold branch, palette + g-chords, 44pt
  targets, 390px overflow + in-wrapper table scroll. 81/81 green vs
  mock.1ed.ge. Gate lesson reused: locator `.length` ≠ `count()`;
  fixed-position toasts have null offsetParent (never `vis()` them).
- **C12 · FROZEN at R1 2026-08-28** — owner verdict "ok this is good" on
  live R1. Pre-freeze sweep clean (zero annotations on /zen/evening,
  nothing fresh anywhere → no revision table owed). Standing gate joins
  the /zen/ regression bar. Residual knick-knacks → S09. Program moves
  to S06.
