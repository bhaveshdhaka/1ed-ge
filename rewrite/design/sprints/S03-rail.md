# S03 — Today rail

Goal: the single scrollable surface under the composer holding everything
about today. Facts once, dense, calm.

## Scope
`design/mocks/zen/today.html` (frame + composer stub from S01/S02 ok):

1. **Facts strip**: mood · sleep h+quality · device hours (iphone/social/
   mac) · habits ticks · trades count + day R — one line each, tap to edit
   inline (no forms page).
2. **Trades list**: collapsed one-line rows (time, dir, setup, R colored);
   expand → full ticket incl. screenshots, executions, note. Expand-all.
3. News events card for the day (red/orange rows, past dimmed).
4. Stream: published thoughts/quotes in order, images tappable lightbox
   (native dialog).
5. Reflection block with obligation state chip (done / due 03:00 HKT grace /
   overdue) and AI-draft affordance (stub).
6. Scroll behavior: section jump chips or palette `g` jumps; sticky nothing
   except top bar.

## Acceptance checklist
- [x] facts editable inline via bottom-sheet pickers (iOS feel), no page nav
- [x] trade row expand/collapse smooth; screenshots lazy-render in mock
- [x] obligation states all mockable via ?state=
- [x] one-handed reachability: primary actions in thumb zone on mobile
- [x] density matches "tighter than WALogger" directive
- [x] board + resume protocol followed

## Out of scope
Rituals panel (S04), evening review flows (S05).

Gates: `sh docs/design/gate.sh design/mocks/_verify/today.gate.cjs` —
persistent env, auto-repair, hard timeout. Never npm inside the repo
(SESSIONS.md · Gate environment).

## Session log

### C10 · 2026-08-25 · LIVE R1 shipped (iterating with owner)
Done: `zen/today.html` full scope — facts strip (5 kv rows, bottom-sheet
editors w/ real named-input forms), trades accordion (5 seeded tickets,
lazy detail + fills + shots, expand-all), day events digest, stream
(4 cards + lightbox), reflection obligation engine (done/due/overdue,
`?state=` matrix, ai-draft stub → mark-done loop). New primitives in
`st/css/rail.css` (zero literals). Gate `_verify/today.gate.cjs` —
85/85 vs live after deploy r003329.
Next: owner feedback round via annotator; revision protocol (fetch ALL
notes → fix → comment→fix table → deploy → verify).
Gotchas: news needs TWO truths — canon `flat` (session-shifted) for band
pins vs unshifted `digest` for the calendar-day card (pre-open events
corrupted past/future math otherwise). Sheet hidden inputs must live
INSIDE the `[data-sync]` box or wireSync can't reach them. Forced
`?state=` pins the chip by design — draft/done demo belongs to the live
page. CME canon copied VERBATIM only (a hand-rewrite of easter/japan
holidays broke and was caught before deploy).

### C10 · 2026-08-25 · FROZEN at R1
Owner verdict on live R1: "Ok this is good." Pre-freeze feedback sweep:
zero notes on /zen/today, no fresh notes anywhere. Checklist all green,
board → frozen, gate (85 checks) is the standing regression bar.
Residual polish deferred to S09 states pass.
