# Market Chronograph + Day-Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the market widget's 0–24 bar into a chronograph-style rail (tick markings, event severity dots, caret + live clock now-marker), make countdowns tick mm:ss under 15 minutes, give every news row an icon with elapsed events dimmed + struck for posterity, and add the 3-letter weekday day header + "the day" panel to the homepage.

**Architecture:** Server-rendered primitives (zero new JS surfaces) layered on the existing `buildStrip`/`marketMarker`/`market-news` data. The chronograph rail is static markup + the pre-existing 1s `render()` loop in MarketWidget; countdown formatting changes in the four `fmtHuman` copies (strip.ts + 3 inline scripts); NewsBlock gains optional `dayIso`/`now` props for the past-state; a new `MarketDay.astro` panel composes `marketMarker()` + `NewsBlock` on the homepage. Shared helpers (`fmtDayW`, completed `newsEmoji`, chrono `fmtHuman`) land first so later tasks consume stable signatures.

**Tech Stack:** Astro 5 (SSR `/` + static elsewhere), Tailwind CSS v4 `@theme` tokens, zero-JS public pages (single Lightbox script exception), existing `src/lib/{dates,market-news,strip,sessions,market}.ts`.

## Global Constraints

- **Public pages stay zero-JS** except the single Lightbox `<dialog>` script. The chronograph rail is server-rendered; only the pre-existing 1s `render()` loops in MarketWidget/MarketLive/MarketFooter may tick it. No new JS surfaces.
- **Design system:** use `@theme` tokens from `src/styles/app.css` + `ui/*` primitives. No arbitrary values (`text-[13px]`, hex literals) in NEW code. Tokens: `--color-up/down/warn/accent/line/line2/faint/dim/soft/ink/bg/panel/clay`.
- **Day header format is exactly `mon | 07-aug-2026`** (3-letter weekday, pipe separator, no comma) — owner-approved. URL slugs keep `fmtDay` (`07-aug-2026`) — slugs never change.
- **CME Globex is the master clock.** Day status comes from `cmeDay()`/`marketMarker()` (`src/lib/market.ts`). Never present NYSE as "market open".
- **News stays zero-inference:** verbatim rows, `[TV]`/`[FF]` badges, `✦` verified. This work only adds icon coverage + a visual past-state — never merges or re-levels rows.
- **Money colors by sign**; severity dot = `bg-down` (red) / `bg-warn` (orange).
- **Repo has no unit-test runner.** Per-task verification = `npm run typecheck` (controller runs centrally between waves — do NOT run it while another task is building; astro races on `node_modules/.astro`) + targeted read-back. Controller builds once per wave and deploys + verifies live at the end.
- **Commit only your own files** (`git add <exact paths>`, never `git add -A` — the autosave cron may have uncommitted `src/content/market-news/*.md` edits; never stage `.env`).
- **No two agents build at once.** Implementation waves are write-disjoint; controller runs typecheck/build centrally between waves.

---

### Task 1: Shared helpers — `fmtDayW`, completed `newsEmoji`, chrono `fmtHuman`

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/market-news.ts`
- Modify: `src/lib/strip.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact signatures later tasks rely on):
  - `fmtDayW(iso: string): string` → `mon | 07-aug-2026`
  - `newsEmoji(title: string): string` → never returns `''` (completed rules + generic fallback)
  - `fmtHuman(sec: number): string` → `m:ss` when `sec < 900` (chronograph), existing forms otherwise

- [ ] **Step 1: `src/lib/dates.ts` — add `fmtDayW`**

Add after `fmtDay`:

