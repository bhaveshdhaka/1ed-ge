# 00-BRIEF.md — design program constitution

Read this first. Every design session reads BRIEF + its own sprint spec +
the tail of DECISIONS.md — nothing else. Update the status board before
ending any session. The filesystem is the memory; chat is disposable.

## Mission

Design the v2 of 1ed.ge as clickable, near-final mocks:

- **Zen** (`/zen`): the owner's only trading space. Flow-state cockpit.
  Capture-first, keyboard-driven on desktop, one-handed-perfect on iPhone.
- **Public**: visitors grasp the whole process at a glance and can drill
  into any day.

Mocks are **pretty but dumb**: static HTML/CSS/tiny-JS in `design/mocks/`,
no backend, no DB. They share `tokens.css` + `base.css` with the future
production build — frozen mocks are the build contract.

## Hard constraints (non-negotiable, from owner + platform)

1. **Targets: iOS Safari (primary!), desktop Safari, retina screens.**
   - viewport-fit=cover + safe-area insets everywhere
   - ≥44px touch targets; no hover-only affordances; :active feedback
   - svh/dvh units, not vh; -webkit-backdrop-filter prefixes
   - SVG only for charts/icons (retina-proof); tabular numerals for data
   - standalone app meta so /zen mock installs to Home Screen
2. **Terminal aesthetic, dense**: mono-first, near-black summit,
   translucent panels, green/red = DATA ONLY, blue accent = chrome.
3. **No new visual pattern without a primitive**: extend tokens/base.css,
   never inline one-offs that production would have to re-derive.
4. **Zero framework JS** in public mocks; zen mocks may use ~small vanilla
   islands (composer, palette, rituals timers/audio). No React anywhere.
5. **English lowercase UI copy**, dates dd-mon-yyyy, empty states one line
   ending with a period. No emoji in chrome.
6. Every screen must state its sprint ID in an HTML comment.
7. **Every screen includes the feedback annotator** (`st/js/feedback.js`
   script tag — copy from index.html). Owner annotations are sacred: never
   lost, never expired, anchored to exact elements.
8. **Read the owner's notes before designing**: at sprint start and before
   freeze, GET `https://mock.1ed.ge/api/feedback?page=/zen/…` (or curl from
   repo) for your pages; every note must be addressed or explicitly
   counter-proposed in DECISIONS.md. Never ask the owner to repeat himself.
9. **Revision protocol (owner directive, 2026-08-24)**: every cycle ends in
   this exact order — fetch ALL notes → fix → post a comment→fix table →
   deploy → verify → only then hand over the URL. Shipping a revision
   without the table, or missing fresh notes, is protocol failure.
10. **Real forms where forms exist** (softened 2026-08-24 from an
    over-tight htmx-portability mandate): capture/data-entry screens use
    actual `<form>`s with named inputs — correct HTML regardless of stack,
    and it keeps mocks testable. No other implementation rules: mocks are
    UX artifacts first; the Go + templ + htmx build will be hand-written
    from the frozen mocks, not mechanically derived.

## Design sensibilities (locked)

Owner taste distilled from verdicts in DECISIONS.md (dates referenced).
Apply everywhere; never re-litigate without an explicit owner reversal.

- **Direction**: Variant A — **Linear × Apple-glass sans hybrid** (chosen
  in writing 2026-08-24, DECISIONS). Sans voice (SF/system-ui) for text;
  mono numerals for data only. Full-page mono = dated = banned.
- **Keyword: subtlety** (owner, DECISIONS 2026-08-24). Quiet translucent
  layers, white-alpha hairlines, luminance-separated surfaces — no opaque
  gray borders, no noise.
- **Dense, not airy**: information-dense, tight indents, 28–32px section
  rhythm, 4pt grid. Not generous whitespace.
- **Colour discipline**: one surgical accent `#7da2ff` = chrome only;
  desaturated green/red = data only. Severity rides hue + stroke weight,
  never solid slabs.
- **Countdown grammar** (DECISIONS S01 r2.2): "3h 24m" ≥1h · "45m" under ·
  "<1m" floor; seconds ONLY on news events inside T-15m. Bare colon forms
  ("3:24") banned everywhere.
- **Tint surfaces, never text into its own background** (r2.4 lesson): the
  outline carries kind colour; countdown/title stay normal ink.
- **Structure chromatic-invariant**: light/dark via token overlay only —
  zero primitive changes between themes.
- **Motion**: ease-out 130/210/340ms, reduced-motion guards throughout.

## Where everything sits

| Artifact | Path |
|---|---|
| Constitution (this file) | docs/design/00-BRIEF.md |
| Decision log (append-only) | docs/design/DECISIONS.md |
| Session protocol + spawn prompts | docs/design/SESSIONS.md |
| Dual-POV audit (why) | docs/design/AUDIT.md |
| Sprint specs S00–S09 | docs/design/sprints/ |
| Mocks (product of record) | design/mocks/ |
| Shared tokens/primitives | design/mocks/st/css/{tokens,base}.css |
| Live at | https://mock.1ed.ge (deploy: `cd ../sos-lab && ./lab rebuild 1edge-mocks`) |

## Sprint board

| Sprint | Scope | Status | Sessions |
|---|---|---|---|
| S00 | foundation: R4 — theme switcher fix, iOS zoom fix | active · R4 | C01 ✗ · C02 ✗ · C03 ✓ · C04 ✓ |
| S01 | zen frame: top bar, CME chrono band, sessions rail, calendar strip, events tape, ⌘K, nav model | frozen · r2.4 | C05 ✓ · C06–C06e ✓ |
| S02 | composer: thought/quote/trade, live R, paste flow | active · r1.1 | C09 ↻ |
| S03 | today rail: facts, trades, news, stream, obligation | frozen · R1 | C10 ✓ |
| S04 | rituals full port: timers + soundscapes island | frozen · R1 | C11 |
| S05 | evening mode: reviews, accountability, CSV import | frozen · R1 | C12 ✓ |
| S06 | zen secondary: accounts/library/settings/media behind palette | frozen · R1 | C13 ✓ |
| S07 | public home | frozen · r1 | C14 ✓ |
| S08 | public rest: day/period/performance/models/about | queued | — |
| S09 | states pass: empty/error/loading, edge dates, polish audit | frozen · R2 | C16 |

Status values: `queued · active · frozen · reopened(→DECISIONS ref)`.
Update rows in-place; add session IDs (C01…) as they run.

## Rules of engagement for design sessions

- Iterate with the owner live in-session until the sprint goal is met or
  context runs low — then leave a resume point (template in SESSIONS.md).
- Frozen screens change only via a DECISIONS entry + board status `reopened`.
- Never read the old Astro codebase; AUDIT.md is the distilled truth.
- Never touch src/, tests/, or infra. Your blast radius is docs/design/ +
  design/mocks/ (+ ../sos-lab registry only via ox-alpha).
