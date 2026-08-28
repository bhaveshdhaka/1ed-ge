# REWRITE.md — 1ed.ge v2 assessment & plan

Status: **P0 approved by owner 2026-08-24.** Design program (P0) precedes all
build work. Frozen mocks are the build contract.

Companion documents:

- `docs/design/AUDIT.md` — dual-POV UX audit (visitor + trader)
- `docs/design/00-BRIEF.md` — design constitution + sprint board
- `docs/design/DECISIONS.md` — append-only decision log
- `docs/design/SESSIONS.md` — how design sessions spawn/resume (anti-context-rot)
- `docs/design/sprints/S00…S09` — sprint specs
- `design/mocks/` — the clickable mocks, served live at https://mock.1ed.ge

---

## 1. Why rewrite

The owner's goals, in order: **fast frontend · post-and-it's-live admin · zen
as the only trading space · visitors get the whole process at a glance · Go +
agentic-optimized stack · no legacy, no baggage, first principles, no
over-engineering.**

The current system cannot meet goal #2 *architecturally*. Publishing is a
build, not a write:

```
save → DATA_DIR/pending.json → owner clicks Rebuild
     → POST /api/admin/rebuild spawns `npm run build` inside the web pod
     → 8–20s+ Astro/Vite/sharp build → dist/ swapped under live server
```

Evidence trail (all verified in-repo, branch `sos-lab`, Aug 2026):

| # | Finding | Where |
|---|---|---|
| 1 | Publish = full static rebuild per save; manual click required | `src/pages/api/admin/rebuild.ts:34-77` |
| 2 | Build runs in web pod under default **1Gi memory limit** (no resources override) → OOMKill is the likeliest prod failure | registry.yaml had no `resources:` for 1edge |
| 3 | Boot = full build before listen (`start.sh`) racing fixed probe timings → CrashLoop class risk | `scripts/start.sh` |
| 4 | Day schema exists three ways: Zod config, hand TS mirrors, hand normalization bypassing Zod | `content.config.ts`, `lib/stream.ts:14-47`, `api/admin/days.ts:18-78` |
| 5 | R/$ math re-implemented ≥4×; one real bug (unguarded divide in brief) ; `expectancy===avgR` duplicated; two drawdown walks | `stats.ts`, `period-stats.ts:83`, `brief.ts:30`, WriteZone.tsx:39 |
| 6 | Non-atomic writes; unlocked read-modify-write on pending.json/sessions.json; sessions file rewritten per request | `content.ts:63`, `changes.ts:31`, `passkeys.ts:68-80` |
| 7 | Private prop-firm ledger (`draft.tradovate`) nested inside public day files | `content.config.ts:91` |
| 8 | Admin god components: 1,011-line DayWorkspace (~30 useState), 973-line RoutinesPanel, event-bus + setTimeout coupling | `components/admin/*` |
| 9 | Public IA sprawl: ~16 routes where ~5 suffice; tracker/trends/performance overlap | `src/pages/` |
| 10 | Docs drift: design-system.md references deleted CI/post-deploy/tokenomics machinery; `/build`,`/status`,`/design` serve a dead pipeline | `docs/design-system.md`, `src/pages/build.astro` |
| 11 | Dead weight deps: unused eventsource-parser, react-table legacy subpath, two markdown pipelines | package.json |

What survives **as concepts** (ported with tests): CME master clock +
session bands (~650 lines, well-tested — the domain knowledge is real), R =
points/risk computed never stored, day-record-as-spine model, x-admin-secret
header gate + WebAuthn passkeys, trader-live heartbeat, terminal design
language intent, files→git as historical archive.

## 2. Locked decisions (owner, 2026-08-24)

1. Stack: **Go single binary** (stdlib `net/http` routing) + **templ**
   templates + **htmx** fragments + **SQLite WAL** + Tailwind v4.
2. Storage truth: **SQLite**, nightly markdown/JSON export to PVC; existing
   markdown stays in git as archive. One-shot importer migrates content.
3. AI scope v1: screenshot vision-structuring + alt-text only. Coach gets a
   stub slot, returns later (current implementation rejected).
4. Tradovate auto-pull cut (reverse-engineered HMAC scraper); CSV import stays.
5. Personal rituals (quiet/nature/exercise/intentions/rewiring/21-days):
   **full port in v1** including soundscapes.
6. Rollout: replace `1edge` in place via lab (rollback = redeploy prior tag).
7. Mocks deploy to **mock.1ed.ge** as a first-class lab service
   (`1edge-mocks`, nginx-alpine, kaniko from `design/mocks.Dockerfile`).
8. Design program runs as separate agent sessions driven by the owner;
   ox-alpha spawns on command. Sprints S0–S9, sessions C01+; resume points
   carry continuity (see SESSIONS.md).

## 3. Target architecture

One binary ~4–6k LOC total incl. tests (vs ~22k today). No node, no npm, no
poppler in the image. Boots in ms; RSS in tens of MB — the OOM/CrashLoop
class of failures ceases to exist.

