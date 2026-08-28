# rewrite/ — 1ed.ge v2 design program

Everything an implementation agent needs to rewrite 1ed.ge from scratch:
the assessments, the requirements, and the frozen clickable mocks that
are the build contract. Canonical working copy lives in the private
checkout (`docs/design/` + `design/mocks/` + `design/server/`); this
folder mirrors it verbatim (last sync 2026-08-28, S09 frozen).

## Read in this order

| File | What it is |
|---|---|
| [REWRITE.md](REWRITE.md) | **Overall assessment & plan** — why v2 exists, the Go-first architecture, goals, P0 approved 2026-08-24 |
| [design/AUDIT.md](design/AUDIT.md) | Dual-POV UX audit of v1 (visitor + trader) — the "why" behind every sprint |
| [design/00-BRIEF.md](design/00-BRIEF.md) | Design constitution: hard constraints, locked taste, sprint board |
| [design/DECISIONS.md](design/DECISIONS.md) | Append-only decision log — owner verdicts, freezes, lessons, grammar rules |
| [design/sprints/](design/sprints/) | Sprint specs S00–S09 — the per-screen requirements (S08 queued) |
| [design/SESSIONS.md](design/SESSIONS.md) | How the design program is operated (sessions, freezes, memory doctrine) |
| [mocks/](mocks/) | The frozen mocks — pretty, dumb, zero framework JS; **the build contract** |
| [mocks/_verify/](mocks/_verify/) | Eight live-URL gates, ~660 assertions — the behavioral acceptance truth |
| [server/](server/) + [mocks.Dockerfile](mocks.Dockerfile) | `mockd` — stdlib-only Go static server + append-only annotation feedback (CGO_ENABLED=0, alpine) |

## Status (2026-08-28)

S00 foundation · S01 zen frame · S02 composer · S03 today rail ·
S04 rituals · S05 evening · S06 zen secondary · S07 public home ·
**S09 states pass — all FROZEN.** S08 (public rest) queued — the
whole-program freeze lands when it ships.

Live reference implementation: **https://mock.1ed.ge** · every demo
state reachable by URL, matrix on the index page.

## Running the gates

```bash
GATE_TIMEOUT=600 bun rewrite/mocks/_verify/states.gate.cjs   # or any gate
```

Gates hit the live URL (override with `ZEN_BASE`); they need
playwright-core + chromium in the environment. `mocks/_verify/lib.cjs`
is the shared harness — the gates are the regression bar for any
reimplementation of the same surfaces.

## The Go build contract

Production is Go + templ + htmx (REWRITE.md §3) and is hand-written
from these mocks — not mechanically derived. Non-negotiables the mocks
already honor and the build must keep: real `<form>`s with named
inputs; shared `st/css/tokens*.css` + `base.css` (zero one-off
patterns); vanilla-JS-only islands in zen, zero JS on public pages;
iOS-Safari-first layout (safe areas, 44pt targets, svh/dvh, retina);
lowercase UI copy, dd-mon-yyyy dates; green/red = data only, blue
accent = chrome; countdown grammar per DECISIONS.

## Deliberately excluded

Pod-specific session orchestration (`spawn.sh`, `preflight.sh`,
`selfreview.sh`, `gate.sh`, `_spawn_api.py`, `_writers.py`) and the old
Astro-era audit tooling — machinery, not rewrite inputs.
