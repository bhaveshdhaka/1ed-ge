# MEMORY — 1ed.ge

Living project memory. This file is loaded into every agent session. Append
decisions, gotchas and open items here; keep it short and factual.

## Top rule — ship it

**Commit + deploy + verify live after every meaningful change.** The owner looks
at `https://1ed.ge`, never the working tree. Local `dist/` and port-4323 test
servers do NOT count as "done". Workflow: typecheck → commit → `bash
scripts/deploy.sh` → poll until live → curl-verify the changed bits. Kill test
servers when finished.

## HANDOFF — next agent, the market/homepage work (read first)

**State: working tree clean, all committed + deployed + verified live.**
Live: homepage has the market narrative strip + rich footer, `/stream`,
`/calendar` — all CME-futures-framed.

**This session shipped (commits):**
- **The context-aware market narrative strip (the PENDING chunk, done).** New
  `src/lib/strip.ts` is the SINGLE source of truth for every conversational market
  phrase (homepage strip, site-wide footer, live ticker) — precomputed absolute-time
  segments per market (`CME Globex open · maintenance in`, `Tokyo on lunch break ·
  back in`, `London opens in`, …), `fmtHuman` durations, next-event + `{Name}
  speaking` lines (speakers matched from red/orange titles only). New
  `MarketFooter.astro` on every public page (condensed master-line + per-band
  transitions + news countdown + speaker, expandable `<details>` for the full
  narrative + `NewsBlock`). `MarketWidget` reworked onto segments + `daySessionWindows`
  (fixes TSE lunch window bug, CME `~24h` hardcode) and embedded under the `/` hero
  with a trader-live moniker. New `NewsBlock.astro` (dot severity — NO words
  red/orange — time, title, `[TV]`/`[FF]`, `✦`). `newsHeadline()` added. Calendar +
  day-page news blocks swapped. **Terminology corrected:** the market is **CME
  Globex** (equity-index futures), never "MNQ futures" — MNQ is the Micro E-mini
  Nasdaq-100 ticker, not a market. Commit to be added below once pushed.
- `90283c0` — homepage de-cockpit: `/` = SSR hero + today facts + today's stream.
  Killed the cockpit mirror (rails/quotes/self-talk) from `/`. New `src/lib/stream.ts`
  (`resolveMoments`, `flattenStream`, `dayFacts`, `momentMeta`),
  `src/components/stream/{MomentCard,DayFacts}.astro`.
- `c5bb0bc` — `/stream` SSR rolling feed + `?type=` filter + today-so-far +
  live moniker. New `src/lib/live.ts` (`readLiveState` reads
  `/tmp/1edge-live.json`, 5-min window). Nav `[01] stream`.
- `03c7673` — **CME is the master clock.** `cmeDay()` in `src/lib/market.ts`
  (CME equity-futures calendar: closed only NYD/Good Fri/Juneteenth/July4/
  Thanksgiving/Xmas + weekends; MLK/Presidents/Memorial/Labor are normal CME
  days). `scheduledDayMarker` + `marketMarker` CME-based; early-close copy = `1:15pm ct`.
- `4f88e91` — **CME closed ⇒ everything closed.** `marketEvents` suppresses
  NYSE/TSE/LSE bands entirely on CME-total-close days; cash bands still render on
  CME early-close days. `MarketLive.astro` footer now CME-event-driven.

