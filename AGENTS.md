# AGENTS.md — 1ed.ge

Guidance for AI agents working in this repository. Read this first. It is the
single source of truth for how this project is built, run, and shipped.

## What this is

`1ed.ge` is a **public trading journal** — a two-year, everything-public
experiment on the road to a hedge fund. Every trade, every account, every
mood, every sleep hour, every screen-time screenshot, every miss is public.
The only private thing is the **admin** area at `/zen/<secret>` (the old
`/admin/<secret>` path redirects there).

The centerpiece metric is **R** = points risked vs points made. All
performance math is risk-based. Everything is linked: mood, sleep, habits,
screen time, and trades all live in the same daily record.

## Pipeline (GitHub PR → Actions → deploy)

The repo lives at **`github.com/bhaveshdhaka/1ed-ge`** (public). `main` and
`preprod` are **protected branches** — no direct pushes, no force pushes, PR
required. The full env contract, scripts, and daily workflow are in
**`docs/PIPELINE.md`** — read it before any deploy or sync. The pipeline
guarantees:

- **Agent ships via PR only.** Create a `feat/*` branch → typecheck/test/lint
  → push (the pre-push hook gates it) → open a PR. Deploy happens on merge via
  CI (GitHub Actions). The agent never ships directly, never touches Server B,
  never holds prod secrets.
- **Direct `git push` to main/preprod is refused** by the pre-push hook
  (`.githooks/pre-push`) AND by remote branch protection (GH006). The path is
  a PR, not `git push`.
- **Pre-push hook** (`.githooks/pre-push`, wired via `core.hooksPath`) runs
  `npm run typecheck && npm run test && npm run lint` (~4s fast-fail) on any
  allowed push, and blocks main/preprod.
- **OpenCode tool lockdown** (`.opencode/opencode.json`): `git push main` /
  `git push preprod` denied; `docker*`/`sudo*`/`ssh*`/`systemctl*` denied.
  The hardened map is backed up at `/etc/opencode/opencode.json`.
- **Agent user** (non-root, uid 1000, docker group) runs OpenChamber
  (`oc.1ed.ge`) and OpenCode sessions. Scoped sudoers allowlist
  (`/etc/sudoers.d/agent`) covers only openchamber/nginx service management —
  never root. Agent holds only the GitHub PAT
  (`/home/agent/.config/opencode/github-agent-token`), never prod secrets.
- **Admin auth is passkey-based** (`/zen`, WebAuthn). The setup/recovery URL is
  `/zen/setup?key=<ADMIN_SECRET>` — the secret is no longer in the daily URL.
  Admin API auth = session cookie, not the `x-admin-secret` header.

The one-line env check: `bash scripts/where-am-i.sh`. The 10-second
wired-up check: `bash scripts/audit-pipeline.sh`.

## Stack

- **Astro 5** (static-first) + **@astrojs/node** (standalone SSR for the few
  server routes) + **Tailwind CSS v4** + TypeScript.
- React islands only on the admin page (client-side). Public pages ship minimal JS (~15KB inline: lightbox, timezone, market ticker).
- **Markdown editor in the admin** — plain textarea + write/preview tabs
  (`src/components/admin/MarkdownEditor.tsx`, unified/remark/rehype, raw HTML
  escaped). Milkdown Crepe is gone. Images paste → upload to `/api/admin/media`
  from the day/trade capture zones (not the reflection editor).
- Content collections (glob loaders + Zod schemas) for all content.
- **OpenRouter** for AI: DeepSeek (`deepseek/deepseek-chat`) for text day
  structuring + the coach + assist; Qwen2.5-VL (`qwen/qwen-2.5-vl-72b-instruct`)
  for whole-day structuring with screenshots, trade screenshots, and
  screen-time screenshots. Same prompt/schema → identical output tone.
- `sharp` (image → webp), `gray-matter` (file I/O in the admin APIs).
- `poppler-utils` (`pdftotext`) in the container — PDF trade-statement ingestion;
  the ingest text parser uses `AI_MODEL_INGEST` (cheap model, default
  `deepseek/deepseek-v4-flash-0731`).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Astro dev server on :4321 |
