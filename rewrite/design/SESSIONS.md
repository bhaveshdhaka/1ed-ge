# SESSIONS.md — design session protocol

The anti-context-rot machinery. Read fully before spawning or running any
design session.

## Concepts

- **Sprint (S00–S09)** — scope unit with a goal and acceptance checklist.
  Stable identity; takes as many sessions as it needs.
- **Session (C01, C02, …)** — one fresh agent context. Numbered globally,
  tracked in the sprint board and in each sprint spec's session log.

A session ends one of three ways: **FROZEN** (checklist green, owner
satisfied), **PAUSED** (owner stops for the day), or **EXHAUSTED** (context
running low). All three end the same way: write the resume block, update
the board, release the writer lease (`rm .writer-lease`). If a sprint goal
isn't met in one session, the next session continues the SAME sprint from
the resume point. Nothing lives only in chat history — ever.

## Single-writer rule (owner directive, 2026-08-25 — NON-NEGOTIABLE)

One checkout = one writer. On 2026-08-25 two concurrent sessions edited
this tree and silently reverted each other's uncommitted work; both
sessions were lost. Prevention is mechanical, not memory-based:

1. Before spawning ANY design session:
   - archive blocked/idle goal-mode sessions first (owner action in the
     OpenChamber UI), then
   - run `sh docs/design/preflight.sh --claim "<slug> <Cxx>"`.
2. NO-GO means NO SPAWN. Blockers: fresh conflicting writer lease, dirty
   tree, failed gate env, unreachable mocks, or another session active in
   this directory within the last 5 minutes. Fix the blocker — never
   bypass, never spawn anyway.
3. The spawned session holds the lease for its lifetime. Release it when
   the session ends (see above).
4. When running preflight from inside your own live turn, export
   `PREFLIGHT_SELF=<your-slug>` so you don't flag yourself as the
   concurrent writer.
5. The lease auto-expires after 6h (stale warns instead of blocks).

## Environment truth (owner directive, 2026-08-25)

System dependencies are IMAGE TRUTH. The dev container is unprivileged by
design (WO-9): nothing can be apt-installed or repaired at runtime, and
that is a feature — it makes drift impossible to hide.

- Missing system dep (e.g. chromium libs)? It ships in the owning
  Dockerfile (`../sos-lab/images/openchamber/Dockerfile` for this pod):
  commit → `./lab rebuild openchamber` → verify → work.
- Never user-space repair hacks (apt downloads, LD_LIBRARY_PATH tricks).
  If a repair seems necessary, STOP and report — the fix belongs in an
  image, decided once.
- An infra commit without its rebuild+verify in the SAME session is
  drift, and drift is the bug class that burns sessions. Finish the loop
  or hand it back to the owner explicitly.
