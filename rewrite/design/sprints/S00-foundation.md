# S00 — Foundation

Goal: freeze the visual language ONCE, in files production will import
verbatim. Everything else inherits from here.

## Scope
1. `design/mocks/st/css/tokens.css` — type scale, spacing, color
   (summit bg, ink/soft/dim/faint, accent, up/down/warn), radii, motion.
2. `design/mocks/st/css/base.css` — primitives: panel, well, capsule,
   label, num-up/down, shell, stack, row, tap targets, safe-area handling,
   reduced-motion, focus-visible rings.
3. `design/mocks/_foundation.html` — living styleguide page rendering every
   token + primitive with labels.
4. `_torture.html` — iOS/Safari/retina torture test: safe areas w/ notch,
   backdrop-filter over image, sticky header + bottom bar, 100svh sections,
   tabular numerals, 44px targets grid, landscape/portrait.

## Acceptance checklist
- [ ] owner supplied visual references BEFORE tokens freeze
- [ ] every primitive on _foundation.html has no inline one-offs
- [ ] _torture.html passes owner eyeball on iPhone Safari (notch/home-indicator correct)
- [ ] backdrop blur verified in Safari (with -webkit- prefix)
- [ ] tokens.css has a frozen banner comment w/ date + DECISIONS ref
- [ ] board row → frozen

## Revision R2 (owner directive 2026-08-24)
Direction rejected twice as "hand made". Rebuild as ADOPTED hybrid:
**Linear × Apple glass** — layered translucency, hairline strokes,
restrained single accent, soft ambient depth, vibrancy on floating bars,
tight pro-tool density. Two mandatory variants, identical markup:
- **A · sans**: SF/system-ui voice (Linear-like)
- **B · hacker-modern mono**: wa.1ed.ge-compatible mono-forward look,
  executed modern/dense — NOT retro terminal
Files: `st/css/tokens-a.css` + `st/css/tokens-b.css` (+shared base),
`_foundation-a.html`, `_foundation-b.html`, `_compare.html` switcher.
Acceptance additions:
- [ ] variants differ ONLY by token set (proof of adopted-system discipline)
- [ ] glass used correctly (floating bars over content only, never overlays)
- [ ] owner picks A or B (or a stated blend) in writing

## Out of scope
Any product screen; typography pairings beyond reference-driven choice;
dark/light switching (dark only).

## Session log
(Compressed 2026-08-24 handover audit — full narratives in git history;
extracted principles + invariants live in DECISIONS.md.)

### C01 · 2026-08-24 · REJECTED (no output — spawned without pinned model; platform default)
### C02 · 2026-08-24 · FREEZE CANDIDATE · all 7 annotation notes addressed
Doctrine locked (sans voice / mono data, luminance surfaces, #7da2ff accent,
desaturated up/down, motion 130/210/340ms, 4pt grid); Radix dark step
architecture adopted; assets serve EXTENSIONLESS under /st/ — stale-cache
bug class eliminated.
### C03 · 2026-08-24 · R2 two-variant rebuild + R3 theme pass
Variant A chosen in writing; B retired; canon renames. Light/dark added:
tokens-light.css overlay (identical property names), theme.js auto/light/
dark seg, localStorage + theme-color sync. Zero primitive changes —
structure chromatic-invariant.
### C04 · 2026-08-24 · R4/R4b/R4c wiring fixes (token VALUES untouched)
Theme switcher dead-on-arrival root causes fixed: head-time listener wiring,
extensioned /st/ refs → 404 since R3, dropped base.css link from cache-bust.
Verification upgraded curl → live-DOM gates. Inputs 16px @pointer:coarse
(no iOS focus zoom). Full detail: DECISIONS.md R4 entries.

### RESUME · next spawn point
Owner said "we are not done yet" — S00 still ACTIVE, not frozen. Next
session: GET https://mock.1ed.ge/api/feedback FIRST (fresh notes only =
anything newer than 2026-08-24T06:28:44Z), iterate fetch→fix→table→deploy→
verify until owner says frozen; then board → frozen + final DECISIONS entry.
Assets serve EXTENSIONLESS (/st/css/tokens, /st/js/theme). Keep annotator tag
+ sprint-ID comment on every page. Theme switcher works everywhere — expect
owner to re-test it first.
