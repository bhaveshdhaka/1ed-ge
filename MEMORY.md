# MEMORY — 1ed.ge

Living project memory. This file is loaded into every agent session. Append
decisions, gotchas and open items here; keep it short and factual.

## Top rule — ship it

**Commit + deploy + verify live after every meaningful change.** The owner looks
at `https://1ed.ge`, never the working tree. Local `dist/` and port-4323 test
servers do NOT count as "done". Workflow: typecheck → commit → deploy →
verify live → curl-verify the changed bits. Kill test servers when finished.

## HANDOFF — WhatsApp Logger v2 aesthetic (2026-08-10)

**The WhatsApp Logger v2 aesthetic is live on prod.** The design reference is
`/opt/whatsapp-logger-v2/templates/dashboard.html`. Spec:
`docs/superpowers/specs/2026-08-10-whatsapp-logger-aesthetic.md`.

### What shipped (8 commits)

| Commit | What |
|--------|------|
| `7aabc2a` | Design spec |
| `2565492` | CSS foundation: `#0af` accent, body gradients, `.panel-hero`, `.card-ico`/`.tmr`, responsive density, `--text-4xs` (9px), `@keyframes glow-soft` |
| `903d7b3` | Admin: card headers (☀️ check-in, 💭 thoughts, 📈 trades, 🔔 notifications), `.well` on trade expanded details, `.tmr` R pills, `.panel-hero` on capture card |
| `e12def8` | Public surfaces: card headers on ThoughtCard/DayFacts/DayArchive (7 sections), `.panel-hero` on reflection + today, `.well` on fact cells + trade details, `.seg`/`.seg-on` on stream filters |
| `6481506` | Remaining pages: card headers + wells on calendar, about, performance, journal, models, accounts, tape |
| `7c658ed` | News card: "news events" label (not "the day"), dot severity empty state, removed `/zen` from public homepage |
| `341cf3e` | Stream icon 📡 (distinct from 💭 thoughts), removed count, "all streams" plural |
| `92af7bc` | Removed "red/orange" words from news empty state, `hideDate` prop on `NewsEventsCard` to fix double date on homepage |
| `b3e73b8` | Consistency pass: CME Globex → CME everywhere, uppercase dates (`fmtDayWUpper`), calendar hero card, `NewsEventsCard` reusable component, MARKET removed from footer |

### Design system — current state

**3-layer token architecture** in `src/styles/app.css`:
- **Layer 1 (Palette):** `--hue-*` tokens. Accent = `#0af` (electric blue).
- **Layer 2 (Semantic):** `--color-*` tokens aliasing to palette. Backward compatible.
- **Layer 3 (Material):** `--radius: 14px`, `--radius-sm: 10px`, `--shadow-card`, `--blur-card: 18px`, `--ease-out`, `--ease-spring`.

**CSS classes (defined in `app.css`, used across all surfaces):**
- `.panel` — translucent glass card (blur, shadow, radius, fade-up animation)
- `.panel-hero` — featured card: accent border, gradient bg, glow top-line (`::before`)
- `.card-hd` / `.card-ico` / `.card-lbl` / `.card-sub` / `.tmr` — structured card header system
- `.well` — inset recessed surface (`rgba(0,0,0,.28)`)
- `.capsule` — accent-tinted pill
- `.seg` / `.seg-on` — segmented control
- `.btn` / `.btn-primary` / `.btn-danger` / `.btn-sm` — button system
- `.shell` — page wrapper (`max-w-6xl px-5 md:px-8`)

**Body gradients** on `body` — three radial accent/green gradients behind every
translucent surface. Without them, `backdrop-filter: blur(18px)` is invisible.

**Responsive density:**
- Mobile (`<768px`): 12px card radius, 12px card padding, 16px shell padding
- Tablet (768–1023px): `max-w-6xl`, 24px shell padding
- Desktop (`≥1024px`): standard

**Reusable components:**
- `NewsEventsCard.astro` — news events panel with card header, dot severity
  empty state. Used on homepage (via MarketDay) and calendar. Props:
  `red`, `orange`, `dayIso`, `isToday`, `hideDate`.
- `fmtDayWUpper(iso)` — uppercase date formatter in `src/lib/dates.ts`.

### Design language rules (owner-locked, do NOT re-litigate)

1. **Same card type = same look everywhere, always.** One component, used
   consistently. Never duplicate card markup across pages.
2. **No words "red" or "orange" in UI.** Use dot severity indicators
   (🔴 `bg-down` / 🟠 `bg-warn`) instead.
3. **Uppercase dates everywhere.** Use `fmtDayWUpper()` — one utility, one place.
4. **No `/zen` link on public pages.** Single-user site — the owner knows
   where to log in.
5. **"CME" not "CME Globex".** Everywhere: MarketWidget, MarketFooter,
   MarketLive, brief.ts, strip.ts.
6. **"news events" not "the day".** The news card label is "news events".
7. **Stream icon is 📡, not 💭.** 💭 is for thoughts. Stream is the feed.
8. **Mono font stays.** `--font-mono` (JetBrains Mono). Syne is wordmark only.
9. **No sticky headers, no notification noise in header.**
10. **Public pages zero-JS** except the shared lightbox.

## Pipeline (prod / test)