**Domain model (owner-confirmed, DO NOT re-litigate):** CME futures is the only
clock. If CME is totally closed for the day, EVERYTHING is closed (no TSE/LSE/
NYSE bands — they can't trade CME futures). Only two states to track: CME
**early-close** days (`1:15pm ct`, cash exchanges still trade) and CME
**total-close** holidays. TSE/LSE/NYSE are informational bands on CME-trading days.
Terminology: the market is **CME Globex** (equity-index futures on CME's electronic
platform); **MNQ** is the Micro E-mini Nasdaq-100 futures *ticker*, never a market name.

**Roadmap after:** day-page posterized archive (then delete `src/components/cockpit/`),
`/models`, `/journal` on primitives, Phase 2 admin rework, Phase 4 remediation
(money-color bugs, path traversal, rebuild mutex, tests, docs).

**Backlog — LOWEST priority (owner moved it here; do NOT research web archives for it):**
futures contract-rollover widget (active front-month ticker + next rollover date),
sitting on the homepage, separate from the calendar. Known facts from prior research:
equity-index quarterlies ES/NQ/MES/MNQ roll on 3rd Friday of Mar/Jun/Sep/Dec; WTI
crude CL/MCL are monthly contracts (last trade 4 business days before the 25th of the
prior month); gold GC/MGC list Feb/Apr/Jun/Aug/Oct/Dec. Not started; just a note.

**Gotchas:** SSR `/` + `/stream` read content from server start — deploy restarts, so
rebuild alone won't update them (deploy+verify mandatory). `npm run build` clears
`node_modules/.astro` — keep it. Autosave cron commits every 30 min and may sweep your
changes up with content — verify your diff landed, don't fight it. `pkill -F pidfile`
(never `pkill -f pattern`). No parallel agents/builds (race on `node_modules/.astro`).
Local test server must run on 4323 (4321 is the prod docker container); bind HOST=127.0.0.1.

---

## HANDOFF — next agent, my shortcomings this session (read first)

The owner asked the previous agent to document its shortcomings so you don't
repeat them. The owner was frustrated with the previous agent's behavior. Be
deliberate, not reactive; verify before claiming; always ask "who is each UI
surface for?". Concrete failures to avoid:

1. **Reactive patching, not holistic review.** When flagged ("why is the
   extract box on the public homepage?"), the agent fixed one box instead of
   reviewing the whole day page. The real issue was data duplicated 2–3×
   across the cockpit and the legacy sections below it. Fix the class of
   problem, not the instance.
2. **Commit messages must match the actual diff.** Commit `319b0ee` claimed
   "drop legacy stats grid + / reflection" but only the stats grid was removed;
   the reflection removal had to be redone in `52b3ca8`. Check `git diff`
   before writing the message.
3. **Upload server shipped with a client/server path mismatch.** The drag-drop
   page POSTed to `/upload` but the server only accepted `/TOKEN/upload` — the
   owner's first uploads failed silently (403). The agent tested the curl path
   but not the browser client path. Test the layer the user actually uses.
4. **`pkill -f '<pattern>'` self-match.** Running `pkill -f upload-server.mjs`
   from a shell whose own command line contains that pattern kills the shell
   itself (tool hangs/times out). Use stored PIDs (`pkill -F pidfile`) or a
   pattern that cannot match the invoking command. Also avoid `&`/`nohup`
   patterns that hang the shell tool.
5. **Author-only vs public UI.** Public pages render author-only UI if you
   mirror the cockpit blindly. The extract drop zone, "draft · saved ·
   synced", and the composer are for the owner only (auth-gated in P3). Public
   gets `{date} · ● live/logged · public`.
6. **Stop when told to stop.** The owner said "wrap up" and the agent kept
   committing/deploying. When the owner wants out, freeze the tree and hand off.
7. **Answer from the data, don't ask.** The agent asked which prop firm the
   Tradovate accounts belong to; the owner's statement "2 lucid 50k accounts"
   + the internal account list is the answer. Only ask when the data cannot
   answer.
8. **Repo state at handoff:** live = author-only UI fix (`3cb38ce`) + day-page
   de-dup stats-grid removal (`319b0ee`). Committed, NOT deployed =
   `52b3ca8` (removes the legacy `/ reflection` section — the live day page
   still shows it). **Ask the owner** whether to deploy it, keep it un-deployed,
   or revert the whole day-page de-dup. Do not deploy or revert without asking.
9. **The ingest feature is designed, not built.** See
   `docs/superpowers/specs/2026-08-06-ingest-pdf-csv-design.md`. The owner
   wants it executed, not re-designed. Do NOT re-litigate the design with the
   owner.
10. **Demo artifacts:** the owner's real Tradovate exports are in
    `/tmp/opencode/import-demo/` (evidence for the ingest build). The upload
    server is stopped; the files are untouched.

## OPEN STATE (2026-08-06) — SHIPPING WITH FILLER DATA

The review is done and the generated data ships live **as the site's content**
(owner decision — "keep the review data filler"). All of it is committed and
deployed in this session; the autosave cron is active again.

- `scripts/seed-review.mjs` generated: 730 day records, ~800 trades, ~155
  journal posts (long+short, non-lorem), 24 coach convos, 8 payouts, 6 accounts
  (lifecycle incl. 1 failed). It CLEARS `src/content/{days,journal,payouts,
  coach,accounts}` on run — do not run it against the live tree.
- **Summit is the only theme.** aurora/mono, the admin design tab, the theme API,
  and the theme-preview route are deleted. `src/lib/site.ts` gone; layouts hardcode
  `data-theme="summit"`. `src/config/site.json` is inert (no importers).
- Real feature shipped in the same merge: **search-as-you-type on /journal** —
  `src/pages/api/journal/search.ts` + inline debounced filter in
  `src/pages/journal/index.astro`. Zero external script resources.
- Live site (`1ed.ge`) now runs the final summit build with filler content.
- Local review servers: summit `:4323` (in-tree `dist/`), aurora/mono removed.

## Decisions

- **Brand = one fixed wordmark (v06 "baseline tape"), not per-theme marks.** Font-only
  lockup: JetBrains Mono **1** + Syne **edge** + trailing soft `_`, pure monochrome, tape-scan
  sheen + underscore flash/pulse. Same on all themes; nav 18px → 22px; admin header matches.
  Fonts: `@fontsource-variable/syne` added (space-grotesk + sora were tried for logo
  concepts then removed).
- **Generated graphics rasterize via sharp/librsvg, NOT headless Chromium screenshots.**
  The headless Chromium on this VPS mis-rasterizes large text (glyphs painted ~3.7x or
  fragmented). `scripts/lib/brand.mjs` builds SVG with embedded fonts → sharp PNG. Drives
  `favicon.svg` (vector, embedded fonts — doubles as the master logo), PWA icons, og.png.
- **R is the centerpiece.** Risk-based metrics everywhere; `R = points / riskPoints`.
- **Everything public except the admin.** The 2-year proof is the product.
- **The day record is the spine.** `days/<date>.md` holds mood, sleep, habits,
  screen-time (`device`), and trades (with per-account `executions`). One idea,
  executions across accounts. Everything is linked.
- **Accounts are lifecycle instances** (`eval → buffer → payout`, plus
  `failed`/`paused`) with a `stages[]` history; payouts reduce net P&L so
  drawdown/buffer math stays honest.
- **Files are the database.** Content lives as Markdown frontmatter in
  `src/content/`, git-backed, auto-committed by cron every 30 min.
- **Astro 5.18 removed `output: "hybrid"`** → static + per-route `prerender = false`.
- **Admin reads/writes via fs** (`src/lib/content.ts`), never via cached
  content collections.
- **Save ≠ rebuild.** Mutations queue a pending change
  (`/tmp/1edge-pending.json`); the sticky RebuildBar shows them and rebuilds on
  command (~8–20s). Rebuild history in `/tmp/1edge-rebuilds.json`.
- **Journal editor is Milkdown Crepe** (`@milkdown/crepe`), not a hand-rolled
  editor. Its ImageBlock `onUpload` uploads pasted images to the media API.
- **AI-first day input:** paste text + screenshots anywhere (global clipboard
  paste sink); `structureDayFull` reads everything in one pass — Qwen2.5-VL for
  image days, DeepSeek for text-only — and returns the whole day (mood/sleep/
  habits/device/trades) **plus a suggested journal** (title/summary/tags/draft).
  Same schema/tone either way.
- **One day = one admin screen (v0.4).** The "day" tab: capture → day summary →
  reflection (Milkdown) → one Save. **Evidence first:** values render read-only
  with rare ✎ overrides; screen-time hours come from the screenshot, never typed.
  The journal owns no structured fields (mood/sleep live in the day record).
- **Evidence-first overrides are direct-click (v0.5).** Click the value itself
  (dashed-underline affordance), never a ✎ button; `Esc` cancels.
- **Admin day navigation is picker-first.** Native date input + mini 12-week
  calendar + recent-days list; the flat "all days" sidebar list is gone.
- **Journal index is SSR.** `/journal` uses `prerender = false` for `?q=` search
  (title/summary/tags/body/date) + month grouping. SSR routes read the content
  store from server start — a rebuild alone won't update them; the server must
  be restarted (deploy does this). Static pages pick up rebuilds in place.
- **Zero-JS still holds on public pages.** Mobile nav is a `<details>` hamburger;
  the only inline JS is the SW registration and a one-line date-jump handler.
- **PWA shipped.** `public/manifest.webmanifest` + network-first `sw.js` + PNG
  icons generated from `favicon.svg` via sharp. SW skips `/admin`.
- **Models:** DeepSeek `deepseek/deepseek-chat` (text day / coach / assist),
  Qwen2.5-VL `qwen/qwen-2.5-vl-72b-instruct` (image days + screenshots), both
  via OpenRouter. Overridable in `.env`. Cost ≈ $1–3/month at a few calls/day.
- **Media:** uploads → `sharp` → webp (max 1920w) into `public/media/<date>/`.
  Served by SSR route and proxied via nginx.
- **f-R-iend (coach)** reads the live trend snapshot + remembers prior advice,
  asks questions, and publishes its notes on `/coach`. Public by design.

## Gotchas

- **Content-layer cache.** Astro caches collections at
  `node_modules/.astro/`. `npm run build` clears it (`rm -rf node_modules/.astro`)
  so deleted files disappear from the static build. Never remove that from the
  build script. Symptom if removed: stale pages survive rebuilds.
- **`/tmp/1edge-*.json`** (build status, pending, rebuilds) live in the
  container's /tmp — lost on container restart (content files are the source
  of truth; only the queue is ephemeral).
- Public pages must stay **zero-JS** (SVG charts, no React).
- The VPS system resolver does not resolve `1ed.ge` — use
  `curl --resolve 1ed.ge:443:104.21.7.179` locally.
- nginx can't `alias` to `/root/...` (mode 700) → proxy `/media/` to node.
- `.env` must never be committed; `.env.example` is the template.
- Rebuild writes to `dist/` in place while the server runs — safe on Linux,
  low traffic.
- Nav labels are plain (`[00] home`). No `~` in the menu.

## Open items / roadmap

- [x] **Market widget** — DONE. `MarketWidget.astro` + `src/lib/sessions.ts`
      (CME maintenance halt, TSE, LSE, NYSE, US holidays, DST via Intl) on the
      homepage + day pages + `/calendar` week view. News is zero-inference
      (verbatim rows + `[TV]`/`[FF]` + `✦` verified, no merging). JP/UK holiday
      rules (substitute-holiday chains, weekend shifts) done.
- [x] **Statement-driven accounts (P3)** + **daily brief (P4)** — DONE. Paste a
      statement screenshot → AI proposes → confirm → apply (stage history +
      auto payout). Admin Overview generates the pre-market brief from verified
      data into `src/content/brief/`, public on homepage + day page.
- [ ] Move to Cloudflare Pages + CDN (all content file-based → ports cleanly).
- [ ] **Safari/iOS/iPhone polish:** viewport-fit + apple metas + tap-highlight
      already in. Next: safe-area insets, bigger touch targets, `@supports
      (-webkit-touch-callout)`, optional PWA/manifest, test on a real iPhone.
- [ ] Full public /trends is live; consider a `/review` weekly report page.
- [ ] Account configs are seeded defaults — confirm real risk per trade /
      drawdown limits with the owner before heavy usage.
- [ ] Possible future: CSV bulk import of prop-firm statements; auto stage
      transitions on drawdown breach.

## Session log (recent)

- 2026-08-07 — **Stream System public surfaces + CME master-clock, live.**
  (a) **Homepage de-cockpitted**: `/` = SSR intro hero + today facts + today's
  stream; the cockpit mirror (rails, buffet/collier quotes, self-talk) is gone
  from public. New `src/lib/stream.ts` + `components/stream/{MomentCard,DayFacts}`.
  (b) **`/stream`** SSR rolling feed, `?type=` filter, today-so-far, live moniker.
  (c) **CME = master clock**: `cmeDay()` — US-centric futures calendar (closed only
  NYD/GoodFri/Juneteenth/July4/Thanksgiving/Xmas + weekends); MLK/Presidents/
  Memorial/Labor are normal CME days. `scheduledDayMarker`/`marketMarker`/footer
  ticker all CME-based; early-close copy `1:15pm ct`. **CME closed ⇒ everything
  closed**: NYSE/TSE/LSE bands suppressed on CME-total-close days; cash bands
  still render on CME early-close days. Verified live: Thanksgiving all-bands
  closed, Black Friday `◐ early close 1:15pm ct` + bands, Labor Day `○ open`.
  Commits `90283c0` `c5bb0bc` `03c7673` `4f88e91`, all deployed + verified.
- 2026-08-07 — **Stream System, Phase 1 shipped (data model + credible review data).**
  Content schema extended: day records gain `stream: []` (approved moments:
  pre-market/post-market/trade/note/quote/media) + `draft:` (private, never
  rendered), trades gain `model` tags + optional `commentary`, habits v2
  (`kind: bool|count`, `target`, `category`, `order`, `active` — 14 seeded
  across health/trading/discipline/mind), new `models` collection with per-model
  rules (two-level rules), account lifecycle adds `funded`
  (`eval → funded → buffer → payout`). `scripts/seed-review.mjs` rewritten so the
  live filler is credible: **positive edge** (expectancy +0.28R, PF 1.57, 55%
  WR), **no trades on holidays** (verified against the site's own `marketDay()`),
  losses honor the stop (~1R), every trade tagged with a model, journal prose
  generated from actual day data (no "one trade"/"long"/"++" contradictions),
  account lifecycle **derived from simulated equity** so payouts ≤ net
  (lucid-25k-a +$3137 → $1500 paid in payout; tpt-25k-a −$1280 **failed**
  2026-11-02 with post-mortem post), one day-zero. One execution assignment
  drives day files + account math (single source of truth). Typechecked, built,
  committed, **deployed + verified live** (homepage, /accounts failed account,
  payout + failed day pages, admin 200).

## HANDOFF — WRAP-UP STATE (2026-08-07, end of session)

Owner wants to resume in a new session. **Phase 0 (design system) and Phase 1
(data model + credible review data) are DONE, committed, deployed, verified
live.** Phases 2–4 remain. Full spec: `docs/superpowers/specs/2026-08-07-stream-system-design.md`.

**Remaining work (in order):**
- **Phase 2 — Admin rework**: DayWorkspace on the new primitives (draft
  reflection, moment composer, per-trade commentary + model tag, publish
  buttons), Library tab (habits/models/quotes/rules CRUD), **Milkdown → plain
  markdown textarea + preview** (remove `@milkdown/crepe`, delete
  `src/components/admin/editor.css`), safety fixes (dirty-guard on tab switch,
  no wipe-on-paste, loud rebuild failures, AI timeouts, aria labels, heartbeat
  `/api/admin/ping`).
- **Phase 3 — Public surfaces**: `/stream` (SSR feed + "trader is live" +
  "today so far"), homepage intro hero + today's stream (SSR), `/day/<date>`
  posterized archive (facts + moments, NO cockpit mirror), `/models` page,
  journal index rebuilt on primitives. Master clock = **CME 23h futures day**,
  TSE/LSE/NYSE as bands. Public stays zero-JS.
- **Phase 4 — Remediation**: money-color bugs (performance/accounts/about/
  DayWorkspace green-for-negative), tablet breakpoint (rails at 768–1023px),
  floating sticky subnav, journal API path traversal (`GET /api/admin/journal?
  file=`), early-close copy (`1:15pm ct` vs `1:00pm et`), rebuild race (mutex),
  unit tests for stats/sessions/timeline, then typecheck → build → deploy →
  verify live.

**Docs to update as you go:** `AGENTS.md` and `MEMORY.md` still describe
Milkdown and the "everything public except the admin / day-record-as-mirror"
era — update them when the admin editor swap and the public surfaces land.
Note `scripts/seed.mjs` (old, non-review seed) may re-add a Day-Zero on
2026-08-06 if ever run — it was the duplicate-day-zero source; prefer
`seed-review.mjs`.

**On launching new agents to parallelize:** yes, but with guardrails — see the
recommendation at the end of the session summary. The phases are sequential
(2 → 3 → 4) with heavy shared surface (public pages touch the same primitives/
tokens), so parallel agents should NOT split one phase; the safe parallel unit
is one phase's independent files (e.g. Phase 2's Library tab vs DayWorkspace are
both admin React — can split by tab) with a strict gate: each subagent task ends
with `npm run typecheck` + commit, and no two agents build at once (builds race
on `node_modules/.astro`).

- 2026-08-07 — **Stream System, Phase 0 shipped (design-system foundation).** The
  owner approved a full rebuild ("the UI has no method to the madness") around
  **shadcn/ui conventions**: Tailwind v4 `@theme` tokens in `src/styles/app.css`
  (summit palette + full type scale `text-3xs`…`text-5xl` + `text-quote`,
  weight/leading/tracking, one radius/shadow), zero-JS Astro primitives in
  `src/components/ui/*` (Button/Card/Badge/Table/StatCard/Quote/Icon/Flag…),
  React/Radix admin primitives in `src/components/ui/react/*`, and
  `.opencode/skills/design-system/SKILL.md` as the enforcement skill. Dead CSS
  purged, a11y fixed, deployed + verified live. **Product model locked:** cockpit
  (private) → **approved** moments → public stream (`/stream` SSR, `/` hero+stream,
  `/day` posterized archive); master clock = **CME 23h futures day** with TSE/LSE/
  NYSE as bands; **no AI gyaan** — rules/quotes/self-talk are 100% owner-authored;
  Milkdown **out** (plain markdown textarea + preview); habits v2 (bool/count,
  categories, admin-managed); two-level rules (overall + per-model); trading
  models with per-trade tags; account lifecycle `eval → funded → buffer → payout`
  gated. Full spec in `docs/superpowers/specs/2026-08-07-stream-system-design.md`.

- 2026-08-06 — **Ingest feature (PDF/CSV) — designed, not built. Next agent owns it.** The owner wants
  a **daily drag-and-drop ritual**: throw trade screenshots / CSVs / PDFs into the cockpit drop zone,
  the AI parses + dedupes, **the owner approves every trade** before it lands (day records + accounts).
  Demo validated with the owner's real Tradovate exports (still in `/tmp/opencode/import-demo/`):
  - **Owner's real accounts: 2 × Lucid 50k** (Tradovate ids `LTE05061295040002`, `LTE05061295040003`).
    Trade: MNQ scalps, up to 25 contracts, ~30 per-fill "trades" per account / day, 80% win, ~$306 net/day each.
  - **Tradovate exports have NO firm/size/equity** — only platform account id + fills + P&L. The platform
    account id (`LTE…`) is the ONLY join key to internal accounts. Full design rules in
    `docs/superpowers/specs/2026-08-06-ingest-pdf-csv-design.md`.
  - Files: Performance CSV/PDF (per-fill trades, NO account id) + Orders CSV/PDF (account id, order fills).
    Must cross-reference fill IDs to attribute Performance→account. Dedup per-account (CSV+PDF of same
    account = same data; two accounts copy-trading must NOT collapse). Group per-fill → position/idea
    (~30 fills ≈ 4 ideas) or the journal will look like overtrading.
  - Pipeline rules decided: platform-id → internal-id **alias map** (owner confirms once, then auto);
    propose+confirm for unknown accounts; approve-every-trade; source files ephemeral (like screenshots).
  - PDF reading on the box needs **poppler-utils** (installed on the host for the demo; the Dockerfile
    must add `apk add poppler-utils` for the real pipeline). Vision (Qwen2.5-VL) on rendered pages is
    the proven path for statement reading; CSV → deterministic parse + LLM column-maps to trade schema.
  - **Live/late context for the next agent:** only the account list in admin is truth; the owner has
    "currently 2 lucid 50k accounts". Do not re-litigate the design with the owner — execute it.
- 2026-08-06 — **Day page de-dup fix.** Removed the legacy stats grid
  (committed 319b0ee, deployed); removed the legacy `/ reflection` section
  (committed 52b3ca8, NOT deployed). Cockpit WritingDoc now owns journal +
  mood/sleep/screen/mac/summary/tags. Author-only UI (extract zone,
  "draft · saved · synced") hidden from the public render (committed 3cb38ce,
  deployed). Deploy status for 52b3ca8 is the owner's call — see HANDOFF §8.
- 2026-08-06 — **P1 shipped: Day Cockpit Shell + IA.** The day page is the
  cockpit: 24h HKT timeline (session bands + hazard dots + now-marker) in the
  ambient strip, left rail (rules/quotes/habits/self-talk/coach), center
  writing surface, right rail (extract drop + today record). Homepage = today;
  nav 9→6; `/tracker`+`/trends` merged into `/performance` and deleted. Muted
  sage/clay palette (WCAG-AA), mono-only type (Newsreader dropped). New
  `rules`+`quotes` collections, `cockpit.json`, `lib/timeline.ts`. Executed
  via subagent-driven dev (8 tasks, reviewed; final review found a blank
  WritingDoc — lowercase `journalContent` renders a literal element, fixed via
  uppercase alias — plus 3 a11y contrast fixes). Test suite green 68/68;
  fixed a stale SSR-journal-search e2e (search is client-side now).
- 2026-08-06 — **Design spec approved: the Day Cockpit** (docs/superpowers/
  specs/2026-08-06-day-cockpit-design.md). One page you live in: writing, not
  chat (Ghost rhythm but mono/hacker type); AI refine→approve loop (submit 🤖
  publish 🌐); screenshots are ingest-only (ephemeral extract, never saved);
  habits are ticked (never screenshot-fed), AI may infer from a relevant shot;
  coach speaks at boundaries (pre-market line, end-of-day debrief on the day
  page, chat invoked inline from a sidebar link — not a separate page);
  hazard = 6px clay dot that pulses only inside the 30-min window, never the
  word "red", no cards. Files-as-db confirmed right for single-user.
- 2026-08-06 — **P3 + P4 + holiday refinements.** Statement-driven accounts:
  paste a prop-firm statement screenshot in admin → AI proposes firm/size/
  equity/buffer/stage/payout/note → confirm → apply (stage appended to
  lifecycle, payout auto-logged). Daily pre-market brief: admin Overview "AI
  draft" builds a deterministic snapshot (sessions + red/orange news + last
  day R/mood/sleep) and the LLM writes prose only — saved to
  `src/content/brief/<date>.md`, public on homepage + day page. Japan
  substitute-holiday chains + UK shifts verified. Typechecked, built, deployed,
  verified live.