```ts
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** '2028-08-03' → 'fri | 03-aug-2028' — 3-letter weekday + pipe, display only. */
export function fmtDayW(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${wd} | ${fmtDay(iso)}`
}
```

- [ ] **Step 2: `src/lib/market-news.ts` — complete `EMOJI_RULES` + fallback**

In the `EMOJI_RULES` array:
- Extend the income/spending rule to cover earnings: change `/income|spending|savings/i` to `/income|spending|savings|earnings/i`
- Add a labor-force rule before the fallback: `[/participation rate/i, '👥'],`

Add a module-level fallback constant and use it in `newsEmoji` (it currently returns `''` when no rule matches):

```ts
const EMOJI_FALLBACK = '📰'
```

```ts
export function newsEmoji(title: string): string {
  for (const [re, emoji] of EMOJI_RULES) {
    if (re.test(title)) return emoji
  }
  return EMOJI_FALLBACK
}
```

- [ ] **Step 3: `src/lib/strip.ts` — chrono `fmtHuman`**

Replace the whole `fmtHuman` (lines 47-57): countdowns under 15 minutes render `m:ss` (zero-padded), ≥ 15m keep the current forms:

```ts
/** Conversational duration: "3h 12m" · "12m" · "1d 3h" · "04:32" (< 15 min, chronograph). */
export function fmtHuman(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m >= 15) return `${m}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 4: Read-back verify (no typecheck — controller runs it)**

```bash
grep -n "fmtDayW" src/lib/dates.ts
grep -n "EMOJI_FALLBACK\|participation rate\|earnings" src/lib/market-news.ts
grep -n "String(m).padStart" src/lib/strip.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/market-news.ts src/lib/strip.ts
git commit -m "feat: day-weekday display helper, complete news icons with fallback, chrono mm:ss countdowns"
```

---

### Task 2: NewsBlock — icon on every row + past-state (posterity)

**Files:**
- Modify: `src/components/NewsBlock.astro`
- Modify: `src/components/MarketWidget.astro` (pass props in the "USD news · all today" details)
- Modify: `src/components/MarketFooter.astro` (pass props to its `NewsBlock`)
- Modify: `src/components/archive/DayArchive.astro` (pass props)
- Modify: `src/pages/calendar.astro` (pass props per day)

**Interfaces:**
- Consumes: `newsEmoji` (Task 1 — never `''`); `NewsItem` from `src/lib/market-news`.
- Produces: `NewsBlock` accepts optional `dayIso?: string` and `now?: number` — when both are present, rows whose HKT datetime is before `now` render dimmed + struck through (kept in place, time-ordered). When absent, rendering is unchanged (backward compatible).

- [ ] **Step 1: `src/components/NewsBlock.astro` — past-state**

Read the current file first (29 lines — matches the structure below; match on code, not line numbers). Extend the props + add `isPast`, then apply the past classes:

```astro
---
import type { NewsItem } from '../lib/market-news'
import { newsEmoji } from '../lib/market-news'

interface Props {
  red: NewsItem[]
  orange: NewsItem[]
  /** Show an emoji hint per title (default true). */
  emoji?: boolean
  /** Day ISO + now (ms) — events before `now` render dimmed + struck (posterity). */
  dayIso?: string
  now?: number
}

const { red, orange, emoji = true, dayIso, now } = Astro.props

const isPast = (time: string): boolean => {
  if (!dayIso || now == null) return false
  const [h, m] = time.split(':').map(Number)
  return Date.parse(`${dayIso}T00:00:00+08:00`) + (h * 60 + m) * 60000 < now
}
---

