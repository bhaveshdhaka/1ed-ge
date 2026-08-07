# 1ed.ge Design System

The single source of truth for how 1ed.ge is built visually. **Read this before
touching any UI.** The design language is a shadcn/ui-style convention layer on
Tailwind CSS v4 (CSS-first `@theme` tokens) with a bespoke summit/terminal
aesthetic: mono-only type, off-black background, green = up, red = down.

Two hard rules govern everything:

1. **Public pages ship zero JS.** Every public surface is server-rendered HTML.
   No `client:` directives, no React, no inline handlers on public routes.
2. **React lives only inside `/admin`.** The admin is the sole React island
   (`client:only="react"`). Admin UI uses the React primitives in
   `src/components/ui/react/` — never hand-roll a modal, toast, tooltip, or
   select.

---

## Tokens (`src/styles/app.css` @theme)

**Never use arbitrary values.** `text-[13px]`, `#c07a6d`, `leading-[1.6]` are
forbidden in new code. Use the tokens:

### Color (summit palette — the only skin)
| token | value | use |
|---|---|---|
| `--color-bg` | `#07080c` | page background |
| `--color-panel` | `#0d0f16` | cards, panels |
| `--color-raise` | `#12141d` | hover, raised surfaces |
| `--color-line` | `#1c2030` | borders, dividers |
| `--color-line2` | `#2a2f42` | stronger borders |
| `--color-ink` | `#e6ebf5` | primary text |
| `--color-soft` | `#aab2c6` | body prose |
| `--color-dim` | `#8b93a6` | secondary text |
| `--color-faint` | `#7d859a` | hints, captions |
| `--color-accent` | `#8ab4ff` | links, focus, brand accent |
| `--color-up` | `#6ea88a` | **green = up / profit / positive** |
| `--color-down` | `#c2725e` | **red = down / loss / negative** |
| `--color-warn` | `#d9a441` | warnings, early-close |
| `--color-purp` | `#c4b5fd` | quotes, distinct data |
| `--color-clay` | `#b06a5e` | hazard dots, pre-market risk |

Utilities: `bg-panel text-ink border-line text-up text-down text-dim
text-faint text-accent text-warn text-purp text-clay` etc. Opacity modifiers
are fine (`border-line/60`, `bg-up/10`).

### Type scale (mono-only — Syne is reserved for the wordmark only)
| token | value | role |
|---|---|---|
| `text-3xs` | 0.625rem | densest data: mini-calendar digits, chart axes |
| `text-2xs` | 0.6875rem | table headers, micro-labels, captions |
| `text-xs` | 0.75rem | table cells, meta, chips |
| `text-sm` | 0.8125rem | nav, buttons, secondary body |
| `text-base` | 0.9375rem | body |
| `text-lg` | 1.125rem | section titles |
| `text-quote` | 1.125rem | quotes, blockquotes (border-left, soft) |
| `text-2xl` | 1.5rem | h2 |
| `text-3xl` | 2rem | h1 page title |
| `text-4xl` | 2.5rem | day hero |
| `text-5xl` | 3rem | homepage headline |

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
- Radius: `rounded` = 2px (panels), `rounded-sm` = 1px (buttons/inputs).
  `.panel` carries the shadow + border; never hand-roll a card.

---

## Primitives

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
| `Flag` | 🇺🇸🇬🇧🇯🇵📈 session flags (emoji is correct here — Lucide has no flags) |

**Public rule:** if a primitive exists for it, use it. Never write a raw
`<button class="btn…">` in a public page — use `<Button>`. Never inline
`style={{color:…}}` when a token exists.

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
  generates wisdom/gyan — it may polish the owner's existing text, never
  author it. Never seed or fabricate quotes/rules in content.
- **Green = up, red = down — including money, everywhere.** A negative P&L is
  `num-down`/`text-down`; a "failed" account stage is `text-down`. No
  exceptions.
- **Facts are shown once.** One source of truth per datum on the public side;
  don't duplicate a value in a rail *and* a section *and* a cell.
- Empty states: one line, lowercase, ends with a period (see `EmptyState`).
- Dates display as `dd-mon-yyyy` (`fmtDay`), never ISO.
- Cockpit (admin) content is production; the public stream shows only approved
  moments. Drafts must never render on public routes.

## Never list
- No arbitrary `text-[..px]` / `text-[..rem]` — use the scale.
- No hardcoded hex colors — use tokens.
- No raw `<button>`/modal/toast in admin when a primitive exists.
- No emoji in UI copy/icons (flags excepted — use `Flag`).
- No italic (the terminal has no italic voice).
- No `data-theme` / theme switching — summit is the only skin.
- No `client:` on public pages.