- 2026-08-06 — **Market widget v2 + context-aware markers.** Rewrote the widget
  as a session ticker: mono-only type (the header was an `h2` → Newsreader serif,
  that was the "MARKET different font" bug), flags 🇺🇸🇯🇵🇬🇧 + 📈 futures,
  live **HH:MM:SS** countdowns (MarketLive now ticks seconds site-wide too),
  rows re-sort live by next HKT event, and a 00–24 HKT day-timeline with a
  moving now-marker. Market markers are now **context-aware**:
  `scheduledDayMarker()` → green ● only when actually open (today); other dates
  show `○ open 21:30→04:00 hkt` / `✕ closed · holiday`. News is de-noised:
  same-time events collapse to one row + per-type emoji (`newsEmoji`/`
  groupNewsByTime`). /calendar day cards lead with news, clean session chips,
  no +1d noise. Typechecked, built, deployed, verified live.
- 2026-08-06 — **Dashboard shipped: market widget + week calendar.** New
  `src/lib/sessions.ts` — deterministic, DST-aware CME/TSE/LSE/NYSE session
  times in HKT (CME maintenance halt 05:00–06:00 summer / 06:00–07:00 winter,
  NYSE/TSE/LSE with DST via Intl, JP/UK holidays). `MarketWidget.astro`
  (status + per-market live countdowns + news) embedded on homepage + day pages;
  new `/calendar` week view (nav [02]); news switched to **zero-inference**
  (every row verbatim + `[TV]`/`[FF]` badge + `✦` when both sources confirm;
  no merging). Typechecked, built, deployed, verified live.
