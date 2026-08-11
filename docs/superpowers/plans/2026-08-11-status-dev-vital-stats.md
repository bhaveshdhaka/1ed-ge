# /status + /dev Vital Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/status` page showing operational health (crons, syncs, rebuilds, system) and extend `/dev` with source code stats, content counts, and stack versions.

**Architecture:** Two SSR pages (`prerender = false`), zero client-side JS. All data read inline in Astro frontmatter via shell commands, JSON files, and filesystem reads. Uses existing design system primitives (Card, KvRow, Well, Badge, Table).

**Tech Stack:** Astro 5, Tailwind CSS v4, TypeScript, child_process.execSync

## Global Constraints

- Public pages, zero JS — server-rendered only
- Design system primitives only — Card, KvRow, Well, Badge, Table
- No new APIs, no new lib files — data fetched inline in frontmatter
- `npm run typecheck` must pass with zero new errors after every task
- Commit after each task with conventional prefix

---

### Task 1: Create /status page

**Files:**
- Create: `src/pages/status.astro`

**Interfaces:**
- Produces: Public SSR page at `/status` with 5 sections

- [ ] **Step 1: Create the status page**

Create `src/pages/status.astro` with `prerender = false`. Read data from:
- `/tmp/1edge-market.log` — last 50 lines, parse TV/FF counts
- `/tmp/1edge-rebuilds.json` — rebuild history
- `/tmp/1edge-pending.json` — pending changes
- `/tmp/1edge-live.json` — live state
- Shell commands for system health (docker, df, free, uptime)
- Shell commands for git state (branch, last commit, ahead/behind)

Render 5 sections using Card + KvRow + Well + Badge:
1. Market News Fetch — last fetch, TV/FF counts, verified/unverified, unverified list, log tail
2. Rebuild History — last rebuild, pending count, last 10 entries table
3. System Health — docker status, disk, memory, uptime, node processes
4. Git State — branch, last commit, ahead/behind
5. Live State — trader status, last heartbeat

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/status.astro
git commit -m "feat: add /status page — operational health dashboard"
```

---

### Task 2: Update /dev page with vital stats

**Files:**
- Modify: `src/pages/dev.astro`

**Interfaces:**
- Consumes: Existing page structure
- Produces: 3 new sections added to /dev

- [ ] **Step 1: Read current dev.astro**

Read the file to understand current structure and find insertion points.

- [ ] **Step 2: Add Source Code Stats section**

Add a new Card section with:
- Total lines of code in `src/` (via `wc -l`)
- File count by type: `.astro`, `.ts`, `.tsx`, `.css`, `.md` (via `find` + `wc -l`)
- Breakdown: pages vs components vs lib vs styles

Use `<Card icon="📊" label="source code" subtitle="lines of code">` with KvRow for each metric.

- [ ] **Step 3: Add Content Counts section**

Add a new Card section with:
- Days recorded (count files in `src/content/days/`)
- Journal entries (count files in `src/content/journal/`)
- Trades (sum of trades across all day files)
- Accounts (count files in `src/content/accounts/`)
- Habits (count files in `src/content/habits/`)
- Reviews (count files in `src/content/reviews/`)
- Media files (count files in `public/media/`)

Use `<Card icon="📁" label="content" subtitle="live counts">` with KvRow for each count.

- [ ] **Step 4: Add Stack Versions section**

Add a new Card section with:
- Node.js version (`process.version`)
- Astro version (from `package.json`)
- Tailwind version (from `package.json`)
- OS + architecture (`process.platform` + `process.arch`)

Use `<Card icon="⚙️" label="stack" subtitle="versions">` with KvRow for each version.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/dev.astro
git commit -m "feat: /dev page — source code stats, content counts, stack versions"
```

---

### Task 3: Add status nav link

**Files:**
- Modify: `src/components/Nav.astro`

**Interfaces:**
- Produces: `[XX] status` link in navigation

- [ ] **Step 1: Read current Nav.astro**

Read the file to find where nav links are defined.

- [ ] **Step 2: Add status link**

Add a nav entry for `/status` after the `/dev` link. Use the next number in sequence.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/Nav.astro
git commit -m "feat: add status nav link"
```

---

### Task 4: Final verification

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean build

- [ ] **Step 3: Grep audit**

Run: grep for hand-built patterns in the new files
Expected: zero violations — all using design system primitives

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final verification — status + dev vital stats"
```