| `npm run build` | Production build → `dist/`. **Clears `node_modules/.astro` first** — do not remove that. |
| `npm run typecheck` | `astro check` — run after any code change |
| `npm run seed` | Idempotent: default accounts/habits/day-zero post |
| `npm run migrate` | One-time: merge legacy `trades/` + `habit-log/` into `days/` |
| `npm run start` | Serve `dist/` (`node dist/server/entry.mjs`) |
| `bash scripts/verify-env.sh` | Confirm the live site (HTTP 200, noindex signals by env) |

Always run `npm run typecheck` (and `npm run build` if it touches the site)
after changing code.

## Ship it (READ FIRST — non-negotiable)

**The owner judges work by what is LIVE on `https://1ed.ge`, not by the working
tree.** A change that is committed but not deployed, or deployed but not verified,
does not exist to them. After ANY meaningful change:

1. `npm run typecheck` (and `npm run build` if it touches the site).
2. **Commit on a `feat/*` branch** — conventional prefix (`feat:` / `fix:` /
   `chore:` / `docs:`), concise message. Never leave work uncommitted at the end
   of a session.
3. **Push the branch** — the pre-push hook (`.githooks/pre-push`) runs
   `typecheck + test + lint` (~4s) before any push. Direct pushes to
   `main`/`preprod` are refused by the hook AND by remote branch protection.
4. **Open a PR** — `gh pr create` (or the GitHub web UI). Deploy happens on
   merge via CI (GitHub Actions). The agent never ships directly, never touches
   Server B, never holds prod secrets.
5. **Verify LIVE after merge** — `bash scripts/verify-env.sh prod` (or `test`).
   Confirms HTTP 200, noindex signals (test-only), and the noindex absence
   (prod-only). Then curl `https://1ed.ge` and confirm the changed bits are
   actually in the served HTML/bundle.
6. Local verification servers on port 4323 and `node dist/server/entry.mjs`
   are for tests only — kill them when done so they do not hold memory.

The one exception: do NOT commit when the user explicitly says "don't commit /
wait". Default is commit + ship via PR + deploy + verify.

## Layout