- 2026-08-06 — **Phase 2 shipped: live market status + USD news.** Every page
  footer + homepage + day pages + admin show a live countdown (● open — closes in
  3h 12m, half-day 1:00pm ET) from a deterministic US-holiday schedule
  (`marketSchedule()`); `src/content/market-news/<date>.md` holds red/orange USD
  events in HKT — TradingView primary (importance 1→red, 0→orange) + FF
  cross-verify (±2min UTC bucket), zero AI. Day-page strip, homepage one-liner,
  admin market card with ↻ refresh (`POST /api/admin/market`). News blocks are
  native `<details>` toggles (homepage collapsed → next red; day page open).
  8h cron via `docker exec 1edge-site`. Typechecked, built, deployed, verified live.
- 2026-08-06 — **Phase 1 shipped.** Unified `/day/<dd-mon-yyyy>` (days ∪ journal ∪
  coach; reflection + coach sections, hairline empty states), fmtDay URLs
  everywhere (no redirect routes — site not launched, old `/journal/<id>` /
  `/day/<iso>` URLs simply don't exist), client-side journal search (inline
  JSON index, ranked, `/`/`Esc`, sticky month chips, back-to-top),
  `src/lib/market.ts` (●/◐/✕) on day pages + homepage. Typechecked, built,
  deployed, verified live.
