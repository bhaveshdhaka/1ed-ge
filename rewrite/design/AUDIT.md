# AUDIT.md — dual-POV UX audit of current 1ed.ge

Grounded walkthrough, Aug 2026. Code refs are evidence, not blame.
Feeds sprint specs: every friction below maps to a design obligation in
`docs/design/sprints/`.

---

## A. Visitor POV (public site)

### The journey as built

1. **Land on `/`** — hero paragraph block ("1edge — a public trading
   journal…"), then market widget, then "today" card (news + facts strip),
   then stream card. Three stacked sections, each `max-w` constrained
   (`src/pages/index.astro`). Verdict: the *idea* is right — today at a
   glance — but the page opens with 100px of self-description before any
   data. A first-time visitor waits for the point.
2. **Want the numbers?** `/performance` (262 lines) shows equity/drawdown/R.
   Want trends? There's also `/trends`. And `/tracker`. Three overlapping
   stat surfaces; none cross-linked clearly. A visitor cannot tell which is
   canonical.
3. **Want a specific day?** `/day/[date]` exists but nothing on home links
   to yesterday — only "last logged day" when today is empty. The archive is
   discoverable only via nav labels.
4. **Stream** (`/stream`) lists thought cards; fine. But images open via the
   one zero-JS exception (Lightbox `<dialog>`) — good.
5. **Calendar** (`/calendar`, 73 lines) and market footer widgets show
   TSE/LSE/NYSE/CME state. Nice craft; more than a visitor needs daily.

### Friction inventory (visitor)

| # | Friction | Evidence |
|---|---|---|
| V1 | Point of the site arrives late — prose before data | index.astro:95-107 |
| V2 | 3 competing stats pages, no canonical performance story | pages/performance,trends,tracker |
| V3 | No obvious "yesterday / browse days" path from home | index.astro links |
| V4 | "Zero-JS" isn't literal: MarketWidget/Live/Footer ship inline scripts — fine, but undocumented reality vs docs claim | grep `<script` in components |
| V5 | Live pulse ("trader is live") depends on admin being open — honest but unexplained to visitors | AdminApp ping → live.ts |
| V6 | Design system spec describes machinery that no longer exists (CI, post-deploy tokenomics) — visual language itself is strong and worth keeping | design-system.md |

### What a visitor actually needs (jobs)

- In 5 seconds: is the trader live/trading today, and is he up or down?
- In 30 seconds: R curve over time, habits streak, today's mood/sleep/screen-time.
- On interest: drill into any single day and see exactly what happened.
- On respect: proof nothing is curated — raw tickets, misses included.

## B. Trader POV (/zen admin)

### Posting a day update today (the core loop)

Open /zen (passkey) → land on **overview** tab → click **day** tab (or press
2) → DayWorkspace loads day via fetch → find WriteZone composer → type →
click publish thought → toast → change queued to pending.json → sticky
rebuild bar shows count → click rebuild → poll status drawer → 8–20s+ →
"live". That's **3 surfaces touched + 2 explicit commits (save/publish +
rebuild)** to move one thought. During market hours this is flow-poison.

Evidence: AdminApp tabs (AdminApp.tsx:15-23), dirty-state confirm dialogs
(AdminApp.tsx:106), bus/setTimeout coupling (248, 264), rebuild polling
(api.ts:195-200).

### Structural UX debts

| # | Debt | Evidence |
|---|---|---|
| Z1 | 7 tabs for a single-user tool; trading needs one surface | TABS array |
| Z2 | Two-phase mental model (dirty vs saved vs published vs none) — four states to track in the head | dayStatus union, AdminApp.tsx:50 |
| Z3 | DayWorkspace = ~30 useState hooks + manual form-field mirroring; every new field touches load/save/normalize/render | DayWorkspace.tsx:87-128 |
| Z4 | Composer hides behind tab navigation; capture latency is clicks, not keystrokes | WriteZone mount path |
| Z5 | Trade entry = 18-field form incl. duplicated model/model[] concepts | TradeForm interface, content.config.ts |
| Z6 | Rituals (973-line panel) buried inside day tab; it's the owner's actual in-session companion | RoutinesPanel.tsx |
| Z7 | Notifications drawer, command palette, ghost-text AI, ingest sheets all compete for attention; no hierarchy of now-vs-later | components list |
| Z8 | Rebuild bar makes publishing feel like deployment, not speech | rebuild.ts flow |
| Z9 | confirm() browser dialogs for unsaved changes — breaks immersion, loses context on mobile Safari anyway | AdminApp.tsx:106 |

### What the trader actually needs (jobs)

- **During market hours:** clock/session glance · capture a thought ≤3s ·
  log a trade ≤20s with live R · paste screenshot ≤5s · rituals one tap away.
- **Post-market:** reflection prompted by obligation state, not hunted;
  habits tick; review flows guided.
- **Always:** everything autosaved; publish invisible; ⌘K reaches anything;
  works flawlessly one-handed on iPhone in Safari standalone mode.

## C. Design language verdict

Keep: near-black summit, mono type, dense spacing, translucent panels,
green/red data-only discipline, capsule/well/panel vocabulary. It's
distinctive and already loved (WALogger-v2 direction, owner 2026-08-10).
Fix: tokens were never frozen against real references; docs describe dead
machinery; primitives drifted between Astro and React implementations.
The S0 foundation sprint re-freezes the language once, in one file, shared
by mocks and production forever after.
