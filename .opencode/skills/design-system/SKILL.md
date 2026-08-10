# 1ed.ge Design System

The single source of truth for how 1ed.ge is built visually. **Read this before
touching any UI.** The design language is a refined, precision-instrument aesthetic
(reference: WALogger v2) — translucent cards, soft corners, fade-up motion, mono-only
type, near-black background, blue accent for UI chrome, green/red for data only.

**Design direction (owner 2026-08-10):** "Most similar to the [WALogger] screenshots.
Just a bit more dense and tighter on the indentations and spacing." Information-dense,
not generous whitespace.

Two hard rules govern everything:

1. **Public pages ship zero JS.** Every public surface is server-rendered HTML.
   No `client:` directives, no React, no inline handlers on public routes.
2. **React lives only inside `/zen` (admin).** The admin is the sole React island
   (`client:only="react"`). Admin UI uses the React primitives in
   `src/components/ui/react/` — never hand-roll a modal, toast, tooltip, or
   select.

---

## Tokens (`src/styles/app.css` @theme)

**Never use arbitrary values.** `text-[13px]`, `#c07a6d`, `leading-[1.6]` are
forbidden in new code. Use the tokens:

### Color (summit palette — the only skin)

**Core principle: blue is the ONLY UI accent.** Green/red are for DATA ONLY
(up/down P&L, positive/negative metrics). Never use green/red for UI chrome
(labels, badges, buttons, links).

| token | value | use |
|---|---|---|
| `--color-bg` | `#07080c` | page background |
| `--color-panel` | `#0d0f16` | solid surfaces |
| `--color-raise` | `#12141d` | hover, raised surfaces |
| `--color-line` | `#1c2030` | borders, dividers |
| `--color-line2` | `#2a2f42` | stronger borders |
| `--color-ink` | `#e6ebf5` | primary text |
| `--color-soft` | `#aab2c6` | body prose |
| `--color-dim` | `#8b93a6` | secondary text, timestamps, labels |
| `--color-faint` | `#7d859a` | hints, captions |
| `--color-accent` | `#8ab4ff` | **UI accent: links, focus, interactive, capsule tint** |
| `--color-up` | `#6ea88a` | **DATA ONLY: up / profit / positive** |
| `--color-down` | `#c2725e` | **DATA ONLY: down / loss / negative** |
| `--color-warn` | `#d9a441` | warnings, early-close |
| `--color-purp` | `#c084fc` | AI-generated content markers |
| `--color-clay` | `#b06a5e` | hazard dots, pre-market risk |

**Translucent surfaces:**
| token | value | use |
|---|---|---|
| `--color-card` | `rgba(13, 15, 22, 0.78)` | panel/card background (translucent) |
| `--color-card-hi` | `rgba(18, 20, 29, 0.88)` | active/hover card surface |
| `--color-inset` | `rgba(0, 0, 0, 0.28)` | nested wells/rows |
| `--color-sep` | `rgba(255, 255, 255, 0.06)` | hairline separators |
| `--color-sep2` | `rgba(255, 255, 255, 0.10)` | stronger separators |
| `--color-accent-dim` | `rgba(138, 180, 255, 0.12)` | capsule/accent tint bg |
| `--color-accent-glow` | `rgba(138, 180, 255, 0.22)` | accent glow |

Utilities: `bg-panel text-ink border-line text-up text-down text-dim
text-faint text-accent text-warn text-purp text-clay` etc. Opacity modifiers
are fine (`border-line/60`, `bg-up/10`).

### Type scale (mono-only — Syne is reserved for the wordmark only)

| token | value | role |
|---|---|---|
| `text-3xs` | 0.625rem (10px) | densest data: mini-calendar digits, chart axes |
| `text-2xs` | 0.6875rem (11px) | table headers, micro-labels, captions, `.label` |
| `text-xs` | 0.75rem (12px) | table cells, meta, chips |
| `text-sm` | 0.8125rem (13px) | nav, buttons, secondary body |
| `text-base` | 0.9375rem (15px) | body |
| `text-lg` | 1.125rem (18px) | section titles |
| `text-quote` | 1.125rem (18px) | quotes, blockquotes |
| `text-2xl` | 1.5rem (24px) | h2 |
| `text-3xl` | 2rem (32px) | h1 page title |
| `text-4xl` | 2.5rem (40px) | day hero |
| `text-5xl` | 3rem (48px) | homepage headline |

- **Bold is a weight, never a size or color.** `font-medium` (500),
  `font-semibold` (600), `font-bold` (700). In prose use `<strong>`.
- **One `h1` per page.** Sections are `h2`, subsections `h3`. Headings get
  weight 600 + tight leading from the base layer automatically.
- **Every number is `tabular-nums`** — money, R, stats, dates in tables and
  stat cards. Never let digits jiggle between rows.
- Leading: `leading-tight` (headings) / `leading-snug` (tables) /
  `leading-normal` (body) / `leading-relaxed` (prose only).
- Tracking: `tracking-tight` big headings, `tracking-widest` uppercase
  micro-headers (the terminal caption look).

### Material

- Radius: `--radius: 14px` (panels/cards), `--radius-sm: 10px` (buttons/inputs).
  `.panel` carries the shadow + border + blur; never hand-roll a card.
- Cards use **translucent surfaces** with `backdrop-filter: blur(18px) saturate(150%)`.
  This is the reference aesthetic — do NOT replace with solid backgrounds.
- Shadows: `--shadow-card` = `0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 8px 24px rgba(0, 0, 0, 0.18)`
- Motion: `fade-up` (translateY 8px, 0.4s ease-out), staggered 0.04s for first 5 panels.
  `prefers-reduced-motion: reduce` disables animation.