- 2026-08-06 — **Shipped.** Collapsed to summit-only (deleted aurora/mono, the admin
  design tab, theme API, theme-preview route, `lib/site.ts`), merged everything
  (review filler + brand + journal search) to main, deployed to 1ed.ge, autosave
  cron re-created by deploy.sh. Filler data is live by owner decision.
- 2026-08-06 — Brand finalized as **v06 baseline tape** (mono `1` + Syne `edge` + soft `_`,
  tape scan). Applied everywhere: Brand.astro (theme-independent), nav 18→22px, admin header,
  favicon.svg (vector), PWA icons, og.png. Raster pipeline switched from headless Chromium to
  sharp/librsvg (Chromium mis-rasterizes large text on this box). Restored the summit review
  server on :4323 after an accidental pkill (serves the rebuilt in-tree dist/ — same review data).
- 2026-08-05 — Rebrand to **1edge** (no TLD): gradient "1" + soft glow + gradient
  edge-line that draws in on load, shimmers subtly, glows on hover (pure CSS,
  reduced-motion safe). Dropped the blinking `▋` cursor everywhere; hero prompt is
  now `$ whoami` → `> the edge is all we need.` Applied to nav, admin header,
  footer, OG image. Committed + deployed + verified live.
- 2026-08-05 — Perf/a11y pass + verification stack: Playwright E2E (48 tests,
  desktop+mobile, public+admin+axe), Lighthouse CI with zero-JS budget. Final
  LHCI: Performance 0.97–1.00, Accessibility 1.00, Best-Practices 1.00, SEO 1.00
  on all 8 public URLs. axe public violations 295 → 0. Tracker HTML 284K → ~40K.
  Emoji 📈 favicon + full-color PWA icons; og.png generated. `--color-dim/faint`
  brightened for WCAG AA. Note: LHCI writes reports to `.lighthouseci/` (gitignored);
  `astro check` OOMs if `playwright-report/`/`test-results/` exist → they're excluded
  in tsconfig + gitignored.