```
astro.config.mjs            static output + node adapter; SSR routes opt out per-file
src/content.config.ts            collections: accounts, days, payouts, coach, journal, habits, brief, market-news, reviews
src/content/days/<date>.md  THE daily record — mood, sleep, habits, device, trades+executions
src/content/brief/          per-day pre-market brief (AI-written prose from verified data)
src/content/market-news/    per-day USD red/orange events (HKT times), fetched deterministically
src/content/accounts/       account lifecycle instances (eval → buffer → payout …)
src/content/payouts/        payout records (per account)
src/content/coach/          f-R-iend conversations (public on /coach)
src/content/journal/        prose (MDX), keyed by date
src/content/habits/         habit definitions
src/content/reviews/        per-period review notes (<type>-<anchor>.md) + AI comparison (.cmp.md)
src/lib/content.ts          fs + gray-matter helpers for admin file I/O
src/lib/stats.ts            R/pnl/equity/drawdown engine (idea + per-account via executions)
src/lib/trends.ts           rolling windows + correlations (sleep/mood/habits/screen/session/setup)
src/lib/habits.ts           streak + heatmap computation
src/lib/market.ts           NYSE cash calendar + CME equity-futures calendar (cmeDay — THE master clock)
src/lib/sessions.ts         CME 23h day + NYSE/TSE/LSE bands in HKT; DST/holidays; marketEvents/scheduledDayMarker
src/lib/market-news.ts          fs read/write of market-news day files (admin + fetch)
src/lib/brief.ts                deterministic pre-market snapshot builder (sessions+news+last day) + brief fs I/O
src/lib/changes.ts          pending-changes store (/tmp/1edge-pending.json) + rebuild history
src/lib/stream.ts           published-moment helpers: resolveMoments/flattenStream/dayFacts/momentMeta
src/lib/models.ts           per-model aggregation: buildModelStats (count/sumR/avgR/winRate per model)
src/lib/periods.ts           period engine — week (Mon–Fri)/month/quarter/half/year ranges + anchors;
                             resolvePeriod (public URL → range) + publicAnchor (canonical URL form), tested
src/lib/period-stats.ts      period aggregation — R/P&L/per-account/per-model/life + periodDelta + trendSeries
src/lib/review-compare.ts    AI factual comparison (deepseek v4 flash 0731, formatter-over-numbers) + fallback
src/lib/accountability.ts    pending reflections — Mon–Fri every day (3h grace), completed periods only
src/lib/copy.ts              SINGLE source of every public message string (trader/admin/reflection vocabulary)
src/lib/ingest.ts            import pipeline — CSV/PDF/image parse (cheap model + poppler), CT→HKT,
                             fill-id attribution, fill→position grouping, per-account dedup (tested)
src/lib/live.ts             admin-heartbeat read/write (/tmp/1edge-live.json, 5-min live window)
src/lib/ai.ts               OpenRouter: structureDayFull (text ± screenshots), readScreenshot,
                             readScreenTime, coachReply, assist, captionAlt (cheap-model alt text)
src/lib/media-alt.ts        alt-text sidecar for uploaded media (public/media/alts.json): setAlt/removeAlt/altFor
src/lib/auth.ts             admin secret check + JSON responses
src/lib/env.ts              .env access (ADMIN_SECRET, OPENROUTER_API_KEY, AI_MODEL_ALT, models)
src/components/MarketLive.astro   CME-event JSON + inline live countdown script (Base + Bare layouts)
src/components/MarketWidget.astro one-glance market box: chronograph rail (hour ticks + event dots +
                             live now-marker) + CME-framed status + session countdowns + news
src/components/MarketDay.astro    homepage "the day" panel — facts + stream at a glance (SSR)
src/components/NewsEventsCard.astro reusable news events panel (card header + dot severity empty state)
src/components/Lightbox.astro     native <dialog> lightbox — the site's single zero-JS exception on public pages
src/components/stream/      public stream components (ThoughtCard, DayFacts) — moments are trade|note|quote;
                             thumbnails with altFor() open the shared lightbox (zero JS otherwise)
src/components/archive/DayArchive.astro  posterized day archive (facts + moments + model-tagged trades);
                             trade screenshots open the lightbox via data-lb
src/pages/                  public pages: / /stream /journal /models /calendar /performance /tracker /trends
                             /accounts /coach /about /day/[date] + the tape (/week /month /q1..q4 /h1/h2
                             /year + anchored forms via [periodType]/[...anchor], all SSR)
                             + rss + sitemap (/ + /stream + review routes are SSR)
src/pages/zen/[secret]/    private admin (SSR), renders the React app; the old
                             /admin/[secret] is a thin redirect to /zen;
                             /zen/<secret>/manifest.webmanifest is a secret-guarded
                             PWA manifest (start_url/scope = the admin mount) so admin
                             installs standalone on iPhone/iPad/MacBook
src/pages/api/admin/*.ts    admin API (SSR, auth via x-admin-secret header)
src/pages/api/admin/market.ts    USD news GET + refresh (spawns market-news-fetch.mjs)
src/pages/api/admin/reviews.ts   period review notes + AI comparison (GET/POST; internal <type>-<anchor> anchors)
src/pages/api/admin/ingest.ts    trade import — POST /api/admin/ingest (parse proposal) +
                             /api/admin/ingest/apply (day merge + platform-id alias persist + pending change)
src/pages/media/[...file].ts SSR media file server (uploads in public/media)
src/components/admin/*      React admin (Overview / Day / Accounts / Coach / Media / Library)
src/components/admin/tabs/DayWorkspace.tsx  the single "day" screen: ephemeral capture (AI
                            reads pasted screenshots — never uploaded) → evidence-first
                            summary (read-only + rare direct-click overrides) → trades
                            (model tag + commentary + screenshots) → moments composer
                            (trade|note|quote, draft → publish, per-moment image drops)
                            → reflection draft (markdown) → publish reflection → one save
src/components/admin/tabs/LibraryTab.tsx  habits / models / rules / quotes CRUD
src/components/admin/tabs/ReviewTab.tsx   period review notes + AI comparison (type/anchor picker,
                             MarkdownEditor, generate-compare button, dirty-guard on switch)
src/components/admin/RebuildBar.tsx  sticky pending-changes → rebuild bar (all tabs)
src/components/admin/MarkdownEditor.tsx  markdown textarea + write/preview tabs
src/components/*.astro      shared UI + SVG charts (zero JS)
public/media/               uploaded images (webp) — git-tracked
scripts/seed.mjs, migrate.mjs, start.sh, verify-env.sh, status-snapshot.mjs, market-news-fetch.mjs
nginx/1ed.ge.conf           host nginx vhost
Dockerfile / docker-compose.yml   bind-mounts src/content + public/media
```