{
  [...red.map((r) => ({ ...r, kind: 'red' as const })), ...orange.map((o) => ({ ...o, kind: 'orange' as const }))].map((n) => {
    const past = isPast(n.time)
    return (
      <div class="flex items-baseline gap-3">
        <span
          class:list={['inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full', n.kind === 'red' ? 'bg-down' : 'bg-warn', past && 'opacity-40']}
          title={n.kind}
        />
        <span class:list={['w-20 shrink-0 text-right text-[12px] tabular-nums', past ? 'text-faint' : n.kind === 'red' ? 'text-down' : 'text-warn opacity-70']}>
          {emoji && newsEmoji(n.title)} {n.time}
        </span>
        <span class="min-w-0 flex-1 text-[13px] leading-snug">
          <span class:list={[past ? 'text-faint line-through decoration-line/60' : n.kind === 'red' ? 'text-down' : 'text-warn']}>{n.title}</span>
          {n.source && <span class="ml-1.5 text-[10px] text-faint">[{n.source}]</span>}
          {n.verified && <span class="ml-1 text-[11px] text-accent">✦</span>}
        </span>
      </div>
    )
  })
}
```

- [ ] **Step 2: Update the four consumers to pass `dayIso`/`now`**

- `src/components/MarketWidget.astro` — in the `showNews` details block (`<NewsBlock red={red} orange={orange} .../>`): add `dayIso={today} now={Date.now()}`.
- `src/components/MarketFooter.astro` — its `<NewsBlock red={red} orange={orange} />` call: add `dayIso` (the footer's today iso — match the variable the footer already computes) and `now={Date.now()}`.
- `src/components/archive/DayArchive.astro` — its `<NewsBlock .../>` call: add `dayIso={iso}` (the archive's own day prop) and `now={Date.now()}`.
- `src/pages/calendar.astro` — its `<NewsBlock .../>` call: add the per-day iso and `now={Date.now()}` (match on code — the calendar iterates news per day).

Read each consumer first; match on code, not line numbers. Do not change any other behavior in those files.

- [ ] **Step 3: Read-back verify**

```bash
grep -n "dayIso\|now=" src/components/NewsBlock.astro src/components/MarketWidget.astro src/components/MarketFooter.astro src/components/archive/DayArchive.astro src/pages/calendar.astro
grep -n "line-through" src/components/NewsBlock.astro
```

- [ ] **Step 4: Commit**

```bash
git add src/components/NewsBlock.astro src/components/MarketWidget.astro src/components/MarketFooter.astro src/components/archive/DayArchive.astro src/pages/calendar.astro
git commit -m "feat(news): every row carries an icon (fallback) and elapsed events stay dimmed + struck for posterity"
```

---

### Task 3: MarketWidget — the chronograph rail

**Files:**
- Modify: `src/components/MarketWidget.astro` (the 0–24 bar at lines ~62-81, the inline `fmtHuman`, the `render()` loop's now-marker block, the header date)
- Modify: `src/styles/app.css` (remove `.now-dot` styles)

**Interfaces:**
- Consumes: `fmtDayW` + `fmtHuman` (Task 1); NewsBlock `dayIso`/`now` props (Task 2).
- Produces: the chronograph rail — 25 server-rendered ticks (hour marks on the line, major every 6h with `00/06/12/18/24` labels), event severity dots at their HKT times, and a caret + live `HH:MM:SS hkt` clock now-marker (NO green dot). Inline `fmtHuman` renders `m:ss` under 15 min. Header date uses `fmtDayW`.

- [ ] **Step 1: Frontmatter — `evDots` + `fmtDayW`**

Read the current `MarketWidget.astro` frontmatter (247 lines). Add `fmtDayW` to the `../lib/dates` import. Replace the local `MON`/`prettyDate` block with the shared helper:

```ts
const prettyDate = fmtDayW(today)
```

Add after `nowFracBuild`:

```ts
const evDots = [
  ...red.map((n) => ({ ...n, kind: 'red' as const })),
  ...orange.map((n) => ({ ...n, kind: 'orange' as const })),
].map((n) => {
  const [h, m] = n.time.split(':').map(Number)
  return {
    at: Date.parse(`${today}T00:00:00+08:00`) + (h * 60 + m) * 60000,
    kind: n.kind,
    pct: ((h + m / 60) / 24) * 100,
    title: n.title,
  }
})
```

- [ ] **Step 2: Replace the 0–24 bar with the chronograph rail**

Replace the `<div class="mt-3">` block containing the `h-px bg-line` hairline + `.now-dot` + the 13-label row (current lines 62-81) with:

```astro
  <div class="mt-3" data-rail>
    <div class="relative h-5">
      {/* event severity dots on the rail */}
      {evDots.map((d) => (
        <span
          data-ev-at={d.at}
          class:list={['absolute top-1 z-[5] h-1.5 w-1.5 -translate-x-1/2 rounded-full', d.kind === 'red' ? 'bg-down' : 'bg-warn']}
          style={`left:${d.pct}%`}
          title={d.title}
        ></span>
      ))}

      {/* now-marker: live clock + hairline + caret — no green dot */}
      <div class="absolute top-0 z-10 -translate-x-1/2" data-now-marker style={`left:${nowFracBuild}%`} title="now (HKT)">
        <div class="flex -translate-y-full flex-col items-center">
          <span data-now-clock class="mb-1 whitespace-nowrap rounded-sm border border-accent/40 bg-bg px-1 text-2xs tabular-nums text-accent">--:--:--</span>
          <span class="h-2 w-px bg-accent"></span>
        </div>
        <span class="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-4 border-t-[6px] border-x-transparent border-t-accent"></span>
      </div>

      {/* the rail: hour tick markings on the line */}
      <div class="absolute bottom-0 left-0 right-0 flex items-end">
        {Array.from({ length: 25 }, (_, i) => {
          const major = i % 6 === 0
          return (
            <div class="flex flex-1 flex-col items-center">
              <span
                class:list={[
                  'w-px',
                  major ? 'h-3 bg-line2' : 'h-1.5 bg-line',
                  !major && i % 2 !== 0 ? 'hidden lg:block' : !major && i % 2 === 0 ? 'hidden sm:block' : '',
                ]}
              ></span>
              {major && <span class="mt-0.5 text-2xs tabular-nums text-faint">{String(i).padStart(2, '0')}</span>}
            </div>
          )
        })}
      </div>
    </div>
  </div>