- 2026-08-05 — v0.5 UX pass: mobile hamburger nav (no horizontal scroll), 44px
  tap targets, direct-click evidence editing (✎ removed), date-picker + mini
  calendar day browser, expand-all trades, collapsible RebuildBar with rebuild
  progress + publish link, admin keyboard shortcuts (⌘S, 1-5, ⌘←/→, t, ?),
  Day X/730 homepage counter, SSR journal search + month grouping, prev/next
  day nav, accounts lifecycle stepper, coach quick prompts + data panel, media
  date-grouping + search, sticky section nav (performance + day workspace),
  PWA (manifest + SW + icons), admin preview route for unbuilt days. Tested
  end-to-end via the running server (save → pending → rebuild → live day page);
  test data cleaned up after.
- 2026-08-05 — v0.4: one "day" workspace (capture → evidence-first summary →
  reflection → one save). Screen-time values come from screenshots only; rare ✎
  overrides. Journal schema dropped `mood` (day owns it); `structureDayFull`
  now suggests title/summary/tags/draft; "AI draft from today"; public journal
  posts embed the day strip. Tested end-to-end and deployed.
- 2026-08-05 — v0.3: save≠rebuild with a pending-changes RebuildBar, day
  browser (browse/edit/hard-delete old days), clipboard paste-anywhere,
  AI-first whole-day structuring with screenshots, Milkdown Crepe journal
  editor (replaced the hand-rolled TipTap wrapper), rebuild history. Tested
  end-to-end and deployed.