## Content model

Files are the database. The **day record is the spine** — mood, sleep, habits,
screen time, and trades all align to a date:

```yaml
date: "2026-08-05"
mood: 3                      # 1-5
sleep: { hours: 6.5, quality: 3 }
habits: { quiet-time: true, read: 30 }   # habits v2: bool or count
device:                      # screen-time (iPhone/Mac), fully public + linked
  iphoneHours: 5.2
  socialHours: 2.4
  macHours: 4.5
  notes: "..."
  screenshots: []            # pasted Screen Time screenshots
trades:                      # one idea, executions per account
  - market: MNQ
    direction: long
    session: ny-am
    setup: ORB
    model: orb-drive          # NEW — trading-model tag
    entry: 20800.5
    stop: 20795
    exit: 20812.5
    points: 12               # signed; computed if absent
    riskPoints: 5.5          # computed = |entry - stop| if absent
    commentary: "..."        # NEW — approved published commentary
    screenshots: []          # trade charts — rendered wherever the trade shows
    executions: [{ account: lucid-50k-a, size: 1 }, { account: tpt-25k-a }]
stream:                      # approved, ordered public moments — trade | note | quote
  - at: "08:30"
    type: note               # trade | note | quote
    text: "news tonight — flat 15 before"
    images: []               # note/quote moments carry images[]; trade moments use the trade's screenshots[]
draft:                       # NEW — private, NEVER rendered publicly
  reflection: "..."          # unpublished reflection
  moments: []                # unpublished draft moments
```

