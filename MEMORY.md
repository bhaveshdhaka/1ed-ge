# MEMORY — 1ed.ge

Living project memory. This file is loaded into every agent session. Append
decisions, gotchas and open items here; keep it short and factual.

## Decisions

- **R is the centerpiece.** Risk-based metrics everywhere; `R = points / riskPoints`.
- **Everything public except the admin.** The 2-year proof is the product.
- **Files are the database.** Content lives as Markdown frontmatter in
  `src/content/`, git-backed, auto-committed by cron every 30 min.
- **Astro 5.18 removed `output: "hybrid"`** → static + per-route `prerender = false`.
- **Admin reads/writes via fs** (`src/lib/content.ts`), never via cached
  content collections.
- **Save → rebuild.** Admin saves trigger `npm run build` (~8s); the node
  standalone server serves the rebuilt static pages in place.
- **Models:** DeepSeek `deepseek/deepseek-chat` (structure/assist),
  Qwen2.5-VL `qwen/qwen-2.5-vl-72b-instruct` (screenshot reading), both via
  OpenRouter. Overridable in `.env`.
- **Media:** uploads → `sharp` → webp (max 1920w) into `public/media/<date>/`.
  Served by SSR route and proxied via nginx.

## Gotchas

- Public pages must stay **zero-JS** (SVG charts, no React).
- `npx` / tooling must not be assumed; keep runtime deps explicit in
  `package.json`.
- The VPS system resolver does not resolve `1ed.ge` — use
  `curl --resolve 1ed.ge:443:104.21.7.179` locally.
- nginx can't `alias` to `/root/...` (mode 700) → proxy `/media/` to node.
- `.env` must never be committed; `.env.example` is the template.
- Rebuild writes to `dist/` in place while the server runs — safe on Linux,
  low traffic.

## Open items / roadmap

- [ ] Move to Cloudflare Pages + CDN (all content file-based → ports cleanly).
- [ ] Consider JSON-LD Breadcrumb on journal pages, per-page OG images.
- [ ] Account configs are currently seeded defaults — confirm real risk per
      trade / drawdown limits with the owner before heavy usage.
- [ ] Possible future: per-trade tags/notes from vision AI, CSV bulk import of
      prop-firm statements.

## Session log (recent)

- 2026-08-05 — v0.1.0: full site + admin + AI pipeline built, tested end-to-end,
  deployed on VPS (docker + nginx), domain live on Cloudflare (Flexible SSL).