---

## Primitive utilities (CSS classes — both Astro + React use these)

These are the reference aesthetic building blocks. **Use these before inventing
new patterns.**

| utility | what it is | use for |
|---|---|---|
| `.panel` | translucent card: border + blur + radius + shadow + fade-up | any card/panel surface |
| `.capsule` | pill: `rounded-full`, accent-tint bg, hairline border, 10px font, dim color, tabular-nums | mood chips, counts, status badges |
| `.well` | inset row: `--color-inset` bg, `--color-sep` border, `--radius-sm` | nested content rows |
| `.seg` / `.seg-on` | segmented control shell + active segment | type switchers, tab bars |
| `.card-hd` | card header row: flex, 12px 14px padding, 48px min-height, sep border-bottom | section headers inside cards |
| `.card-lbl` | card label: 11px, bold, soft color, uppercase, 0.6px letter-spacing | header labels |
| `.card-sub` | card sub: 10px, faint color, 500 weight | header subtitles |
| `.label` | micro-label: `text-2xs uppercase tracking-widest text-dim` | section labels (NOT accent — dim) |
| `.th` / `.td` | table header / cell | data tables |
| `.kv` | key-value row: flex, border-bottom, py-2 | stat rows |
| `.num-up` / `.num-down` | data color: `text-up` / `text-down` | P&L, R, metrics |
| `.tag` | inline label: border, px-1.5 py-0.5, text-2xs, text-dim | model tags, categories |

---

## Primitives (components)

### Public (zero-JS) — `src/components/ui/*.astro`

| primitive | use for |
|---|---|
| `Card` | any panel/card; optional title + `actions` slot |
| `Button` | links/buttons; variants `default/primary/danger/ghost`, sizes `sm/md` |
| `Badge` | compact status chip; variants `default/up/down/warn/accent/muted/outline` |
| `Tag` | neutral inline label |
| `Table` | data tables (`head` prop + `.td` rows) |
| `StatCard` | one headline number |
| `Dot` | status dots (up/down/warn/accent/clay) |
| `Quote` | **owner-authored** quotes — terminal style |
| `Separator` | hairline divider |
| `Field` / `Input` / `Textarea` | labeled forms |
| `EmptyState` | the one "nothing here" block |
| `Icon` | Lucide inline SVG (never emoji except flags) |
| `Flag` | 🇺🇸🇧🇯🇵 session flags (emoji is correct here — Lucide has no flags) |

**Public rule:** if a primitive exists for it, use it. Never write a raw
`<button class="btn…">` in a public page — use `<Button>`. Never inline
`style={{color:…}}` when a token exists.

### Stream components — `src/components/stream/*.astro`

| component | use for |
|---|---|
| `ThoughtCard` | one published stream item (trade/thought/quote) |
| `DayFacts` | tokenized facts strip (R, mood, sleep, habits) |

**Vocabulary:** "thought" everywhere — never "note" or "moment" in display copy.
The stream type stays `note` internally; public display = "thought".

### Admin (React) — `src/components/ui/react/*.tsx`

| primitive | use for |
|---|---|
| `Button` (cva) | admin buttons; variants default/primary/danger/ghost/accent |
| `Dialog` + `DialogTrigger` + `DialogContent` + `DialogTitle` + `DialogDescription` | modals — focus trap + Esc for free; never a hand-rolled overlay |
| `Tooltip` + `TooltipTrigger` + `TooltipContent` (wrap in `TooltipProvider`) | hover hints |
| `ToastProvider` + `Toast` + `ToastViewport` | notifications — `ok={false}` for failures, `aria-live` built in |
| `Select` + `SelectTrigger` + `SelectValue` + `SelectContent` + `SelectItem` | selects with labels |
| `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | tab groups |
| `Checkbox` | boolean inputs |
| `cn` (from `src/lib/utils.ts`) | class merging — every component uses it |

Legacy `src/components/admin/ui.tsx` (`Field`, `TextInput`, `NumInput`,
`TextArea`, `Select`, `Button`, `Card`, `Stat`) is deprecated for *new* work;
reuse the Radix primitives instead. Do not delete it until the admin is fully
migrated.

---

## Content & semantics

- **Rules, quotes, and self-talk are the owner's own words.** AI never
  generates wisdom/gyaan — it may polish the owner's existing text, never
  author it. Never seed or fabricate quotes/rules in content.
- **Green = up, red = down — for DATA ONLY.** A negative P&L is
  `num-down`/`text-down`; a "failed" account stage is `text-down`. No
  exceptions. UI chrome (labels, badges, buttons) uses blue accent or dim,
  not green/red.
- **Facts are shown once.** One source of truth per datum on the public side;
  don't duplicate a value in a rail *and* a section *and* a cell.
- Empty states: one line, lowercase, ends with a period (see `EmptyState`).
- Dates display as `dd-mon-yyyy` (`fmtDay`), never ISO.
- Drafts must never render on public routes.

## Never list

- No arbitrary `text-[..px]` / `text-[..rem]` — use the scale.
- No hardcoded hex colors — use tokens.
- No raw `<button>`/modal/toast in admin when a primitive exists.
- No emoji in UI copy/icons (flags excepted — use `Flag`).
- No italic (the terminal has no italic voice).
- No `data-theme` / theme switching — summit is the only skin.
- No `client:` on public pages.
- No green/red for UI chrome — blue accent or dim only. Green/red = data (up/down).
- No "note" or "moment" in display copy — use "thought".
- No solid cards — translucent with backdrop-filter is the reference aesthetic.
- No generous spacing — 1edge is information-dense, tighter than WALogger.
