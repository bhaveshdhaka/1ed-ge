# S02 — Composer (capture-first)

Goal: the single most important screen in the product. Thought in ≤3s,
trade in ≤20s, screenshot paste ≤5s. Publishing is implicit — there is no
save/publish/rebuild vocabulary anywhere.

## Scope
`design/mocks/zen/composer.html` (+ states):

1. Docked composer at top of cockpit: one input, mode chips
   thought | quote | trade. Enter publishes; optimistic append to stream.
2. Quote mode: text + author inline; citation styling preview.
3. **Trade mode**: progressive disclosure — first row: direction, market
   (MNQ default), entry/stop; second row on demand: target, exit, size/
   accounts, setup tag, model chips, confidence, note. **R computed live
   as-you-type** (big, unmissable, green/red by sign). Risk = riskPoints ||
   |entry−stop| (single rule, mirrors production).
4. Screenshot flow: paste anywhere / tap attach → thumbnail rail → optional
   "structure with AI" action → mock structured-trade diff view.
5. Undo pattern: published toast w/ 5s undo — replaces confirm dialogs.
6. Error state: what if fields inconsistent (stop==entry) → inline hint,
   never a modal.

## Acceptance checklist
- [x] thought: focus→type→Enter = published feel, zero chrome touched
      (gate-proven desktop; "chrome touched" = calm-dim by design, r1.1)
- [x] trade R updates per keystroke; guard states shown (no risk yet → dash)
- [ ] paste demo works in desktop Safari (Ctrl-V image) + file input on iOS
      (desktop simulated ✓ gate; iOS awaits owner device pass)
- [x] undo toast visible, timer bar animates
- [x] all targets ≥44px
- [ ] keyboard doesn't cover composer on iOS (visual check — owner device pass)
- [x] board + resume protocol followed

## Out of scope
Where the published item renders (S03), AI backend truthfulness (mock).

## Session log

### C09 · 2026-08-24 · r1.1 writing surface · LIVE (ox-alpha max)
- **Owner verdict on R1**: writing space too small, page too busy — wants
  Ghost/Substack calm. (logged in DECISIONS)
- **r1.1**: comp-ta recalibrated as a WRITING SURFACE — 20px/1.6, 150px
  rest → 230px under the caret, autogrow ~440px; `body[data-writing]`
  focus-as-calm: topbar/strip/clocks 0.35, toolbar 0.45, stream 0.55;
  intra-form focus hops stay calm, trade fields + mode switches restore
  the page; desktop boots straight into calm. Card text 16px.
- **Gate 82/82** vs live (+7 writing checks: type size, rest/focus
  heights, chrome dim + return, trade-field exclusion).

### C09 · 2026-08-24 · R1 from zero · LIVE (ox-alpha max)
- **Voided bytes overwritten, nothing reused**: zen/composer.html,
  st/css/composer.css, _verify/composer.gate.cjs all written fresh.
- **Shipped**: docked composer at top of working area; autogrow one-input
  (quote mode = citation voice on the editing surface itself, inline
  author); trade row 1 (direction seg w/ data colours, market, entry,
  stop) + live-R readout (guard dash → "risk N pt" → ±R green/red, exit
  outranks target, $ = pts × pv × size); progressive row 2 (target/exit/
  size/accounts/setup/model/confidence/note); paste-anywhere + attach →
  thumb rail → mock "structure with ai" diff sheet (per-row or apply-all,
  flash on landing); undo toast w/ 5s drain bar + full draft restore;
  optimistic stream cards; inline geometry hints (stop==entry, wrong
  side) w/ red outline rings, publish gated; deep links ?mode ?more ?err
  ?shots ?diff ?pub ?at; n/q/t shortcuts; visualViewport keyboard pin
  for the toast; trimmed S01 chrome (no events/palette — S01 owns them).
- **Grammar decisions**: Return publishes thought/quote everywhere (undo
  is the safety net); a price field can NEVER fire a trade — Enter walks
  entry→stop→(disclosed row 2)→capture, submit = capture btn or ⌘⏎.
  Direction flip inverts geometry validity, so it guards instead of
  reading as signed R; honest red comes from losing-side exits.