- 2026-08-05 — v0.2: day-log model (mood/sleep/habits/screen-time + trades with
  per-account executions), account lifecycle + payouts, public /day, /trends,
  /accounts, /coach, f-R-iend coach, all tested end-to-end and deployed.
- 2026-08-05 — v0.1: full site + admin + AI pipeline, deployed on VPS
  (docker + nginx), domain live on Cloudflare (Flexible SSL).

## PENDING — Handoff: DONE (Phase 1 + Phase 2 shipped, live)

Both phases are DONE, deployed, and verified live:

**Phase 1** — unified `/day/<dd-mon-yyyy>` (days ∪ journal ∪ coach in one page
with reflection + coach sections), `src/lib/dates.ts` (fmtDay/parseDay), no
redirect routes (site not launched), every `/day/<iso>` link repointed, tracker
last-7 dims non-record days, client-side inline-index journal search (ranked,
`/` focus, `Esc` clear, sticky month chips, back-to-top),
`/api/journal/search` deleted.

**Phase 2** — live market status with a real-time countdown on every page footer,
homepage + day pages + admin (● open / ◐ early close / ✕ closed · holiday,
half-day close 1:00pm ET), driven by `src/lib/market.ts` `marketSchedule()`
(US bank holidays + early closes). USD news calendar
(`src/content/market-news/<date>.md`, red/orange, HKT times) from
`scripts/market-news-fetch.mjs` — TradingView primary (importance 1→red,
0→orange) + Faireconomy cross-verify (±2min UTC), zero AI. Day-page strip,
homepage one-liner, admin market card + `POST /api/admin/market` refresh.
8h cron (`docker exec 1edge-site …`) + on-deploy fetch. See CHANGELOG.

### Roadmap (after Phase 2)
Period report pages from data (weekly/monthly/quarterly/h1/h2/y1/y2); existing /review idea + MEMORY open
items (Cloudflare port, Safari/iOS polish, CSV import, account stage auto-transitions).

### Gotchas
- Do NOT run seed-review.mjs against the live tree (clears content dirs).
- Generated graphics via sharp/librsvg (scripts/lib/brand.mjs) — not headless Chromium.
- deploy.sh re-creates the autosave cron; seed.mjs is idempotent (no clobber).
- VPS can't resolve 1ed.ge — curl --resolve 1ed.ge:443:104.21.7.179.
