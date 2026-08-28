# S09 — States pass (polish audit)

Goal: no screen ships to build until its failure modes look designed.
This sprint sweeps every frozen surface for states and edges.

## Scope
For each frozen mock (zen + public), add/verify:

1. **Empty** (no trades yet, first day, new account), **loading**
   (skeletons that match final layout — no spinners where structure can
   show), **error** (AI failed, upload failed, save conflict) — inline,
   calm, one line + action.
2. **Edge dates**: weekend, CME holiday, early close, day boundary 17:00 CT
   rollover while using the app.
3. **Long-content stress**: 40-trade day, 2k-word reflection, 12 screenshots.
4. **A11y sweep**: focus order, focus-visible rings, dynamic type to 120%,
   VoiceOver labels spot-check (aria-labels on icon buttons).
5. Consistency audit against _foundation.html: any one-off pattern found is
   either promoted to a primitive or removed.

## Acceptance checklist
- [x] state matrix documented per screen in a table on mocks index
- [x] all ?state= demos reachable from mocks index page (gate asserts every link serves 200)
- [x] zero hover-only or color-only meaning violations (audit: severity rides outline hue + stroke weight everywhere; no new hover-only affordances)
- [x] owner iPhone walkthrough of the full matrix — owner verdict "ok all good" (2026-08-28, in-session)
- [x] board → frozen for S09 (whole-program freeze lands when S08 public rest ships + freezes)

## Out of scope
New features; backend truths.

## Session log
### C16 · 2026-08-28 · SHIPPED R1 (pending owner walkthrough)
Done: base primitives .skel / .note / [hidden] guard · cme engine fixes
(holiday-monday label, labor day early halt, band 17:00 ct rollover
rebuild) ported by diff across zen/index + today + public · sessions-rail
390px clip fix (C13 deferral) · mock-time chip off the live clock
([hidden] guard promoted to base) · error demos (news/ai/upload/save/csv),
boot skeletons, empty day, stress pins (40 trades / 12 shots / 2k words),
?dt=1.2 dynamic type · state matrix table on the mocks index + board
capsule sync · states.gate.cjs 69 checks (new regression bar); zen.gate
migrated to playwright-core (was unrunnable — required deleted pkg).
Gates at ship: states 69/69 · composer 82 · today 85 · rituals 143 ·
evening 81 · secondary 60 · public 79 · zen 58 (after live deploy).
In flight: —
Next: owner iPhone walkthrough of the matrix (acceptance 4); S08 lands
after, then program freeze.
Gotchas: retry pins must clear the captured URLSearchParams snapshot,
not just the URL · mlk/presidents/memorial/labor are EARLY-HALT days in
the engine — the first full-closed holiday monday is jul4-observed
2027-07-05 · localhost fetch beats gate protocol roundtrips — arm route
delays when asserting skeletons.

### C16 · 2026-08-28 · R2 hardening (same session, owner-walkthrough prep)
Done: ?dt=1.2 extended to rituals/accounts/library/media/settings —
dynamic type now gated on ALL nine zen pages + public (root 120% + no
h-scroll @390 each) · states gate grew 69 → 93 checks: program-wide
icon-button naming sweep (zero unlabeled buttons found — mechanized
VoiceOver spot check), keyboard first-tab-stop + :focus-visible halo
assertion, early-close friday countdown check · matrix a11y column
filled for the five secondary rows · gate needs GATE_TIMEOUT=600 now
(~30 page loads; the 180s default kills it mid-run — that was the
"random" crash).
Next: owner iPhone walkthrough; S08; program freeze.

### C16 · 2026-08-28 · FROZEN at R2 (owner: "ok all good")
Wrap-up sweep: zero strays in design/mocks + docs/design · zero framework
or legacy-machinery refs in mocks · living docs clean (astro/npm mentions
are the forbidden-reading guards, AUDIT.md is historical by design) ·
dead baggage removed: st/js/app.js (S00-era helper module, zero
importers — every page grew inline helpers instead) · python spawner
files confirmed live (preflight.sh + spawn.sh call them; they stay).
S09 → frozen · R2 on the board. The Go + templ + htmx build hand-writes
from these mocks per BRIEF §10: real forms with named inputs, shared
tokens/base, zero framework JS — the contract is clean for it.
