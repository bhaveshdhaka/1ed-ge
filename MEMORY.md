# MEMORY — 1ed.ge

Living project memory. This file is loaded into every agent session. Append
decisions, gotchas and open items here; keep it short and factual.

## Top rule — ship it

**Commit + deploy + verify live after every meaningful change.** The owner looks
at `https://1ed.ge`, never the working tree. Local `dist/` and port-4323 test
servers do NOT count as "done". Workflow: typecheck → commit → `bash
scripts/deploy.sh` → poll until live → curl-verify the changed bits. Kill test
servers when finished.

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
      (verbatim rows + `[TV]`/`[FF]` + `✦` verified, no merging). Remaining
      niceties: Japan substitute-holiday edge cases, full UK holiday shift rules,
      countdowns on `/calendar` per-day rows (widget covers today only).
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
