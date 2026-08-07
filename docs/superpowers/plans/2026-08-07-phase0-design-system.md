# Phase 0 — Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the tokenized design system (Tailwind v4 `@theme` tokens, zero-JS Astro primitives, React/Radix admin variants, Lucide icons, and the enforcing skill) with zero visual regression to the live site.

**Architecture:** Consolidate `src/styles/global.css` → `src/styles/app.css` (one `@theme`, summit values inlined, dead CSS purged, full type scale). Build `src/components/ui/` primitives: Astro (public, zero-JS) and React (admin, Radix). Write `.opencode/skills/design-system/SKILL.md`.

**Tech Stack:** Astro 5, Tailwind CSS v4 (`@tailwindcss/vite`), React 19 (admin only), Radix UI, class-variance-authority, tailwind-merge, lucide-react.

## Global Constraints

- Public pages ship **zero JS** — every Astro primitive is server-rendered HTML only; `client:` directives and React imports are forbidden on public pages.
- React lives only under `/admin` (`client:only="react"`). The framework split is unchanged.
- **No arbitrary `text-[..px]`** anywhere new — only the `@theme` type-scale tokens.
- Every number is `tabular-nums`; bold is a weight token, never size/color.
- Summit palette (verbatim, do not change values): bg `#07080c`, panel `#0d0f16`, raise `#12141d`, line `#1c2030`, line2 `#2a2f42`, ink `#e6ebf5`, soft `#aab2c6`, dim `#8b93a6`, faint `#7d859a`, accent `#8ab4ff`, up `#6ea88a`, down `#c2725e`, warn `#d9a441`, purp `#c4b5fd`, clay `#b06a5e`.
- After every task: `npm run typecheck`. Before deploy: `npm run build`.

---
## Task 1: Token foundation — `app.css`

**Files:**
- Create: `src/styles/app.css`
- Delete: `src/styles/global.css` (after import swap)
- Modify: `src/layouts/Base.astro:2`, `src/layouts/Bare.astro` (import path)
- Modify: `src/components/ThemeBackground.astro`, `src/components/Brand.astro`, `src/components/admin/editor.css` — **skip in this task; they keep working via `var(--color-*)`.**

**Interfaces:**
- Produces: `@theme` tokens — color set above (same names: `--color-bg`, `--color-panel`, `--color-raise`, `--color-line`, `--color-line2`, `--color-ink`, `--color-soft`, `--color-dim`, `--color-faint`, `--color-accent`, `--color-up`, `--color-down`, `--color-warn`, `--color-purp`, `--color-sage`, `--color-clay`); type scale `--text-3xs .625rem`, `--text-2xs .6875rem`, `--text-xs .75rem`, `--text-sm .8125rem`, `--text-base .9375rem`, `--text-lg 1.125rem`, `--text-quote 1.125rem`, `--text-2xl 1.5rem`, `--text-3xl 2rem`, `--text-4xl 2.5rem`, `--text-5xl 3rem`; weights `--font-weight-medium 500`/`semibold 600`/`bold 700`; leading `--leading-tight 1.1`/`snug 1.3`/`normal 1.5`/`relaxed 1.7`; tracking `--tracking-tighter -.025em`/`wide .04em`/`widest .14em`; `--radius 2px`, `--radius-sm 1px`, `--shadow-panel`, `--chart-grid`, `--chart-alt #8ab4ff`.
- Produces: base layer — `:where(h1,h2,h3,h4)` (font-mono, weight 600, `letter-spacing:-.01em`, `line-height:1.1`, `text-wrap:balance`), `::selection` from accent token, body, scrollbar, `a`, `color-scheme:dark`.

- [ ] **Step 1: Copy `global.css` → `app.css` and apply the migration**

Migrate `global.css` to `app.css`:
1. `@theme` block: replace the old default palette with the **summit** values inline (delete the old `--font-display` line, delete old `#0a0a0c` defaults). Add the type-scale/weight/leading/tracking tokens above.
2. Delete the `[data-theme='summit'] { … }` override block (values now live in `@theme`), the `[data-theme]` display-typography rules, `.crt` + its reduced-motion override, `@keyframes blink`, `.hero-fade` + keyframes, `.mono-up`/`.mono-down`, `.ck-drop`, `.sticky-subnav`, `.pt-safe`, `.target-44`, `--glow`/`--accent2`/`--chart-empty`.
3. `::selection`: `background: color-mix(in srgb, var(--color-accent) 20%, transparent); color: var(--color-ink);`.
4. Keep: `.shell`, `.panel`, `.btn`/`btn-primary`/`btn-danger`/`btn-sm`, `.input`, `.label`, `.th`/`.td`, `.kv`, `.num-up`/`.num-down`, `.tag`, all `.ck-*` cockpit classes (still used by CockpitPage until Phase 3), `.ck-tl` bands re-tokenized: `.cme` → `rgba(139,147,166,.13)`, `.tse,.lse` → `rgba(139,147,166,.20)`, `.nyse` → `color-mix(in srgb, var(--color-up) 16%, transparent)`, `.ck-hz`/`.muted` → `var(--color-clay)` / `color-mix(in srgb, var(--color-clay) 60%, transparent)`.
5. Keep `.theme-bg`/`.tb-*`/brand blocks and their reduced-motion overrides. `.brand-word` gradient `#ffffff` mid-stop → `var(--color-ink)`.
6. `.prose` restyle through tokens (font sizes → `--text-base`, `--text-lg`, `--text-2xl` equivalents; blockquote → `--text-quote` role, `border-left:2px solid var(--color-line2)`, no italic).
7. Keep the `@media (pointer: coarse)` + `max-width:767px` touch rules (min-height 44px on `.btn`).