```

Responsive contract: every-hour ticks on lg+; every-2h on sm-lg; major (6h) ticks only below sm. Major ticks + their `00/06/12/18/24` labels always visible.

- [ ] **Step 3: Inline `fmtHuman` → chrono mm:ss**

In the inline `<script>` (current line ~152), replace the `fmtHuman` body so `m >= 15` keeps `m + 'm'` and anything under renders zero-padded `m:ss` (same rule as Task 1):

```js
    const fmtHuman = (sec) => {
      sec = Math.max(0, Math.round(sec))
      const d = Math.floor(sec / 86400)
      const h = Math.floor((sec % 86400) / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const s = Math.floor(sec % 60)
      if (d > 0) return h > 0 ? d + 'd ' + h + 'h' : d + 'd'
      if (h > 0) return m > 0 ? h + 'h ' + m + 'm' : h + 'h'
      if (m >= 15) return m + 'm'
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    }
```

- [ ] **Step 4: `render()` loop — clock + now-marker + dot states**

Replace the current `nowMarker` block (current lines ~236-241: computes `hk` from `getUTCHours()+8` and sets `nowMarker.style.left`) with the new positioning + clock + dot states (uses the existing `p` pad helper):

```js
      const hk = new Date(Date.now() + 8 * 3600 * 1000)
      if (nowMarker) {
        nowMarker.style.left = ((hk.getUTCHours() + hk.getUTCMinutes() / 60) / 24) * 100 + '%'
      }
      const clockEl = document.querySelector('[data-now-clock]')
      if (clockEl) {
        clockEl.textContent = p(hk.getUTCHours()) + ':' + p(hk.getUTCMinutes()) + ':' + p(hk.getUTCSeconds())
      }
      for (const dot of document.querySelectorAll('[data-ev-at]')) {
        const at = Number(dot.getAttribute('data-ev-at'))
        if (at <= now) {
          dot.classList.add('opacity-40')
          dot.classList.remove('animate-pulse')
        } else {
          dot.classList.remove('opacity-40')
          if (at - now < 15 * 60 * 1000) dot.classList.add('animate-pulse')
          else dot.classList.remove('animate-pulse')
        }
      }
```

(Keep the existing `const now = Date.now()` at the top of `render()`.)

- [ ] **Step 5: `src/styles/app.css` — remove `.now-dot`**

Delete the `.now-dot` rule (line ~323) and the responsive `.now-dot` rule (line ~354). Do not touch anything else.

- [ ] **Step 6: Read-back verify**

```bash
grep -n "now-dot" src/components/MarketWidget.astro src/styles/app.css || echo "now-dot gone ✓"
grep -n "data-now-clock\|data-ev-at\|fmtDayW" src/components/MarketWidget.astro
grep -n "padStart(2, '0')" src/components/MarketWidget.astro
```

- [ ] **Step 7: Commit**

```bash
git add src/components/MarketWidget.astro src/styles/app.css
git commit -m "feat(widget): chronograph rail — hour tick markings, event dots, caret + live clock now-marker, mm:ss countdowns"
```

---

### Task 4: MarketLive + MarketFooter — chrono mm:ss countdowns

**Files:**
- Modify: `src/components/MarketLive.astro` (inline `fmtHuman`)
- Modify: `src/components/MarketFooter.astro` (inline `fmtHuman`)

**Interfaces:**
- Consumes: nothing new (the `fmtHuman` rule from Task 1).
- Produces: every ticking countdown on these surfaces renders `m:ss` under 15 minutes, consistent with the widget.

- [ ] **Step 1: `src/components/MarketLive.astro` — inline `fmtHuman`**

In the inline `<script>` (current line ~23), apply the same chrono rule (copy the `fmtHuman` body from Task 3 Step 3 — `m >= 15 ? m + 'm' : padded m:ss`).

- [ ] **Step 2: `src/components/MarketFooter.astro` — inline `fmtHuman`**

In its inline `<script>` (current line ~103), apply the same chrono rule.

- [ ] **Step 3: Read-back verify**

```bash
grep -n "padStart" src/components/MarketLive.astro src/components/MarketFooter.astro
```

- [ ] **Step 4: Commit**

```bash
git add src/components/MarketLive.astro src/components/MarketFooter.astro
git commit -m "feat: mm:ss countdowns under 15 min on the live ticker + footer"
```

---

### Task 5: Homepage — day header `fmtDayW` + "the day" panel

**Files:**
- Create: `src/components/MarketDay.astro`
- Modify: `src/pages/index.astro` (day header + include the panel)
- Modify: `src/components/MarketWidget.astro` (header date → `fmtDayW` — if not already done in Task 3)

**Interfaces:**
- Consumes: `fmtDayW` (Task 1), NewsBlock past-state props (Task 2), `marketMarker`/`cmeDay` from `src/lib/market.ts`, `todayHkt` from `src/lib/sessions`.
- Produces: `MarketDay.astro` — the day panel: header `the day · {fmtDayW(today)}`, CME day-type line (`● open · full day` / `◐ early close 1:15pm ct` / `✕ closed · {label}`), and that day's red/orange events (NewsBlock with `dayIso`/`now`), with an empty state.

- [ ] **Step 1: Create `src/components/MarketDay.astro`**

```astro
---
import { getCollection } from 'astro:content'
import { todayHkt } from '../lib/sessions'
import { fmtDayW } from '../lib/dates'
import { marketMarker } from '../lib/market'
import NewsBlock from './NewsBlock.astro'

const today = todayHkt()
const mk = marketMarker(today)
const news = await getCollection('market-news')
const day = news.find((n) => n.data.date === today)
const red = day?.data.red ?? []
const orange = day?.data.orange ?? []
---

<section class="panel p-4">
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <span class="text-[13px] text-ink">the day <span class="text-faint">· {fmtDayW(today)}</span></span>
    <span class:list={['text-[12px] tabular-nums', mk.status === 'open' ? 'text-up' : mk.status === 'early' ? 'text-warn' : 'text-down']}>
      {mk.glyph} {mk.text}{mk.status === 'open' ? ' · full day' : ''}
    </span>
  </div>
  {(red.length > 0 || orange.length > 0) ? (
    <div class="mt-3 flex flex-col gap-1 border-t border-line/60 pt-2">
      <NewsBlock red={red} orange={orange} dayIso={today} now={Date.now()} />
    </div>
  ) : (
    <p class="mt-3 border-t border-line/60 pt-2 text-[12px] text-faint">no USD red/orange events today.</p>
  )}
</section>
```

- [ ] **Step 2: `src/pages/index.astro` — day header + panel**

- Change the `/ today` header line to: `<h2 class="text-lg text-ink">/ today <span class="text-faint">· {fmtDayW(iso)}</span></h2>` (import `fmtDayW` from `../lib/dates`).
- Below the `<MarketWidget />` section, add: `<section class="shell pb-6"><MarketDay /></section>` (import `MarketDay` from `../components/MarketDay.astro`).

- [ ] **Step 3: `src/components/MarketWidget.astro` — header date**

If Task 3 did not already switch the header date, change the header to use `{prettyDate}` where `prettyDate = fmtDayW(today)` (it should already be `fmtDayW` after Task 3 — verify; if the local `MON`/`prettyDate` block still exists, remove it and use `fmtDayW`).

- [ ] **Step 4: Read-back verify**

```bash
grep -n "fmtDayW" src/pages/index.astro src/components/MarketWidget.astro src/components/MarketDay.astro
grep -n "the day\|MarketDay" src/pages/index.astro
grep -n "full day" src/components/MarketDay.astro
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MarketDay.astro src/pages/index.astro src/components/MarketWidget.astro
git commit -m "feat(home): 3-letter weekday day header + 'the day' panel (CME day-type + red/orange events)"
```

---

### Task 6: Lightbox hardening, DayArchive lightbox links, display day headers, docs

**Files:**
- Modify: `src/components/Lightbox.astro` (two null guards — deferred moment-images findings)
- Modify: `src/components/archive/DayArchive.astro` (trade screenshot anchors join the lightbox; day header uses `fmtDayW` where it shows a full date)
- Modify: `src/pages/stream.astro` ("today so far" header → `fmtDayW`)
- Modify: `CHANGELOG.md`, `AGENTS.md`, `MEMORY.md`

**Interfaces:**
- Consumes: `fmtDayW` (Task 1); the existing lightbox (`data-lb` groups, `id="lb"`).
- Produces: lightbox script hardened; DayArchive trade screenshots open in the lightbox (same chart, same behavior as MomentCard); day-facing headers carry the weekday; docs describe the shipped feature.

- [ ] **Step 1: `src/components/Lightbox.astro` — null guards**

In the inline script:
- After `const body = dlg.querySelector('.lb-body')` add `if (!body) return` (before `const links = ...`).
- At the top of the `document.addEventListener('click', ...)` handler add `if (!(e.target instanceof Element)) return`.

Do not change anything else in the file.

- [ ] **Step 2: `src/components/archive/DayArchive.astro` — trade screenshots join the lightbox + day header**

Read the file first (234 lines). The trade screenshot anchors (around lines 126-137, `<a href={s} target="_blank" ...>` wrapping `<img src={s} alt={altFor(s)} .../>`) currently lack `data-lb` — add `data-lb={`day-${iso}-${i}`}` to each anchor (group per trade panel) so they open in the shared lightbox; keep `target="_blank" rel="noopener"` (progressive enhancement).

Wherever the day header displays a full date via `fmtDay`, switch the DISPLAY text to `fmtDayW` (import it; keep `fmtDay` for any URL slug). Match on code — only display headers, never slugs.

- [ ] **Step 3: `src/pages/stream.astro` — "today so far" header**

Change line ~52 `today so far · {fmtDay(iso)}` to `today so far · {fmtDayW(iso)}` (import `fmtDayW`). Keep the `day →` link using `fmtDay` (slug).

- [ ] **Step 4: Docs**

- `CHANGELOG.md` — add an `Unreleased` entry: chronograph rail (hour ticks, event dots, caret + live-clock now-marker), mm:ss countdowns under 15 min, every news row iconed + elapsed events dimmed/struck (posterity), `mon | 07-aug-2026` day headers, homepage "the day" panel, lightbox hardening.
- `AGENTS.md` — Layout/conventions: note the chronograph rail + `MarketDay.astro` + `fmtDayW`; news rows keep icons + past-state.
- `MEMORY.md` — session-log entry for this feature (commits + what shipped). Keep it factual and short.

- [ ] **Step 5: Read-back verify**

```bash
grep -n "instanceof Element\|if (!body) return" src/components/Lightbox.astro
grep -n "data-lb=\`day-" src/components/archive/DayArchive.astro
grep -n "fmtDayW" src/pages/stream.astro src/components/archive/DayArchive.astro
git status --short   # only your files; ignore market-news cron edits
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Lightbox.astro src/components/archive/DayArchive.astro src/pages/stream.astro CHANGELOG.md AGENTS.md MEMORY.md
git commit -m "fix(public): lightbox guards, archive trade shots in lightbox, weekday day headers, docs"
```

---

## Self-review notes

- **Spec coverage:** §1 rail → Task 3. §2 mm:ss → Tasks 1 (strip.ts) + 3 + 4 (inline copies). §3 news icons + past-state → Tasks 1 (emoji coverage) + 2. §4 day header + "the day" panel → Tasks 1 (fmtDayW) + 5 + 6 (stream/day headers). §5 lightbox hardening + DayArchive data-lb → Task 6. Global constraints enforced in every task.
- **Dependency order:** Task 1 (helpers) before all. Task 2 (NewsBlock props) before Tasks 3/4/5 (consumers). Tasks 3+4 parallel (write-disjoint: MarketWidget / MarketLive+MarketFooter). Tasks 5+6 parallel (write-disjoint: index+MarketDay / Lightbox+DayArchive+stream+docs). Controller final gate + deploy + verify live after all land.
- **Type consistency:** `fmtDayW(iso): string` (Task 1) used in Tasks 3/5/6. `newsEmoji(): string` never `''` (Task 1) → NewsBlock (Task 2). `fmtHuman` rule identical in strip.ts + 3 inline copies (Tasks 1/3/4) — all render `m:ss` when `m < 15`. NewsBlock `dayIso?: string` + `now?: number` (Task 2) passed by all four consumers + MarketDay (Task 5). `data-now-clock`/`data-ev-at` (Task 3) only referenced within MarketWidget's own script.
- **Zero-JS:** the only runtime JS touched is the pre-existing 1s loops (MarketWidget/MarketLive/MarketFooter); no new JS surfaces. The rail, dots, and past-state are server-rendered; JS only moves the marker/clock and toggles dot classes.
- **Plan-mandated risks to flag for reviewers:** (a) NewsBlock past-state on STATIC day pages freezes `now` at build time — a past-day archive renders fully dimmed (correct); today's static page lags until rebuild (documented limitation, homepage is SSR and always fresh). (b) The chronograph rail's `animate-pulse` + `opacity-40` dot classes are runtime toggles in the widget's pre-existing loop. (c) `fmtDayW` uses `Date.UTC` weekday — verify against a known date (2026-08-07 is a Friday → `fri | 07-aug-2026`).