Prod (`1ed.ge`) and pre-prod (`test.1ed.ge`) are two git worktrees on the
same repo (`main` and `preprod` branches). Full env contract in
`docs/PIPELINE.md`. Key points:
- Preprod: `/root/1ed-ge-preprod`, branch `preprod`, `.env` has `SITE_ENV=test`
- Prod: `/root/1ed.ge`, branch `main`, `.env` has `SITE_ENV=prod`
- `bash scripts/deploy-test.sh` — rebuilds + restarts preprod
- `bash scripts/deploy-prod.sh` — docker compose up + nginx + cron
- `bash scripts/sync-to-prod.sh -y` — preprod → main (blocks `src/content/*`)
- `bash scripts/verify-env.sh {test|prod}` — HTTP 200 + noindex checks
- Preprod has sandbox filler (6 accounts, 180 payouts, review data)
- Prod is a clean slate (owner starts real days from admin)

## Gotchas

- **Content-layer cache.** `npm run build` clears `node_modules/.astro` — keep it.
- **`/tmp/1edge-*.json`** (pending, rebuilds) — ephemeral, lost on restart.
- **SSR routes** read content at server start — deploy restarts pick up changes.
- **30-min autosave cron** sweeps uncommitted edits — commit promptly.
- **No parallel builds** (astro races on `node_modules/.astro`).
- **`pkill -F pidfile`** — never `pkill -f pattern` (self-match risk).
- **VPS can't resolve 1ed.ge** — use `curl --resolve 1ed.ge:443:104.21.7.179`.
- **nginx `/media/`** proxies to node (can't alias to `/root/` mode 700).
- **Never commit `.env`** or market-news cron edits.

## Owner-locked decisions

- Week = Mon–Fri trading week (no exceptions)
- Reflection habit = every Mon–Fri (even zero trades), strict 3h grace
- Fortnight = skipped
- Everything public except admin
- R = points / riskPoints (centerpiece metric)
- Files are the database (markdown frontmatter)
- Save ≠ rebuild (RebuildBar for queued changes)
- Journal editor = plain markdown textarea + preview
- AI-first day input (paste → structureDayFull → evidence-first)
- Public pages zero-JS (except lightbox)

## HANDOFF — Design system audit + CME trading day + display timezone (2026-08-10)

**Version: v0.1-alpha.** Three major efforts shipped in one session:

### Design system audit (9 phases, 75 files)
- iOS/Safari critical fixes (min-h-svh, safe-area, touch targets, lightbox swipe)
- Card system unification (Card.astro is the one panel primitive, 4 variants)
- Admin Card icons (icon prop on all cards)
- Date/typography compliance (fmtDayWUpper, text-xs/sm tokens — 67→0 violations)
- Chart & SVG audit (preserveAspectRatio, EmptyState, title elements, a11y)
- Component cleanup (15 dead files deleted, SheetFrame extracted)
- Motion token system (--motion-fast/normal/slow, transitions on seg/btn/capsule)
- Mobile blur reduction (blur(8px) on <768px)
- Lightbox → bottom sheet (slide-up, swipe-to-close, keyboard nav)
- Unified Card system (Card.astro with variant/stat/actions)

### CME trading day (23 files)
- `cmeDate(ms)` in sessions.ts — boundary = 17:00 America/Chicago, DST-safe
- `cmeToday()` replaces `todayHkt()` on all market-facing surfaces
- News fetch script: `isoDay(ms)` → `cmeDate(ms)` — events at 02:00 HKT bucket to previous trading day
- Admin `todayStr()` rewritten client-side with same CT logic
- 3 UTC bugs fixed (coach, media, NotificationDrawer)
- Display timezone: `<time class="local-time">` on public pages, inline script converts to visitor's local TZ (12-hour, progressive enhancement)
- Admin timezone picker (7 cities, localStorage)

### /dev page
- Public build log at `1ed.ge/dev` (linked from /about, not in nav)
- Stack, principles, features, changelog, token costs, version tracking
- **Full traceability**: 89 files mapped to features (8 categories)
- **Every code change must update /dev**: changelog entry + traceability if new files added
- Version increments when meaningful features ship; token costs table updated

### Design system — NON-NEGOTIABLE (2026-08-10)
The /dev page cards were wrong on first write. I built custom markup instead of using `<Card>`. Root cause: skipped the design system.

**Rule: Every new page uses the Card component.** Never hand-build `panel` + `card-hd` markup. If Card doesn't support a pattern, extend it. This is non-negotiable.

**Rule: Every new surface goes through the designer agent or uses existing Card patterns.** No exceptions.

### Card spacing (desktop)
`.card-hd` padding: `10px 14px`, min-height: `44px` (tightened from 12px/48px). Body: `p-3 md:p-4`. Global fix in app.css.

### JS budget
~15KB inline JS (lightbox, timezone, ticker/widget/footer). No external JS. All charts are SSR SVG. "Minimal JS" not "zero JS."

### Token costs
- v0.0 (pre-2026-08-10): ~$50
- v0.1-alpha (2026-08-10): ~$4
- Total: ~$54

## Model config (2026-08-10)

oh-my-opencode-slim v2.2.11, `opencode-go` preset:
- orchestrator: `cline-pass/cline-pass/qwen3.7-plus` (with `question: allow`)
- oracle: `cline-pass/cline-pass/qwen3.7-plus`
- explorer/librarian/fixer/observer: `opencode-go/deepseek-v4-flash`
- designer: `cline-pass/cline-pass/qwen3.7-plus`

## Open items / roadmap

- [ ] Move to Cloudflare Pages + CDN
- [ ] Safari/iOS/iPhone polish (safe-area insets, touch targets)
- [ ] Account configs — confirm real risk per trade / drawdown limits
- [ ] CSV bulk import of prop-firm statements
- [ ] Auto stage transitions on drawdown breach