- [ ] **Step 2: Swap imports**

In `src/layouts/Base.astro:2` and `src/layouts/Bare.astro`, change `'../styles/global.css'` → `'../styles/app.css'`. Delete `global.css`.

- [ ] **Step 3: Verify no visual regression**

Run: `npm run typecheck && npm run build`
Expected: PASS. Then diff the built CSS token values: the rendered summit colors must be unchanged.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "style: tokenize design system into app.css — summit @theme, type scale, purge dead CSS"
```

---
## Task 2: Astro UI primitives (public, zero-JS)

**Files:**
- Create: `src/components/ui/Button.astro`, `Badge.astro`, `Card.astro`, `Table.astro`, `StatCard.astro`, `Tag.astro`, `Separator.astro`, `Dot.astro`, `Quote.astro`, `Field.astro`, `Input.astro`, `Textarea.astro`, `EmptyState.astro`, `Flag.astro`, `Icon.astro`

**Interfaces:**
- Produces (consumed by Phase 3 pages): each accepts `class` passthrough and documented props. `Flag.astro` maps `'us'|'uk'|'jp'|'cme'` → `🇺🇸🇬🇧🇯🇵` (cme → `📈`). `Icon.astro` maps a curated lucide name → inline SVG (`stroke="currentColor"`, `width/height=1em`), zero-JS. `Badge.astro` variants: `default|up|down|warn|accent|muted|outline`. `Button.astro` variants `default|primary|danger|ghost`, sizes `sm|md`.

- [ ] **Step 1: Create the primitives** using only `@theme` tokens and shadcn class structures. Each is a small Astro component; `class` prop merges into the class list. No `client:` directives, no scripts.

- [ ] **Step 2: Icon set** — add a curated dictionary (~24 icons: `activity, calendar, chart, check, chevron-left/right, clock, flame, globe, link, menu, message, plus, search, sparkles, target, trend-up/down, user, x, zap, flag, wallet, layers`) as inline SVG path data in `Icon.astro` (lucide, MIT). Default `size="16"`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build` — PASS. (Nothing consumes them yet; build success is the gate.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): zero-JS Astro primitives — Button/Card/Table/Badge/StatCard/Icon/Flag + tokens"
```

---
## Task 3: Admin React primitives (Radix)

**Files:**
- Modify: `src/components/admin/ui.tsx`
- Create: `src/components/ui/react/{Dialog,Tooltip,Toast,Select,Tabs,Checkbox}.tsx`, `src/components/ui/react/button.tsx` (cva), `src/lib/utils.ts` (`cn` = clsx + tailwind-merge)
- Modify: `package.json` (add deps)

**Interfaces:**
- Produces: `cn(...)` helper; `Button` (cva variants); `Dialog` (Radix `Root/Trigger/Content/Overlay/Title/Description/Close`); `Toast` (Radix, `aria-live`); `Tooltip`; `Select`; `Tabs`; `Checkbox`.
- Consumes: existing `Field`, `TextInput`, `NumInput`, `TextArea`, `Select`, `Card`, `Stat` keep their exact exported names (admin tabs import them) but are re-skinned through tokens (text-[13px] → `text-sm`, etc.).

- [ ] **Step 1: Install deps**

Run: `npm install @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-checkbox @radix-ui/react-toast class-variance-authority tailwind-merge lucide-react`

- [ ] **Step 2: `cn` + re-skin `ui.tsx`**

Create `src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```
Re-skin `ui.tsx` to use `cn` + tokens (`text-sm` instead of `text-[13px]`, etc.). Keep the same exports/signatures.

- [ ] **Step 3: Radix primitives** — create the React components in `src/components/ui/react/` (shadcn patterns: `DialogContent` with focus trap + `aria-modal`, `Toast` with `aria-live=polite`, `Select` with `aria-label`).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run build` — PASS. The admin still renders (no API changes).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ui): admin React primitives — Radix dialog/tooltip/toast/select/tabs/checkbox + cn"
```

---
## Task 4: Design-system skill

**Files:**
- Create: `.opencode/skills/design-system/SKILL.md`

- [ ] **Step 1: Write the skill** documenting: the token set (values verbatim), the type scale + rules (no arbitrary `text-[..px]`, tabular-nums, bold=weight), the public zero-JS constraint (HTML subset only; `Icon.astro` not emoji except flags; `Flag.astro`), the admin React rule (Radix primitives, never hand-roll a modal/toast), and "which primitive for which job". Include a "never" list (no raw `<button class=…>` when `ui/Button` exists, no inline `style={{color}}`, no `text-[13px]`).

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: design-system skill — token/primitive/zero-JS contracts for agents"
```

---
## Task 5: Ship Phase 0

- [ ] **Step 1: Full verify** — `npm run typecheck && npm run build && npm run test:e2e` (e2e must stay green).
- [ ] **Step 2: Deploy + verify live** — `bash scripts/deploy.sh`, poll `https://1ed.ge` (use `curl --resolve 1ed.ge:443:104.21.7.179`), confirm the homepage + a day page + `/admin` still render with the summit palette and the new CSS file is served.
- [ ] **Step 3: Commit any deploy fix** and update `MEMORY.md` session log + `CHANGELOG.md`.
