# MEMORY — 1ed.ge

Living project memory. This file is loaded into every agent session. Append
decisions, gotchas and open items here; keep it short and factual.

## Top rule — ship it

**Commit + deploy + verify live after every meaningful change.** The owner looks
at `https://1ed.ge`, never the working tree. Local `dist/` and port-4323 test
servers do NOT count as "done". Workflow: typecheck → commit → `bash
scripts/deploy.sh` → poll until live → curl-verify the changed bits. Kill test
servers when finished.

## HANDOFF — period reviews SHIPPED + LIVE (READ FIRST)

**State: the period-reviews feature is DONE — committed, deployed, verified live.**
All Wave-7 reviews approved + fix rounds landed; the final whole-branch oracle review
approved for deploy. Deployed via `bash scripts/deploy.sh`; verified LIVE: home 200;
/week /month /q1/2026 /h1/2026 /year/2026 /lookback /zen/<secret> 200; /admin/<secret>
302 → /zen; bare /q1 200 (q1 of current year); /q1/2026-q1 and /week/2026-32/extra → 404;
homepage nudge line; no "Two years" anywhere.

**Shipped + LIVE earlier this session:** moment-images (3-type stream, ephemeral capture,
alt sidecar, lightbox), market chronograph + overlap fix (clock-chip lane), quick wins
(dead cockpit code + sign-correct money colors), node:test runner (84 tests), no-2-year
de-hardcode (day counter uncapped, seed-review `--days` arg, copy de-emphasized).

**URL semantics (owner-locked 2026-08-08):** bare `/q1` = q1 of the CURRENT YEAR (rolling);
bare /week /month /year = current period; quarter/half PUBLIC anchors are canonical
year-only (`/q1/2026` — `/q1/2026-q1` and `/q1/2026-q2` → 404); the admin API keeps
internal `2026-q1` anchors (`isoFromAnchor` embedded-suffix + `validAnchor` in
`src/pages/api/admin/reviews.ts`); the review-page switcher = 9 chips (week · month ·
q1..q4 · h1 h2 · year). `resolvePeriod` + `publicAnchor` in `src/lib/periods.ts` are the
pure, tested (90 tests) URL layer — the route `src/pages/[periodType]/[...anchor].astro`
is a thin caller.