| Concern | Choice | Notes |
|---|---|---|
| Language/runtime | Go ≥1.23, stdlib `net/http` pattern routing | zero router dep |
| Templates | templ (compiled, type-checked) | template errors are compile errors — agent-optimal |
| Interactivity | htmx fragments + small vanilla JS islands (palette, rituals audio, composer paste) | server-rendered HTML kills client/server contract drift (root disease of old admin) |
| Data | SQLite WAL via modernc.org/sqlite (pure Go) | transactions make audit findings #6 structurally impossible; FTS5 powers ⌘K search |
| Styling | Tailwind v4 CLI → one CSS file; tokens.css shared verbatim with mocks | design here = design forever |
| Charts | server-generated SVG polylines / div heatmaps | technique already proven in current Astro components |
| Images | resize in Go, `cwebp` binary in container | drops sharp/node |
| AI | direct OpenRouter REST (vision structuring, alt-text) | JSON mode, timeouts, fail-soft |
| Auth | same dual gate: x-admin-secret header + go-webauthn passkeys; token-hashed sessions in SQLite | house pattern preserved |
| Publish | write row + invalidate in-proc cache → live next request (<50ms) | pending.json / RebuildBar / boot-build deleted as concepts |
| Jobs | market-news fetch + nightly md export = in-process tickers | no cron infra |
| Deploy | unchanged lab pipeline; image build drops to seconds | registry entry updated at cutover |

### House build standard (owner directive 2026-08-25 — demonstrated, in force)

Top-level decision applying to ALL projects (recorded in sos-lab README +
AGENTS.md). P1–P7 inherit it automatically:

1. Go-first images: `CGO_ENABLED=0` static binary → alpine/scratch + native
   deps only. Measured in prod: `1edge-mocks` 6 MiB, 17–18s kaniko build,
   ~29s tag→live — vs 362 MiB / ~74s+ for the Node-era `1edge` image.
2. Zero JS runtimes in shipped images; Tailwind v4 via pinned standalone
   native binary (4.3.3) at build time.
3. Pinned toolchain for every session: `/home/openchamber/workspaces/.toolchain/`
   (manifest.env → bootstrap.sh → env.sh; bun 1.4.0 · go 1.27.0 · templ
   v0.3.1020 · tailwindcss 4.3.3). Binaries + Go caches persist on the
   workspace mount; fresh containers converge in seconds.
4. Bun is the JS package manager of record for transitional work — measured
   975 pkgs in 2.9s where `npm ci` fails outright in the dev container.
5. Sprint-session stability kit: shared gate harness (`_verify/lib.cjs`),
   headless self-review (`docs/design/selfreview.sh`), deploy protocol +
   ops runbook codified in `docs/design/SESSIONS.md`.

### SQLite sketch (~15 tables)

days · trades · trade_executions · thoughts (+thought_images) · accounts ·
account_stages · payouts · habit_defs · day_habits · routine_sessions ·
models / rules / quotes · reviews · media · market_news · passkeys ·
sessions(token_hash). R never stored; computed in one guarded function.
FTS5 over reflections/thoughts/trade notes.

### Zen cockpit (v1)

One surface, zero tabs. Top bar (brand · CME clock/session · pulse) → docked
composer (thought/quote/trade, live R, paste-anywhere screenshots, Enter =
published globally instantly) → today rail (facts strip, trades, news,
stream, reflection obligation) → rituals panel (full port, timers +
soundscape island) → evening review mode. Everything else behind ⌘K.
Autosave always; undo replaces confirms; publish implicit.

### Public site

Five routes: `/` · `/day/[date]` + period rollups · `/performance` ·
`/models` · `/about`; plus rss.xml, sitemap.xml, media SSR, native `<dialog>`
lightbox. True zero framework-JS.

## 4. Phases

| Phase | Deliverable | Gate |
|---|---|---|
| **P0** | this doc set + AUDIT + harness + mocks scaffold + mock.1ed.ge live | owner review |
| **P0b** | S0–S9 design sprints (owner-driven sessions; S0 frozen only after owner's visual references) | every sprint frozen |
| P1 | Go scaffold: module, templ+tailwind pipe, migrations, auth (header+passkey), /health, Dockerfile | container boots; go test green |
| P2 | importer (md→SQLite), clock port + tests, stats engine + tests | importer output matches old pages |
| P3 | public SSR five routes + rss/sitemap/lightbox | Lighthouse ≥ current |
| P4 | zen v1: frame, composer, rail, uploads+vision, habits/device, instant publish, palette+search, heartbeat | e2e: post→live <1s |
| P5 | rituals full port, reviews/accountability, CSV import, news fetcher | ritual walkthrough w/ owner |
| P6 | hardening: Playwright specs, OG/meta, export job verified, AGENTS.md + design-system rewritten for v2 | full test suite |
| P7 | cutover: merge v2 → `./lab rebuild 1edge` → verify post-is-instantly-live → retire Astro path | owner confirms live |

Note: `/zen` currently locked (ADMIN_SECRET empty by owner choice in
sos-lab secrets). Must be set before P4 auth/e2e can run against prod-like env.

## 5. Risk register

| Risk | Mitigation |
|---|---|
| In-place cutover breaks prod | rollback = `./lab rollback 1edge` (previous tag); parallel verification before switch |
| Design churn stalls build | sprints timeboxed by goals; frozen screens immutable without DECISIONS entry |
| templ/htmx unfamiliarity | S0 foundation page doubles as living styleguide; patterns established before volume |
| Content loss on migration | importer is idempotent + diffed against old site before cutover; source markdown untouched |
| Scope creep in rituals port | S04 spec bounds it; anything new = new decision entry, not silent growth |
