# MEMORY — 1ed.ge

Living project memory. This file is loaded into every agent session. Append
decisions, gotchas and open items here; keep it short and factual.

## Decisions

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
  image days, DeepSeek for text-only. Same schema/tone either way.
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