- **Images attach to artefacts.** Trades keep `trades[].screenshots[]`; note/quote
  stream moments carry `images[]`. The day-screen **capture zone is ephemeral** —
  pasted screenshots are read by the AI and never saved (screen-time values still
  come from the AI's read). Uploaded media gets cheap-model SEO alt text
  (`qwen/qwen-2.5-vl-7b-instruct` via `AI_MODEL_ALT`) into a
  `public/media/alts.json` sidecar.
- **R** is computed, never stored: `R = points / riskPoints` (price-based,
  identical across executions). Per-account `$ pnl = points × pointsValue × size`
  (MNQ `pointsValue` = 2).
- **Accounts** = lifecycle instances: `stage` in `eval | funded | buffer |
  payout | failed | paused`, with a `stages[]` history. Failures spawn a new
  instance; old ones stay forever. Accounts also carry `platformIds[]` — the
  Tradovate platform-id → internal-id alias map, persisted once on the owner's
  first import confirm.
- **Trading models** = `models/` collection (name, premise, rules, status,
  order). Every trade may carry a `model` tag. Public `/models` page renders
  models + rules + their trades. Rules are owner-authored only — never AI
  gyaan.
- **Payouts** reduce an account's equity (net P&L = gross − payouts), so
  drawdown/buffer math stays honest.
- **Market news** = per-HKT-day files (`market-news/<date>.md`) with `red[]` /
  `orange[]` USD events `{time: "20:30", title, source, verified}` (HKT times).
  Fetched deterministically (no AI) by `scripts/market-news-fetch.mjs` —
  TradingView primary (importance 1→red, 0→orange) + Faireconomy cross-verify
  (±2min UTC); `verified` = present in both sources. **Zero-inference:** rows are
  verbatim from their source (`TV`/`FF` badge), never merged/re-leveled. 8h cron
  + deploy + admin refresh.
- **Period reviews** = `reviews/` collection `{ type, anchor, title?, date }` + MDX body,
  file `<type>-<anchor>.md` (e.g. `week-2026-33.md`). AI comparison files
  `<type>-<anchor>.cmp.md` live alongside but are glob-excluded from the collection.
  Public URLs are canonical (`/q1/2026` via the route's `resolvePeriod`); the admin API
  uses the internal `2026-q1` anchors. One `PeriodReview.astro` + one dynamic route
  `[periodType]/[...anchor]` render every horizon — adding one is config, never a rebuild.

## Admin + publish flow (important)

1. Admin (React) calls `POST /api/admin/<resource>` with the
   `x-admin-secret` header (must equal `ADMIN_SECRET`).
2. The API writes files directly with `fs`/`gray-matter`
   (`src/lib/content.ts`) — **not** through content collections (collections
   are cached; fs reads are always fresh).
3. Every mutation (day/journal/account/payout/coach) appends a **pending
   change** to `/tmp/1edge-pending.json` (`src/lib/changes.ts`).
4. **Saving does NOT auto-rebuild.** The sticky RebuildBar (all admin tabs)
   shows queued changes; the user clicks **rebuild now** (or uses the
   "save & rebuild" buttons). `POST /api/admin/rebuild` snapshots pending,
   runs `npm run build` (~8–20s), then on success clears pending and records
   a rebuild-history entry (`/tmp/1edge-rebuilds.json`).
5. Static pages are served from `dist/client` on disk, so the node standalone
   server picks up new builds in place — no restart needed.

## AI-first day input

The **Day** admin tab is one screen: capture → day summary → reflection.
Paste trade charts, screen-time reports, or notes anywhere (clipboard paste
routes to the capture zone via a global paste sink). The capture zone is
**ephemeral** — screenshots are read by the AI and never uploaded.
`structureDayFull(text,
images)` (in `lib/ai.ts`) reads everything in one call — Qwen2.5-VL when images
are present, DeepSeek otherwise — and returns the whole day (mood/sleep/habits/
device/trades) plus which image index belongs where **and a suggested journal
(title/summary/tags/draft)**. Evidence first: values render read-only; a rare
✎ flips one value to edit. Screen-time hours always come from the screenshot,
never typed. The reflection editor has an "AI draft from today" action
(`draftReflection`) that writes a first draft from the day's data. One Save /
Save & rebuild writes the day record **and** the journal together. The journal
owns no structured fields (mood/sleep live in the day record) — only prose +
optional title/summary/tags/featuredImage.

## Conventions & rules

- **CME futures is the master clock.** Day status ("open"/"early"/"closed")
  comes from `cmeDay()` — CME equity-index-futures calendar, US-centric. CME is
  totally closed on NYD/Good Friday/Juneteenth/July4/Thanksgiving/Christmas +
  weekends; MLK/Presidents/Memorial/Labor are normal CME days. CME early-close
  days (day after Thanksgiving, Christmas Eve, New Year's Eve) = `1:15pm ct`.
  **If CME is totally closed for a day, EVERYTHING is closed** — NYSE/TSE/LSE
  session bands are suppressed too (no exchange trades CME futures then). On
  CME early-close days the cash bands still render. `marketDay()` (NYSE cash)
  is used only for the NYSE band itself. Never present "NYSE open" as "market
  open" — the market is CME.
- **Everything public except the admin.** Never weaken this. No cherry-picking.
- **The day counter is uncapped** — no hardcoded 2-year/730 limits anywhere (the site is
  the owner's life, not a project). `projectDayNumber()` has no cap; period ranges scale
  indefinitely.
- **Never commit secrets.** `.env` (ADMIN_SECRET, OPENROUTER_API_KEY) is
  gitignored. `.env.example` documents the shape.
- **Public pages must stay zero-JS** except the single shared `<dialog>` lightbox
  (`src/components/Lightbox.astro`, one inline script — the owner-approved
  exception). No React/JS on public routes. All charts are server-rendered SVG.
- **News rows keep icons + past-state.** Every USD news row carries an icon
  (emoji fallback, never bare text) and elapsed events render dimmed/struck for
  posterity; same-time events collapse to one row with `+N more at HH:MM`. The
  chronograph rail (hour ticks + event severity dots + caret now-marker) lives in
  `MarketWidget.astro`. Day-facing headers display `fmtDayW` (`mon | 07-aug-2026` —
  `src/lib/dates.ts`); `fmtDay` stays for URL slugs.
- **Content-layer cache:** Astro stores the collection data store at
  `node_modules/.astro/`. `npm run build` clears it so deleted files actually
  disappear from the static build. Keep that `rm -rf node_modules/.astro`
  in the build script.
- Astro 5.18 removed `output: "hybrid"`. Use `output: "static"` and opt into
  SSR per-route with `export const prerender = false`.
- The server's system resolver does **not** resolve `1ed.ge`. When testing
  locally use `curl --resolve 1ed.ge:443:104.21.7.179 https://1ed.ge/`.
- nginx `/media/` proxies to node (a filesystem `alias` fails because
  `/root` is mode 700).
- **`/dev` page** — public build log with stack, features, principles, changelog, token costs, and version tracking. Updated whenever meaningful features ship.
- Style: monospace, off-black (`#0a0a0c`), green `#4ade80` = up, red `#f87171`
  = down, low-contrast dim text, terminal aesthetic. Nav labels are plain
  (`[00] home`) — **no `~` in the menu**. Match Tailwind tokens in
  `src/styles/app.css`.
- **Design system (WhatsApp Logger v2 aesthetic):** 3-layer token architecture
  in `src/styles/app.css` — palette (`--hue-*`), semantic (`--color-*`),
  material (`--radius`, `--shadow-card`, `--blur-card`). Glass cards use
  `.panel` (translucent `rgba(13,15,22,.78)` + `backdrop-filter: blur(18px)`).
  Featured cards use `.panel-hero` (accent border, gradient bg, glow top-line).
  Card headers use `.card-hd` / `.card-ico` / `.card-lbl` / `.card-sub` / `.tmr`.
  Inset wells use `.well`. Pills use `.capsule`. Segmented controls use
  `.seg` / `.seg-on`. Accent is `#0af` (electric blue). Body has ambient
  radial gradients behind every translucent surface.
- **Same card type = same look everywhere.** Never duplicate card markup.
  One reusable component per card type. Consistency is non-negotiable.
- **No words "red" or "orange" in UI.** Use dot severity indicators
  (🔴 `bg-down` / 🟠 `bg-warn`) instead.
- **Uppercase dates everywhere.** Use `fmtDayWUpper()` from `src/lib/dates.ts`.
- **"CME" not "CME Globex".** Everywhere: MarketWidget, MarketFooter,
  MarketLive, brief.ts, strip.ts.
- **"news events" not "the day".** The news card label is "news events".
- **Stream icon is 📡, not 💭.** 💭 is for thoughts. Stream is the feed.
- **No `/zen` link on public pages.** Single-user site.

## Versioning

- Semantic versioning (`vX.Y.Z`).
- `CHANGELOG.md` follows Keep a Changelog. Update it on meaningful changes.
- Code changes are committed by hand with conventional prefixes
  (`feat:` / `fix:` / `chore:` / `docs:`).
- Content is auto-committed by a cron every 30 min
  (`chore(content): autosave …`); do not fight it.
- Tag releases: `git tag v0.4.0`.

## Future moves

- Move to Cloudflare Pages + CDN: everything is file-based (content in git),
  so it ports cleanly — swap the adapter, keep the content layer.
- Safari/iOS polish: viewport-fit + apple meta already in the head; a fuller
  pass (safe-area insets, touch targets, PWA) is tracked in `MEMORY.md`.
