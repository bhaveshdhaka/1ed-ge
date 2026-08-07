# The Stream System — design spec

**Date:** 2026-08-07 · **Status:** Approved (v1) · **Owner:** sole trader
**Product:** 1ed.ge — cockpit (private production) → approved broadcast → public archive.

---

## 1. Vision

Two surfaces, one spine.

- **Cockpit (private, `/admin`)** — the owner's workspace. Capture, AI
  structuring, evidence-first editing, reflection drafting, quote rotation,
  habit ticking, model + library management. **Nothing renders publicly by
  accident.**
- **Stream (public, zero-JS)** — a curated broadcast. A subset of cockpit
  content flows out **only with the owner's approval**, as an ordered feed of
  moments. `/` = intro hero + today's live stream. `/stream` = the rolling
  feed (SSR). `/day/<date>` = the posterized archive ("once the day ends it is
  just there for posterity").

The previous model mirrored the cockpit onto public pages (rails, timeline,
cells) — the owner explicitly rejects it: "transparency ≠ a dumb mirroring
system." The day record stays the spine; presentation is decoupled from the
workspace.

**Master clock:** the whole day's timeline anchors to the **CME 23-hour
futures day** (one maintenance halt, Fri close / Sun reopen). Exchange sessions
are bands layered on that ruler: 🇯🇵 TSE (Asia) · 🇬🇧 LSE (London) · 🇺🇸 NYSE
(cash). "Market open" = CME futures trading, not the NYSE cash session.

## 2. Context & problem

- The day page renders the cockpit *and* the legacy article sections below —
  mood/sleep/screen/habits/trades shown 2–3× (audited 2026-08-07).
- The site has no method: arbitrary `text-[8px]…[22px]`, hardcoded colors,
  dead CSS (~60 lines), three heading conventions, a Milkdown editor rendered
  in a **pre-summit palette** (sky-blue `#7dd3fc` / coral `#f87171`).
- Money is colored wrong in three pages (negative P&L green; "failed" stage
  green).
- The live filler data self-contradicts: accounts $4K underwater labeled
  "buffer cleared", trades on 19 US holidays, 29% of losses blow 1.5–4× through
  the stop, journal prose contradicts day records, duplicate Day Zero.
- The account lifecycle is freeform (any stage sequence allowed); the owner's
  real prop-firm model is three phases.
- The admin has silent-data-loss bugs: tab switch destroys unsaved day work,
  pasting new evidence wipes existing trades, rebuild failures are invisible.
- Engine (sessions, R/stats, holidays, DST) is solid and **untouched**.

## 3. Design system (the "method")

Adopt **shadcn/ui conventions** (not the npm package): Tailwind v4 CSS-first
tokens, atomic primitives, variant contracts, one skill to enforce it.

- **Tokens** — `src/styles/global.css` → `src/styles/app.css`. `@theme` block
  mapping the summit palette 1:1 to shadcn var naming (`--background`,
  `--foreground`, `--card`, `--border`, `--primary`, `--muted`, `--destructive`
  + custom `--up`/`--down`/`--sage`/`--clay`/`--accent`/`--warn`). One radius
  scale (2px/1px), one type scale, one divider token, one shadow token.
- **Type scale** (mono-only; Syne reserved for the wordmark):
  `--text-3xs .625` · `2xs .6875` · `xs .75` · `sm .8125` · `base .9375` ·
  `lg 1.125` · `quote 1.125` · `2xl 1.5` · `3xl 2` · `4xl 2.5` · `5xl 3` (rem).
  Weights `400/500/600/700`. Leading tokens `tight/snug/normal/relaxed`.
  Tracking `tighter/wide/widest`. **Bold is a weight, never size/color.**
  `:where(h1..h4)` zero-specificity base (600 weight, tight leading, balanced
  wrap). One `h1` per page. **Every number is `tabular-nums`.**
- **Primitives** — a curated set (~14–20) in `src/components/ui/`, each with a
  zero-JS Astro variant (public) and a React/Radix variant where interaction is
  needed (admin): `Card, Table, Badge, Button, Input, Label, Textarea, StatCard,
  Tabs, Select, Dialog, Tooltip, Toast, Separator, Dot, Quote, Tag, Flag`. Count
  is sized by the real surfaces, not fixed.
- **Icons** — Lucide. Inline SVG on public (`Icon.astro`), React components in
  admin. Emoji soup dies; flags stay emoji (🇺🇸🇯🇵🇬🇧 — Lucide has no country
  flags).
- **Skill** — `.opencode/skills/design-system/SKILL.md` is the consistency
  lock: documents every primitive/class, the "public = HTML subset, never
  hand-roll a button, never use arbitrary `text-[..px]`" rules. Agents clone,
  they don't invent.

**Framework split (unchanged):** React lives only inside `/admin` (it already
does). Public pages ship zero JS. SSR is used for `/` and `/stream` only.

## 4. Data model

### 4.1 Day record (`days/<date>.md`) — the spine, extended

```yaml
date: "2026-08-07"
mood: 3
sleep: { hours: 6.5, quality: 3 }
habits: { quiet-time: true, read: 30 }
device: { iphoneHours, socialHours, macHours, notes, screenshots }
trades:
  - market: MNQ
    direction: long
    session: ny-am
    setup: ORB
    model: orb-mnq-scalp      # NEW — trading model tag
    entry/stop/exit/points/riskPoints
    executions: [...]
    commentary: "..."         # NEW — optional published commentary (approved)
stream:                       # NEW — approved, ordered moments for the day
  - at: "08:30"
    type: pre-market
    text: "news tonight — flat 15 before"
  - at: "14:05"
    type: trade
    tradeIdx: 0               # references a trade above (commentary attached)
  - at: "20:12"
    type: quote
    text: "..."
    author: "..."
draft:                        # NEW — private, never rendered publicly
  reflection: "..."           # unpublished long-form reflection
  moments: [...]              # unpublished draft moments
```

- **Facts auto-public** on save+rebuild (transparency contract, no
  cherry-picking): mood, sleep, screen-time, **habit ticking**, trades +
  commentary, accounts, payouts.
- **Narrative approval-gated**: `stream` moments and the published reflection
  appear only when the owner publishes them. Drafts live in the `draft:` block
  and are never rendered by any public route.
- **Reflection** publishes to `journal/<date>.mdx` (the archive format, drives
  `/journal` + RSS) as before; the draft text lives in `draft.reflection`.
- Known tradeoff (owner chose): drafts are committed with the day record. If
  the git repo is ever public this leaks — flagged in MEMORY.

### 4.2 Moment taxonomy

| `type` | meaning | goes live |
|---|---|---|
| `pre-market` | pre-market thought | publish |
| `post-market` | post-market debrief | publish |
| `trade` | trade card + attached commentary | facts auto-public; commentary on publish |
| `note` | any trader-streamer note | publish |
| `quote` | a quote the owner chose to post | publish |
| `media` | approved screenshot | publish |

Later (schema-ready, not built): `voice`, `video`.

### 4.3 Trading models (`models/`)

New collection. `name, premise, rules: string[], status: active|paused|retired,
order`. Every trade may carry a `model` tag. Public `/models` page renders each
model + its rules + its trades.

### 4.4 Two-level rules

- **Overall** — `rules/` collection (risk fixed $, flat before news, no
  revenge, log everything). Cockpit rail + `/about`.
- **Model** — each model carries its own `rules: []`. Public `/models`,
  cockpit next to tagged trades.

### 4.5 Habits v2

Schema: `name, kind: bool|count, target?, category, order, active, color`.
Categories: health · trading · discipline · mind · environment. Day record
stores `habits: { <id>: true | number }`. Admin manages in the Library tab.
Seed to ~12–16 across categories. Public: categorized checklist on `/day`,
streak + heatmap grouped by category on `/performance`. Colors from tokens
(muted), never the old bright palette.

### 4.6 Account lifecycle (owner's real model)

`eval → funded → buffer → payout`, terminal `failed` / `paused`. Transitions
gated: cannot skip a phase; `payout` requires `buffer` reached + net-positive;
blown buffer → `failed`. Admin stepper shows only valid next actions. Payouts
require `stage=payout` and `netPnl ≥ amount`. Stats engine clamps buffer/dd
math so a blown account never reports "buffer left".

## 5. Publication pipeline

- Everything written in the cockpit starts as a draft.
- Publish a moment: **submit as-is**, or **AI polish → approve → live**.
  The AI-polish path never goes live without the owner's approve.
- "Publish end of day" pushes the day's approved set to the `/day` archive.
- Live presence: the admin sends a heartbeat (`POST /api/admin/ping`) while
  active; `/stream` + `/` (SSR) read it → "● trader is live", "last message X
  min ago", "today so far" digest computed per request.

## 6. Surfaces

### Public (zero-JS)
- **`/`** — intro hero (what this is: 2-year public journal, R, everything
  public) + today's stream + day facts. SSR so "today" is real. **The intro is
  permanent, never dismissed.**
- **`/stream`** — SSR rolling feed, latest-first across days, categorized
  moments, live moniker + last-message + today-so-far.
- **`/day/<date>`** — posterized archive: facts strip (mood/sleep/screen/
  habits/trades w/ model tags) + that day's published moments. No cockpit
  mirror. Static (rebuilt on publish).
- **`/models`** — models + per-model rules + their trades.
- **`/journal`** — published reflections (rebuilt on primitives; kills the
  duplicated markup + 268KB inline body blob).
- **`/performance`, `/accounts`, `/calendar`, `/coach`, `/about`** — tokenized
  + primitive-driven, session/CME-23h anchor applied, money-color rules fixed.

### Admin (React)
- **DayWorkspace** — capture → evidence → reflection (markdown editor) →
  moment composer → publish. Trades get model tags + optional commentary.
- **Library tab (NEW)** — habits, models, quotes, rules (overall + per-model)
  CRUD.
- **Editor** — Milkdown Crepe **out**; plain markdown textarea + live preview.
  Remove `@milkdown/crepe`, delete `editor.css`. Journal stays MDX on disk.
- **Safety** — dirty-guard on tab switch; no wipe-on-paste (merge, don't
  replace); loud rebuild failures; AI timeouts; aria labels; honest "drag"
  copy; heartbeat.

## 7. Filler data regeneration (`scripts/seed-review.mjs`)

- Positive edge: avgR ≈ +0.3–0.5, size-scaled per account.
- **No trades on US holidays / closed days** (use the site's own
  `marketDay()`).
- Losses honor the stop (~1R, small slippage only); wins uncapped.
- Journal prose generated from actual day data (no "one trade" vs 2-trades,
  no "long" vs short, no `++`).
- Payouts gated by lifecycle; blown accounts auto-`failed`.
- Every trade tagged with a model; models with realistic rules.
- One day-zero only (remove the duplicate `2026-08-06.mdx`).
- 730-day build stays ~15s.

## 8. Remediation (bundled)

Money-color bugs (performance/accounts/about/DayWorkspace), tablet breakpoint
(rails at 768–1023px), floating sticky subnav, journal API path traversal
(`GET /api/admin/journal?file=`), early-close copy (`1:15pm ct` vs `1:00pm et`
— unify on CME-23h framing), rebuild race (mutex), dead CSS purge, `--font-display`
phantom, `lighthouserc` dead URLs, unit tests for stats/sessions/timeline,
docs updated (AGENTS/MEMORY/CHANGELOG).

## 9. Locked tradeoffs

- Drafts live in git-tracked day files (owner chose; flagged).
- `/` + `/stream` are SSR — server-computed, not CDN-cacheable. Fine at this
  traffic.
- `/day` archive static — rebuilds on publish.
- Public stays zero-JS; React admin-only (unchanged).