- `./lab doctor` enforces this mechanically via `parity:` declarations in
  registry.yaml (declared-vs-runtime facts exec'd inside each pod).

## Context diet (what a session may read)

1. `docs/design/00-BRIEF.md` (constitution + board)
2. Its own sprint spec `docs/design/sprints/Sxx-*.md`
3. Last ~20 lines of `docs/design/DECISIONS.md`
4. The mocks tree it is working on
5. `docs/design/AUDIT.md` sections relevant to its sprint

Forbidden: old Astro sources (`src/**`), backend docs beyond the above,
unrelated sprint specs. If a session believes it needs more context, it
asks the owner rather than wandering.

Mandatory at sprint start and before freeze: fetch owner annotations for
your pages — `curl https://mock.1ed.ge/api/feedback` (all) or
`?page=/zen/composer.html` (filtered). Address every open note; log
outcomes in the sprint spec + DECISIONS.md. Owner notes outrank everything.

## Session creation rule (owner directive, 2026-08-24 — MECHANICAL, not prose)

Every spawned design session MUST run model `openrouter/stealth/ox-alpha`
with variant `max`. This is enforced by `docs/design/spawn.sh` — never
spawn by hand:

```bash
sh docs/design/spawn.sh <sprint-id> <Cxx>          # first session of a sprint
sh docs/design/spawn.sh <sprint-id> <Cxx> <file>   # custom prompt
```

The script: preflight → create idle session → claim writer lease →
dispatch prompt with model+variant EXPLICITLY on send → verify what
actually ran. Any mismatch fails loudly with the session id to archive.

**API trap (verified 2026-08-25, burned C03 and calm-wolf):**
`session.create`'s model parameter is NOT honored by the dispatch path —
the prompt goes out with opencode's configured default instead
(landed on `opencode/big-pickle` twice). The model must be passed on
`session.send` itself, and the session's reported model+variant must be
verified after dispatch. spawn.sh does both; hand-rolling this flow is
how the mistake keeps happening.

Owner shorthand: "next new session" = spawn.sh. Always.

## Spawn prompts (ox-alpha runs these on owner's word)

### First session of a sprint
```
Read docs/design/00-BRIEF.md and docs/design/sprints/<SPRINT>.md fully,
plus the last 20 lines of docs/design/DECISIONS.md. You are sprint
<SPRINT>, session C<NN>. Work only inside design/mocks/ and your sprint
spec. Iterate with me live. MAXIMUM reasoning depth.
```

### Continuation session (goal not met / context rotated)
```
Read docs/design/00-BRIEF.md and docs/design/sprints/<SPRINT>.md fully,
plus the last 20 lines of docs/design/DECISIONS.md. This is sprint
<SPRINT>, session C<NN>. A previous session left a RESUME block in the
sprint spec — start exactly there. Do not redo frozen work.
MAXIMUM reasoning depth.
```

ox-alpha fills <SPRINT> (e.g. S01-frame) and the next C number from the
board, then creates the session in this workspace via OpenChamber.

## Resume block template (append to sprint spec)

```
## Session log
### C07 · 2026-08-25 14:20 · PAUSED
Done: composer shell + thought/quote modes frozen (files listed).
In flight: trade mode — entry/stop fields render, R calc not wired.
Next: wire R live-calc demo; then paste-screenshot flow.
Gotchas: backdrop-filter needs -webkit- in base.css (already there);
do not touch tokens.css (S00 frozen).
```

## Freeze criteria (a sprint is FROZEN when)

1. Every screen in the spec's acceptance list exists as a clickable mock.
2. Owner has clicked through on iPhone Safari (via mock.1ed.ge) and said so.
3. Acceptance checklist items all checked in the sprint spec.
4. Board row updated to `frozen` + DECISIONS entry if any pattern was added.

## Publishing mocks

After any session's changes: `cd ../sos-lab && ./lab rebuild 1edge-mocks`
(seconds). Owner views https://mock.1ed.ge on device. Add to Home Screen
for standalone feel. If build fails, report exact output — no workarounds.

## Toolchain (house standard, 2026-08-25)

Every session sources the pinned toolchain before building anything:

```bash
. /home/openchamber/workspaces/.toolchain/env.sh
```

Pinned in `.toolchain/manifest.env` (bun · go · templ · tailwind — one bump
point). Binaries and Go caches live on the persistent workspace mount, so a
fresh container converges in seconds with zero downloads. If a tool is
missing, run `.toolchain/bootstrap.sh` (idempotent). Never ad-hoc install
anything else; propose a manifest bump instead.

## Gate environment

One command does everything — env check, hard timeout:

```bash
sh docs/design/gate.sh design/mocks/_verify/<gate>.cjs   # or no arg = prep only
```

Chromium and its system libs ship in the openchamber IMAGE (environment
truth, above). If gate.sh reports missing libs, the image is stale:
`./lab rebuild openchamber`, then verify — never repair in-place. Gates
verify the LIVE deployed URL after `./lab rebuild 1edge-mocks`. Never npm
inside the repo. If setup breaks, report and stop — never improvise.

New gates are thin data over the shared harness — `require("./lib.cjs")`
(`design/mocks/_verify/lib.cjs`): `makeGate()` gives ok/open/shell/done,
plus `vis`, `targetAtLeast`, `GRAMMAR`, `cleanCd`. Do not hand-roll
assertion plumbing; that is where gate self-bugs come from. Existing gates
migrate opportunistically, never mid-sprint.

## Self-review (headless — house standard, 2026-08-25)

Look at your work BEFORE deploying, without the interactive browser panel
(the panel is the owner's; it also goes unresponsive under load):

```bash
sh docs/design/selfreview.sh /zen/today.html /tmp/opencode/sr.png 390x844
```

Then Read the png and judge it with your own eyes. Desktop default
`1280x900`; always also check `390x844` for one-handed layouts. If the
panel is unresponsive, this path always works — skipping visual review is
not acceptable when a headless route exists.

## Deploy protocol (the clean-tree contract, never a surprise)

`./lab` refuses to build from a dirty tree — that is the deploy contract,
so make the checkpoint step part of the flow, not a mid-deploy obstacle:

1. Commit your sprint work on the working branch (mechanical checkpoint
   commits are fine and expected).
2. `cd ../sos-lab && ./lab rebuild 1edge-mocks` (seconds).
3. Run your gate against the live URL; then self-review (above).
4. Report the live URL + gate score to the owner.

## Long-running ops (runbook — these lessons cost real sessions)

- Never hold a server open in the foreground shell — the tool timeout
  kills the whole process group. Use `setsid cmd > log 2>&1 < /dev/null &`,
  prove it survived, poll the log.
- No foreground `sleep` polling loops; instant checks, repeated.
- Run builds raw or read a log file — never pipe long output through
  tail/grep chains live.
- Long jobs belong in-cluster (kaniko via `./lab`); local supervision
  stays short and stateless.

## Session numbering

Global counter lives in the board (column "Sessions", e.g. `C01 C04`).
When spawning, ox-alpha reads it, assigns the next C number, and records it
in the sprint spec session log header.