**Recovery map:** the SDD ledger `.superpowers/sdd/2026-08-07-period-reviews/progress.md`
has the full history. Spec: `docs/superpowers/specs/2026-08-07-period-reviews-design.md`
(status: shipped). Plan: `docs/superpowers/plans/2026-08-07-period-reviews.md`.
Post-review commits: `1a4dcd6` (URL semantics + resolvePeriod, 15 tests) `9dd041e`
(Wave-7 review fixes — lookback cleanup + horizon-first sort + filtered count, zen 404
early-return, e2e/.env.example zen paths, VIEW_REVIEW) `8cc0e36` (publicAnchor prev/next +
lookback round-trip regression, NaN-safe delta, styled 404) `9849c0f` ("reflection
missing" suffix on the pending nudge, ReviewTab dirty-guard on period switch).

**INGEST — SHIPPED + LIVE (2026-08-08).** Daily drop ritual in the day screen: drag
Tradovate exports (screenshot/CSV/PDF) into the "import trades" zone → AI parses
(cheap model `deepseek/deepseek-v4-flash-0731` via `AI_MODEL_INGEST` for text,
`pdftotext`/poppler in the image, vision for screenshots) → fills grouped to positions
(10-min clustering, VWAP entry/exit) → per-account dedup (advisory, pre-flagged) →
owner approves each → apply merges into `days/<date>.md` + persists platform-id
aliases (`platformIds[]` on accounts). Sources ephemeral (decoded in memory, never
saved). Demo files stay in `/tmp/opencode/import-demo/` (2 × Lucid 50k:
`LTE05061295040002`/`...0003`; Performance ↔ Orders fill-ids share ZERO ids on the
demo — attribution is best-effort, the alias-confirm covers it). Commits: `84f7efe`
(foundation) `ca93d85` (core pipeline + 13 tests) `c6814b1` (API) `5200743`+`260d35c`
(panel UI + fix round) `6d4646b` (final-review polish). **Imported trades carry no `stop` → `riskOf()` defaults to 1, so R = raw points** —
the ingest review queue now has a per-trade "risk pts" field (prefilled when the
source shows a stop — the LLM/vision prompts extract it; manual otherwise),
persisted as `riskPoints` on apply; the day workspace can also edit stop/risk on
any trade. Tradovate CSV exports never carry stops → manual entry there. Commit
`30b7321` (risk threading: `Fill.stop` → `PositionProposal.riskPoints` →
panel input + live R hint).

**NEXT (in progress):** **Safari/iOS polish pass** — zen used as a PWA on iPhone,
iPad, and MacBook (safe-area insets, ≥16px inputs to stop iOS focus-zoom, touch
targets, `-webkit-touch-callout` off on zen, a zen-scoped manifest so the installed
app launches into `/zen/<secret>` not the public home). **Deferred:** Cloudflare
Pages + CDN port (owner: stay on this VPS for a few weeks before testing any of
that); account stage auto-transitions on drawdown breach (possible CSV bulk import).

**INGEST-integration notes (ora-3):** (1) `toDayData` in `src/pages/api/admin/reviews.ts`
(50 lines) re-parses day files independently of the content-collection schema — a
maintenance tax if the trade schema evolves; keep it in sync. (2) `src/content/reviews/`
is created on first `writeEntry` — a missing dir is handled (empty collection / `[]`).
(3) Ingest amends old day records → already-completed period reviews' numbers will shift
retroactively (correct — data is truth — but may surprise the owner).

**Deferred minors (parked):** HKT offset duplicated 3× (`sessions.ts` todayHkt,
`zen/[secret]/index.astro:28`, `index.astro:45` — extract `nowHkt()` into sessions.ts);
switcher links jump to the current year from anchored pages (by design); /lookback does
~2 sync fs reads × ~142 periods per request (<50ms — fine at this scale); week-53 in a
52-week year resolves into week-1-of-next-year content (harmless edge, owner chose skip).

**Owner-locked decisions (do NOT re-litigate):** week = **Mon–Fri trading week** (trading
strictly Mon–Fri, no exceptions); full review content; written review notes per period;
AI comparison = deepseek v4 flash 0731, on-demand generate button, editable before
publish, stored `.cmp.md`; **reflection habit** = EVERY Mon–Fri day (even zero trades)
needs a reflection, STRICT 3h grace after midnight HKT, Sat/Sun relaxed (only the week
review); homepage + zen nudge = ONE compact line via copy.ts; private area = **zen**
(never admin/cockpit); `/lookback` = aggregated reviews hub; fortnight = SKIPPED (the
engine makes it a one-line add later); **NO hardcoded 2-year/730 limits anywhere** (the
site is the owner's life/lifestyle).

**Gotchas:** SSR routes read content at server start (deploy restarts pick up changes —
rebuild alone won't update /week, /lookback, /zen); build clears `node_modules/.astro`
(keep it); **the 30-min autosave cron sweeps uncommitted WORKING-TREE edits into
`chore(content)` commits too** (it swept an in-flight IngestPanel fix on 2026-08-08 —
commit promptly, verify diffs after sweeps); `pkill -F pidfile`; local test server on
4323 (bind HOST=127.0.0.1); the VPS resolver can't resolve 1ed.ge (`curl --resolve
1ed.ge:443:104.21.7.179`); no parallel builds (astro races on `node_modules/.astro`);
never commit `.env` or market-news cron edits.

## HANDOFF — moment-images shipped (READ FIRST)

**Moment images is DONE, committed, deployed, verified live.** Executed
subagent-driven over 6 tasks (spec `docs/superpowers/specs/2026-08-07-moment-images-design.md`,
plan `docs/superpowers/plans/2026-08-07-moment-images.md`). Commits: `07ee5a6`
(wipe test data) `6846616` (cheap-model alt sidecar) `457443f` (moment collapse)
`28d1120` (DayWorkspace rework) `2b39ec5` (public imagery + lightbox) `55b4af5`
(lightbox inline script) + the docs commit.

- **Stream moments collapse to `trade | note | quote`.** The `media` moment type
  and the `pre-market`/`post-market` labels are deleted everywhere (schema,
  `stream.ts`, admin API, `/stream` filter, seed script).
- **Images attach to artefacts.** Trades keep `trades[].screenshots[]` (rendered
  wherever the trade shows — archive panel AND trade moments — owner-confirmed
  "trade owns its charts"); note/quote moments carry `images[]`.
- **Capture zone is ephemeral.** The day screen reads pasted screenshots with the
  AI and **never uploads them** — truly gone. Screen-time values still come from
  the AI's read.
- **Cheap-model SEO alt text on upload** — `AI_MODEL_ALT` env (default
  `qwen/qwen-2.5-vl-7b-instruct`) → `captionAlt()` in `src/lib/ai.ts` → sidecar
  `public/media/alts.json` written on upload, removed on delete
  (`src/lib/media-alt.ts`, `/api/admin/media`). Alt-model failure is swallowed —
  the upload still succeeds. `.env` does NOT need `AI_MODEL_ALT` (default applies);
  never commit `.env`.
- **Native `<dialog>` lightbox** (`src/components/Lightbox.astro`) — the site's
  single zero-JS exception on public pages; thumbnails degrade to new-tab links
  with JS off.
- **Test data wiped** — 730 days, 161 journals, accounts/payouts/coach, media
  uploads. **The site starts EMPTY until the owner logs real days.** Do NOT run
  the seed scripts against the live tree.

**Remaining:** Phase 4 remediation (see WRAP-UP below) + **owner testing** of the
new day screen (ephemeral capture → AI → nothing saved; 3-type composer with
per-moment image drops; trade screenshots strip).

## HANDOFF — next agent, the market/homepage work (read first)

**State: working tree clean, all committed + deployed + verified live.**
Live: homepage has the market narrative strip + rich footer, `/stream`,
`/calendar` — all CME-futures-framed.

**This session shipped (commits):**
- **The context-aware market narrative strip (the PENDING chunk, done).** New
  `src/lib/strip.ts` is the SINGLE source of truth for every conversational market
  phrase (homepage strip, site-wide footer, live ticker) — precomputed absolute-time
  segments per market (`open · maintenance in`, `on lunch break · back in`,
  `opens in`, …), `fmtHuman` durations, next-event + `{Name} speaking` lines
  (speakers matched from red/orange titles only). New `MarketFooter.astro` on every
  public page (condensed master-line + per-band transitions + news countdown +
  speaker, expandable `<details>` for the full narrative + `NewsBlock`).
  `MarketWidget` reworked onto segments + `daySessionWindows` and embedded under
  the `/` hero with a trader-live moniker. New `NewsBlock.astro` (dot severity —
  NO words red/orange — time, title, `[TV]`/`[FF]`, `✦`). `newsHeadline()` added.
  Calendar + day-page news blocks swapped. **Terminology corrected:** the market is
  **CME Globex** (equity-index futures), never "MNQ futures" — MNQ is the Micro
  E-mini Nasdaq-100 ticker, not a market.
- **Follow-up polish (2 commits, done):** (a) name-less phrases — `strip.ts`
  phrases carry NO market name; surfaces supply it (`CME Globex ` prefix on the
  footer master line + `MarketLive`; rows already show the name). Fixes the mobile
  "New York · NYSE New York opens in" doubling. (b) the stacked 24h bar + country
  legend are deleted from `MarketWidget` — replaced by a single hairline day-ruler
  (00–24 ticks + now-marker); rows carry all session info. (c) **TSE afternoon
  close corrected to 15:30 JST** (was 15:00) → day window now `08:00–14:30` HKT.
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
- **Journal editor is a plain markdown textarea + preview** (write/preview
  tabs, `MarkdownEditor.tsx`), Milkdown Crepe removed. Raw HTML escaped; images
  paste → upload to the media API from the day/trade capture zones, not the
  reflection editor.
- **AI-first day input:** paste text + screenshots anywhere (global clipboard
  paste sink); `structureDayFull` reads everything in one pass — Qwen2.5-VL for
  image days, DeepSeek for text-only — and returns the whole day (mood/sleep/
  habits/device/trades) **plus a suggested journal** (title/summary/tags/draft).
  Same schema/tone either way.
- **One day = one admin screen (v0.4).** The "day" tab: capture → day summary →
  trades (model tag + commentary) → moments composer (draft → publish) →
  reflection draft → publish reflection → one Save. **Evidence first:** values
  render read-only with rare direct-click overrides; screen-time hours come from
  the screenshot, never typed. The journal owns no structured fields (mood/sleep
  live in the day record); reflection publishes to `journal/<date>.mdx` only via
  the explicit publish action.
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
  icons generated from `favicon.svg` via sharp. SW skips `/admin` + `/zen`.
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

- 2026-08-08 — **Risk-per-trade on ingest, live.** Owner request: per-trade risk
  points (the points they risked — "sometimes the source shows it, sometimes not").
  `Fill.stop` (LLM/vision prompt: "include the stop ONLY when the source shows one,
  never invent") → `PositionProposal.riskPoints` = |entry − stop| per cluster →
  IngestPanel "risk pts" input (prefilled when parsed, manual otherwise, live
  `R x.xx` hint) → apply persists `riskPoints` (positive-only, schema-safe).
  Commit `30b7321`; 106/106 tests, typecheck 0, deployed + verified live.
  Owner decision: **no Cloudflare/CDN port for now** — stay on this VPS for a few
  weeks before testing any of that; **Safari/iOS polish pass is next** (zen as a
  PWA on iPhone/iPad/MacBook).
- 2026-08-08 — **INGEST shipped + live.** Daily drop ritual in the day screen:
  drag Tradovate exports (screenshot/CSV/PDF) → parse (cheap model
  `deepseek/deepseek-v4-flash-0731` for text via pdftotext/poppler, vision for
  images) → fill→position grouping (10-min clusters, VWAP) → per-account dedup
  (advisory) → owner approves each → apply (day merge + `platformIds[]` alias
  persist). Commits: `84f7efe` `ca93d85` `c6814b1` `5200743` `260d35c`; reviews:
  T1 Approved, T2 Approved (13 ingest tests; demo Performance↔Orders fill-ids
  share 0 ids — attribution best-effort), T3 Approved (Important re-apply risk
  closed via the T4 busy-guard), T4 Needs-fixes → fix round Approved (alias-
  confirm cascade was dead — now seeds `internalId ?? ''` and resolves
  `accountByIndex[i] || links[platformId] || internalId || ''`). Gotcha: the
  02:00 autosave swept an in-flight uncommitted fix. 103/103 tests, typecheck 0,
  build OK, e2e smoke on :4323 with the real demo files, deployed + verified
  live.
- 2026-08-08 — **Period reviews SHIPPED + LIVE.** Owner URL gate (this session): bare
  `/q1` = q1 of current year; canonical-only public quarter/half anchors; 9-chip switcher;
  week-53 skip. Wave-7 reviews: T5b Approved (oracle), T5e Approved (general), route
  re-review Changes-needed (oracle — caught the prev/next + lookback internal-anchor
  regression) → fixed; final whole-branch oracle review Approved for deploy. Commits:
  `1a4dcd6` (resolvePeriod + URL semantics + 15 tests) `9dd041e` (Wave-7 review fixes)
  `8cc0e36` (publicAnchor prev/next + lookback round-trip, NaN-safe delta, styled 404)
  `9849c0f` ("reflection missing" suffix, ReviewTab dirty-guard). 90/90 tests, typecheck 0,
  build OK, deployed + verified live. **Next: INGEST** (queued plan).
- 2026-08-07 — **Market chronograph + overlap fix, live.** Final commits
  `c11526f` (footer date → `fmtDayW`, correct `fmtDayW` doc example, `z-5`)
  and `51e63cb` (clock chip gets a reserved rail lane — never overlaps the
  header; edge-clamped; screenshot-verified at 21:45 HKT). All chronograph
  work — rail, mm:ss countdowns, iconed + past-state + grouped news,
  `mon | 07-aug-2026` headers, homepage "the day" panel — is live.
- 2026-08-07 — **Market chronograph, done (Task wave, commits to follow).**
  Chronograph rail in `MarketWidget.astro` — 00–24 HKT hairline day-ruler with
  hour ticks, event-severity dots (news red/orange + sessions), caret + live
  `HH:MM:SS` now-marker (no green dot); server-rendered, JS only moves the
  marker/clock. **mm:ss countdowns** under 15 min in widget/ticker/footer
  (`fmtHuman` rule shared across `strip.ts` + 3 inline copies). **News rows
  iconed + past-state** — every USD row carries an emoji-fallback icon, elapsed
  events dim/strike for posterity (static day pages freeze `now` at build time —
  documented limitation). Same-time events collapse to one representative row +
  `+N more at HH:MM` (Task 7, `NewsGroup` keeps kind). **`fmtDayW`**
  (`mon | 07-aug-2026`, `src/lib/dates.ts`) on day-facing display headers
  (stream "today so far" + `/day` archive header; slugs keep `fmtDay`).
  Homepage "the day" panel = `MarketDay.astro` (SSR, facts + stream).
  **Lightbox hardening** — `if (!body) return` + `e.target instanceof Element`
  guard in `Lightbox.astro`; `/day` archive trade screenshots join the lightbox
  via `data-lb` (`day-<iso>-<tradeIdx>`, per-panel groups, `target="_blank"`
  kept for no-JS). Commits: `c0fb3b1` (rail+clock) `9935c29` `347def7`
  (news grouping) + this task (`fix(public): lightbox guards, archive trade
  shots in lightbox, weekday day headers, docs`).
- 2026-08-07 — **Moment images, live.** Stream moments collapse to
  `trade | note | quote` (media type + pre-market/post-market labels deleted
  everywhere: schema, `stream.ts`, admin `days.ts`, `/stream` filter, seed).
  Images attach to artefacts: trades keep `screenshots[]` (rendered wherever the
  trade shows), note/quote moments carry `images[]`. Capture zone is **ephemeral**
  (AI reads pasted screenshots, never uploads). Cheap-model SEO alt text on
  upload (`AI_MODEL_ALT`, default `qwen/qwen-2.5-vl-7b-instruct`) → `captionAlt()`
  → `public/media/alts.json` sidecar (`src/lib/media-alt.ts`). Native `<dialog>`
  lightbox (`Lightbox.astro`) = the single zero-JS exception on public pages.
  **Test data wiped** — 730 days, 161 journals, accounts/payouts/coach, media
  uploads; site starts empty until the owner logs real days. Subagent-driven:
  6 tasks, all committed (`07ee5a6` `6846616` `457443f` `28d1120` `2b39ec5`
  `55b4af5`), typecheck clean, deployed + verified live.
- 2026-08-07 — **Phase 3 — Public surfaces, live.** Posterized day archive:
  `/day/<fmtDay(iso)>` = DayFacts strip + published stream moments (MomentCard)
  + trade panels with `model` Badge + `commentary` + habits chips (count-habit
  aware, active-only) + screen-time proof + news + brief + reflection + coach.
  **Cockpit deleted** (`src/components/cockpit/` — 7 files; R math now central
  in `stream.ts` `ROf`). `/models` page: `src/lib/models.ts` `buildModelStats`
  (712 model-tagged trades) + per-model premise/rules/stats/recent-trades; nav
  `[05] models` (accounts→06, about→07). `/journal` on ui primitives — first
  production use of `ui/*`; lean search index (dayText dump deleted, index
  142KB→91KB, page 287KB→277KB — owner ruled accept). Market day-ruler polish
  (designer): pulsing `.now-dot` + responsive ticks (6h/4h/2h). Subagent-driven:
  3 tasks, 2 fix rounds, final oracle review (2 habit-chip fixes), typecheck
  clean, deployed + verified live.
- 2026-08-07 — **Phase 2 — Admin rework, live.** DayWorkspace on stream
  primitives: draft reflection (private `draft.reflection`) + explicit publish
  reflection → `journal/<date>.mdx`; moment composer (draft → `publish →` →
  `stream`, AI polish edits drafts only, trade/quote/media types); per-trade
  `model` tag + published `commentary`; merge-on-paste (`mergeStructured`
  keeps untouched trades, replaces by shared screenshot, appends text-only).
  Library tab (habits/models/rules/quotes CRUD) via new `/api/admin/library`;
  Milkdown Crepe **out** → `MarkdownEditor.tsx` plain textarea + write/preview
  (unified/remark/rehype, raw HTML escaped; `@milkdown/crepe` removed from
  package.json + lockfile, `editor.css` deleted, axe exclusions dropped). API:
  `days.ts` POST persists `stream`/`draft`/model/commentary, GET returns
  `models`; `content.ts` `Kind` + `models`/`rules`/`quotes`; new
  `/api/admin/ping` (heartbeat → `touchLive`, feeds public "trader is live").
  Safety: dirty-guard on tab switch, no wipe-on-paste, loud rebuild-failure
  banner (`role="alert"`), AI 60s `AbortSignal.timeout`, toast/nav aria.
  Executed subagent-driven: 5 tasks, 3 fix rounds, final oracle review (4
  one-line fixes), typecheck clean, deployed + verified live.
- 2026-08-07 — **Context-aware market narrative strip, live.** New `src/lib/strip.ts`
  = single source of every conversational market phrase (homepage `MarketWidget`,
  site-wide `MarketFooter`, `MarketLive` ticker). Precomputed absolute-time segments
  (`open · maintenance in`, `on lunch break · back in`, `opens in`, …) + `fmtHuman`;
  browser only ticks. **Name-less phrases** — surfaces supply the market name (no
  "New York · NYSE New York opens in"). **CME Globex** is the market name (MNQ is a
  ticker, not a market). New `NewsBlock.astro` (dot severity, no words red/orange,
  `[TV]`/`[FF]`, `✦`); `newsHeadline()`; calendar/cockpit news swapped. `MarketWidget`
  bar+legend → single hairline day-ruler. **TSE afternoon close corrected to 15:30
  JST** → window `08:00–14:30` HKT. Homepage: hero → strip → today → stream w/
  trader-live moniker. Commits `0173d95` `ee854a4` `338a7b8`, deployed + verified live.
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

## HANDOFF — WRAP-UP STATE (2026-08-07, moment-images shipped)

**Moment images shipped (this session):** stream moments are now exactly
`trade | note | quote` (media + pre-market/post-market deleted everywhere);
images attach to artefacts — trades keep `screenshots[]`, note/quote moments
carry `images[]`; the admin capture zone is **ephemeral** (AI reads pasted
screenshots, never uploads); cheap-model SEO alt text (`AI_MODEL_ALT` →
`captionAlt()` → `public/media/alts.json` sidecar) is generated on upload;
a native `<dialog>` lightbox (`src/components/Lightbox.astro`) is the single
zero-JS exception on public pages. **Test data is wiped — the site starts EMPTY
until the owner logs real days. Do NOT run the seed scripts against the live
tree.** Full spec: `docs/superpowers/specs/2026-08-07-moment-images-design.md`
(status: shipped).

**Phases 0–3 are DONE, committed, deployed, verified live.** Full spec:
`docs/superpowers/specs/2026-08-07-stream-system-design.md`. Plans:
`docs/superpowers/plans/2026-08-07-phase2-admin-rework.md` and
`docs/superpowers/plans/2026-08-07-phase3-public-surfaces.md`.

**Phase 3 shipped (this session):**
- **Posterized day archive** — `/day/<fmtDay(iso)>` is now a static archive, not
  a cockpit mirror: `DayFacts` strip + published `stream` moments (`MomentCard`)
  + trade panels that finally show the `model` Badge + `commentary` + habits
  chips (count-habit aware, active-only) + screen-time proof + USD news + brief +
  reflection + coach. **The cockpit is deleted** — `src/components/cockpit/`
  (7 files) gone; the duplicated points/risk math died with it (R now uses `ROf`
  everywhere).
- **`/models` page** — `src/lib/models.ts` (`buildModelStats` over the 712
  model-tagged trades) + `/models` rendering each model's premise/rules/stats/
  recent trades. Nav `[05] models` (accounts→06, about→07).
- **`/journal` on primitives** — first production use of the `ui/*` primitives;
  lean search index (dayText dump deleted; index 142KB→91KB; page 287KB→277KB).
  Client search preserved verbatim. **Owner ruled: accept the 277KB size**
  (full-text body search kept — do not reopen without asking).
- **Market day-ruler polish** (designer): pulsing now-dot (`.now-dot`) +
  responsive hour ticks (6h mobile / 4h sm / 2h lg).
- Executed subagent-driven: 3 tasks, 2 fix rounds (typecheck import fixes),
  final oracle review (2 one-line habit-chip fixes), all committed.

**Remaining work (in order):**
- **Owner testing of the moment-images day screen** — ephemeral capture (paste →
  AI reads → nothing saved), 3-type composer with per-moment image drops, trade
  screenshots strip. The site starts **empty** (test data wiped) until the owner
  logs real days.
- **Phase 4 — Remediation**: money-color bugs (performance/accounts/about/
  DayWorkspace green-for-negative), tablet breakpoint (rails at 768–1023px),
  floating sticky subnav, journal API path traversal (`GET /api/admin/journal?
  file=`), early-close copy (`1:15pm ct` vs `1:00pm et`), rebuild race (mutex),
  unit tests for stats/sessions/timeline, **dead CSS purge (incl. the 34 lines
  of `.ck-*` cockpit CSS in `src/styles/app.css` left behind), orphaned
  `src/lib/timeline.ts` + `src/config/cockpit.json` cleanup**, `--font-display`
  phantom, lighthouserc dead URLs, then typecheck → build → deploy → verify live.

**Deferred minors from Phase 3 review (parked, revisit in Phase 4 if touching
those files):** `winRate` counts R===0 as loss; `lastIso` depends on ascending
`getCollection('days')` order (add `.sort()`); `+0.00` plus-sign on zero stats;
`Input` primitive has no `id`/`onchange` passthrough (journal kept raw input);
journal client `item()` emits `.tag` spans not the Tag component (inherent).

**Docs state:** `AGENTS.md` and `MEMORY.md` describe the post-cockpit era.
Note `scripts/seed.mjs` (old, non-review seed) writes the **default accounts
+ a Day-Zero journal** — and `scripts/deploy.sh` runs it on **every deploy**, so
the "empty" site still shows those 4 default accounts + today's Day Zero journal
until the owner edits them. The test data (730 days, journals, payouts, coach,
media) does NOT come back. Do NOT run `seed-review.mjs` against the live tree
(it clears content dirs).

**On launching new agents to parallelize:** yes, but with guardrails — the
remaining work is one phase (4) with heavy shared surface, so parallel agents
should NOT split it; the safe parallel unit is one phase's independent files
with a strict gate: each subagent task ends with `npm run typecheck` + commit,
and no two agents build at once (builds race on `node_modules/.astro`).

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
