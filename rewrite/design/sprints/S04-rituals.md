# S04 — Rituals (full port, owner priority)

Goal: the owner's in-session ritual companion, rebuilt calm: quiet ·
nature · exercise · intentions · rewiring · 21-days — with timers and
soundscapes. Full port per owner decision 2026-08-24; simplify mechanics,
preserve the practice.

## Scope
`design/mocks/zen/rituals.html`:

1. Ritual list w/ today's completion states; each opens a focused mode.
2. **Focused mode**: full-screen dim surface, big timer (SVG ring),
   start/pause/done; session notes one-liner on finish.
3. **Soundscape player** (vanilla JS + Web Audio, real generated tones ok):
   5 scenes from current lib concept (rain, brown noise, etc.); volume
   slider; plays over timer; survives sheet close within mock session.
4. Intentions flow: today's intention text entry + evening check-in hook.
5. Rewiring / 21-days: streak visualization (compact heat strip), day
   counter, note-on-tap.
6. Quiet-time reading/quote pairing slot (static mocks fine).

## Acceptance checklist
- [x] timer runs accurately in Safari (no throttled drift feel at 1× scale)
- [x] audio starts only on explicit tap (autoplay policy respected)
- [x] focused mode is distraction-free: no chrome except exit + timer
- [x] streak strips readable at iPhone width
- [x] completing a ritual visibly updates today rail stub state
- [x] board + resume protocol followed

## Out of scope
Real persistence; soundscape asset generation pipeline (mock tones ok);
backend scheduling.

## Session log

### C11 · R1 · SHIPPED + FROZEN 2026-08-25
Full port live at /zen/rituals.html on frozen S00–S03 only: practice
list → focused mode (wall-clock SVG ring), 5-scene generated
soundscapes, intention + evening check-in, 21-day strip, reading
pair. Gate `_verify/rituals.gate.cjs` 143/143 vs live. Owner verdict
"ok this is good" → FROZEN at R1. Principles + lessons in DECISIONS
2026-08-25. Residual knick-knacks → S09 (session-note display,
duration steppers, soundscape scene memory).