- **Gate**: composer.gate.cjs REWRITTEN — 76/76 green vs LIVE (~/gate
  persistent env, domcontentloaded discipline per owner's protocol fix).
- **Bugs the gates caught in-product**: [hidden] defeated by author
  display rules (hint/ai-btn stayed rendered) → `[hidden]{display:none!
  important}` primitive; Enter-walk skipped stop → fixed.
- **Next**: owner device pass (iOS Safari: paste, file input, keyboard
  clearance, undo reach) → annotate → r2.

### VOID · 2026-08-24 · ALL PRIOR COMPOSER OUTPUT REJECTED BY OWNER
Every artifact from sessions C07/C08 is VOID — owner rejects work touched
by non-ox-alpha model turns. This includes design/mocks/zen/composer.html,
st/css/composer.css, _verify/composer.gate.cjs and their commits (5745230,
166d0b5, 7163467). The fresh session SHOULD delete/rewrite these from
scratch; nothing there is a constraint or a starting point.

### C09 · spawn point · S02 FROM SCRATCH
Design the entire sprint per Scope above as if no composer mock exists.
Only S00 tokens/primitives + S01 frame primitives (st/css/tokens.css,
base.css, frame.css) carry forward — those are frozen canon. Delete stale
composer artifacts when you replace them. Full delivery: iterate with
owner live → acceptance checklist green → freeze → board + DECISIONS.
Gate env per SESSIONS.md ("Gate environment"). MAXIMUM reasoning depth.

### C07 · 2026-08-24 · R1 + R1.1 (ox-alpha max)
- **R1 shipped**: docked composer, 3 modes, live-R engine (risk/pts/$, guard
  states: dash → risk-only → +R green/−R red; wrong-side + stop==entry inline
  hints, error ring), progressive trade disclosure, paste→thumbs→AI diff→apply,
  undo toast w/ drain bar + draft restore, deep links (?mode/?trade/?shots/?pub),
  devrail presets, HKT publish timestamps. Deployed + verified live.
- **R1.1 — constraint-10 alignment** (doctrine landed mid-session, then
  softened to "real forms where forms exist"): composer is now THREE sibling
  `<form>`s (`#f-thought/#f-quote/#f-trade`, actions `/zen/api/*`) with named
  inputs; chip/dot/direction state syncs into hidden inputs so each form
  carries a complete payload; capture button `type=submit` re-bound per mode
  via `form=` attr; mock consumes its own `FormData` for card building.
  Trade publish paths: capture button or ⌘⏎ only — plain Enter can never
  submit a trade from a price field (document-level keydown + submit routing).
  Shots rail + file input stay OUTSIDE the forms (upload is its own endpoint).
- **Verification**: scratch-env gate (`design/mocks/_verify/composer.gate.cjs`,
  playwright-core in `/tmp/opencode/gate`) against LIVE v=c7 —
  **ALL 62 GATES GREEN**, incl. new portability gates (forms+actions, named
  fields per form, hidden-input serialization, setup single-select, form-attr
  follows mode, plain-Enter negative test, id-addressable items) and feedback
  annotator presence + pill mount.
- **Revision protocol**: owner annotations on composer.html = zero at cycle
  close; R1.1 was doctrine-driven, no comment→fix table owed.
- Next session: owner device pass (iOS Safari) → annotate.

### C09 · 2026-08-24 · PAUSED (owner: "ok fine")
Done: S02 rebuilt from zero — R1 (docked composer, 3 modes, live-R engine
w/ guard grammar, progressive row 2, paste/attach → mock ai diff sheet,
undo toast w/ drain, optimistic stream, deep links ?mode/?more/?err/
?shots/?diff/?pub/?at, n/q/t) + r1.1 Ghost writing surface (20px/1.6,
focus-as-calm body[data-writing]). Gate rewritten: 82/82 vs LIVE under
~/gate. Board `active · r1.1`; DECISIONS has 6 C09 entries. All work
committed on sos-lab (fbd2e55…HEAD), deployed tag 2026.08.24-r18xxxx.
In flight: nothing half-wired.
Next: owner iPhone Safari device pass (paste image, file input, keyboard
clearance vs composer + toast, undo reach, calm state on touch) →
address annotations (fetch→fix→table→deploy) → tick remaining checklist
items → freeze review.
Gotchas: gate env = `sh docs/design/gate.sh`, then
`NODE_PATH=$HOME/gate/node_modules node design/mocks/_verify/composer.gate.cjs`
(never /tmp, never repo npm). `[hidden]{display:none!important}` in
composer.css is load-bearing. Direction flip GUARDS (validity inverts
with side — signed R only from coherent setups; red = losing-side px).
Trade Enter-walk: stop→publish when row 2 closed (disclosure never
forced by Enter). Desktop autofocus boots calm (data-writing at load is
intended); gate's writing section must blur before measuring rest state.
