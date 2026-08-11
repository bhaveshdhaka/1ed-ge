# /status + /dev Vital Stats — Design Spec

**Status:** approved  
**Date:** 2026-08-11  
**Scope:** Public SSR pages, zero JS, design-system primitives only

## Goal

Operational transparency. Every automated process (crons, syncs, rebuilds) has its health and results visible on `/status`. Every build metric (source code, stack, content) is visible on `/dev`. Both pages are public, SSR, and update on every deploy.

## Split

| Page | Answers | Changes when |
|---|---|---|
| `/status` | "Is it working?" | Crons run, rebuilds happen, system state changes |
| `/dev` | "What is it?" | Code is committed, content is added |

## /status Page

### Sections

#### 1. Market News Fetch
Source: `/tmp/1edge-market.log` (last 50 lines) + `src/content/market-news/*.md` files

Display:
- Last fetch timestamp
- Summary line: `39 TV + 11 FF → 50 events (16 red, 25 verified)`
- Source health: TV status (green/red), FF status (green/red)
- Verified count + unverified count
- Unverified events list in scrollable `<Well>` — each row shows `[TV]` or `[FF]` badge + time + title + severity dot
- Last 5 fetch log lines in `<Well>` (monospace, pre-wrapped)

#### 2. Rebuild History
Source: `/tmp/1edge-rebuilds.json` + `/tmp/1edge-pending.json`

Display:
- Last rebuild: timestamp, success/failure badge, duration
- Pending changes count (if > 0, show warning badge)
- Last 10 rebuild entries in a table: time | status | applied items

#### 3. System Health
Source: shell commands (`docker ps`, `df`, `free`, `uptime`)

Display:
- Docker container: `1edge-site` status (running ✅ / stopped ❌)
- Disk: used/total + percentage bar
- Memory: used/available + percentage bar
- Uptime: system uptime string
- Node processes: count

#### 4. Git State
Source: `git` commands

Display:
- Current branch name
- Last commit: hash (short) + message + relative time
- Ahead/behind remote (if tracking)

#### 5. Live State
Source: `/tmp/1edge-live.json`

Display:
- Trader status: live (green dot) or offline (dim dot)
- Last heartbeat: relative time ("2 hours ago")

### Data fetching

All data read in Astro frontmatter (server-side). No new APIs needed. Shell commands via `child_process.execSync`. JSON files via `fs.readFileSync`. Log files via `fs.readFileSync` + slice last N lines.

### Design

- Page wrapper: `<Card icon="📡" label="status" subtitle="operational health">`
- Each section: its own `<Card>` with icon + label
- Key-value data: `<KvRow>` everywhere
- Log output: `<Well class="p-3">` with monospace pre-wrapped text
- Status indicators: `<Badge variant="up">healthy</Badge>` / `<Badge variant="down">failed</Badge>`
- Percentage bars: simple CSS `width: X%` with `bg-up`/`bg-down` color
- No client-side JS — all server-rendered

---

## /dev Page Updates

### New sections to add

#### Source Code Stats
Source: shell commands (`find src/ -name '*.astro' | wc -l`, `wc -l`, etc.)

Display:
- Total lines of code in `src/`
- File count by type: `.astro`, `.ts`, `.tsx`, `.css`, `.md`
- Breakdown: pages vs components vs lib vs styles

#### Content Counts
Source: `fs.readdirSync` on content directories

Display:
- Days recorded
- Journal entries
- Trades (sum of trades across all days)
- Accounts (active/total)
- Habits (active/total)
- Reviews
- Media files

#### Stack Versions
Source: `process.version`, `package.json` dependencies

Display:
- Node.js version
- Astro version
- Tailwind version
- OS + architecture

### Design

- New sections added to existing `/dev` page layout
- Each section uses `<Card>` with icon + label
- Data in `<KvRow>` rows
- File counts in a small `<Table>`

---

## Implementation

- SSR (`prerender = false`) — reads live data on each request
- Zero client-side JS
- Uses existing design system primitives only (Card, KvRow, Well, Badge, Table)
- No new APIs, no new lib files — data fetched inline in frontmatter
- Nav: `[XX] status` added after `/dev`

## Files to create/modify

| File | Action |
|---|---|
| `src/pages/status.astro` | Create — new SSR page |
| `src/pages/dev.astro` | Modify — add source code stats, content counts, stack versions |
| `src/components/Nav.astro` | Modify — add status nav link |

## Verification

- `npm run typecheck` — zero new errors
- `npm run build` — clean build
- `/status` renders all 5 sections with live data
- `/dev` renders new sections with live data
- Both pages use design system primitives only (grep audit: no hand-built patterns)
