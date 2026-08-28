# S06 — Zen secondary (behind the palette)

Goal: everything that is NOT today, reachable in ≤2 palette actions.
Accounts · library (habits/models/rules/quotes) · media · settings.

## Scope
`design/mocks/zen/accounts.html`, `library.html`, `media.html`,
`settings.html`:

1. Accounts: lifecycle cards (eval/funded/buffer/payout/failed/paused) w/
   stage timelines, equity sparkline per account, portfolio rollup; add/
   edit via bottom sheet; nested rules view (read-dense).
2. Library: segmented habits/models/rules/quotes; reorder via up/down
   controls (NOT drag-drop on touch); inline edit sheets; active toggles.
3. Media: grid of webp thumbs, alt-text edit, attach-to-day affordance;
   storage usage line.
4. Settings: display tz, ghost-text/AI toggles (future), export-now button,
   passkey management list (add/remove), admin-secret status (set/unset).

## Acceptance checklist
- [x] every surface reachable from ⌘K mock within 2 actions
      (all four pages cross-linked in every palette's settings section;
      frozen screens' palette items wired with real urls + media added —
      navigation data only, no pixel changes; gate: palette → media navigates)
- [x] accounts timeline renders 6 lifecycle stages without wrap-break
      (grid 6×1fr single-row by construction; gate measures per-card label tops)
- [x] reorder works with buttons only — no dnd dependency
      (up/down stepper with hit-slop; gate greps zero dnd wiring)
- [x] passkey screen shows register + revoke flows with confirm-by-intent
      (type-to-confirm), not confirm()
      (revoke gated on typing "revoke"; gate asserts disabled→enabled→removed
      and zero confirm() calls in the page)
- [x] board + resume protocol followed (lease held s06-secondary C13;
      board → frozen; DECISIONS entries; resume/freeze logged here)

## Out of scope
Auth screens (existing pattern carries; restyle only if trivial), coach.

## Session log
### C13 · 2026-08-28 · FROZEN at R1 by owner direction ("Ok this is good. Lock it in and wrap up.")
Pre-freeze sweep clean: zero annotator notes on all four S06 pages,
zero fresh anywhere (24 stored, all addressed by earlier sprints) —
no revision debt. Acceptance checklist fully green. Standing gates vs
live at freeze: secondary 60/60 · zen-index palette regression 7/7 ·
composer 82 · today 85 · rituals 143 · evening 81 — all 0 failed.
One owner-directed r1 fix during device pass: sheet-dock amendment
(rail.css — phone-pattern dock; iPad centered dialog; logged in
DECISIONS). Standing gate _verify/secondary.gate.cjs (60 checks)
joins the /zen/ regression bar. Residual knick-knacks → S09 polish
pass (sessions-rail NYC clip <400px noted). Program moves to S07
(public home).
### C13 · progress log (superseded by FROZEN entry above)
Done: accounts/library/media/settings.html + st/css/secondary.css
primitives; palette wiring (urls + media item) into index/today/
rituals/evening; local smoke 45/45; secondary.gate.cjs 60/60.
Deep states: accounts ?stage=·?empty=1 · library ?tab=·?empty=1 ·
media ?f=·?empty=1 · settings ?secret=·?pk=0 · all ?at=.
Gotchas: (1) NEVER retype the CME engine — diff against the frozen
source; a retyped japanHolidays carried addD(d,1) for addD(sub,1) =
infinite loop, renderer hangs with NO pageerror. (2) The shared S06
tail has no render() init — pages self-init (accounts/lib/media call
render(), settings calls its three renders). (3) S09 candidate: the
sessions rail's nowrap states expand grid tracks past 390px and clip
NYC — present on the FROZEN index too (right edge 442px).

Revision cycle r1 (2026-08-28, protocol order kept):
notes sweep → fixes → table → deploy → verify → URLs.

| owner note | fix |
|---|---|
| (zero notes on S06 pages; zero notes anywhere newer than
  2026-08-27 — sweep of all 24 stored annotations, none fresh) | none owed |
| live chat 28-aug: "add account / add habit slide out so big and
  wide screen when the website is not even so.. make it consistent"
  (iPad screenshot — sheet was full-bleed 100vw on any coarse
  pointer) | rail.css primitive amended (owner-directed): bottom-
  sheet dock now requires coarse AND ≤640px; wide-coarse (iPad)
  gets the centered opaque dialog; + max-width:none so the phone
  dock is truly full-bleed (UA dialog cap previously inset it
  ~352px). rail refs bumped to ?v=c13r on all 7 zen pages so the
  primitive reaches frozen screens too. Verified live: iPad
  1180x820 coarse = 520px centered dialog · phone 390 coarse =
  390px docked · today.gate 85/85 · secondary gate 60/60. |

Deployed + verified: secondary.gate.cjs 60/60 vs live · standing
gates composer 82 · today 85 · rituals 143 · evening 81 all clean ·
index palette regression 7/7 after pick() url dispatch.
URLs: /zen/accounts.html · /zen/library.html · /zen/media.html ·
/zen/settings.html — owner device pass pending → freeze or r2.
