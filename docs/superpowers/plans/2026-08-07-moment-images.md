# Moment Images — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse stream moments to `trade | note | quote` (no standalone media, no session labels), keep screenshots on trades, add per-moment images for note/quote, make the capture zone ephemeral (AI reads, images never saved), generate cheap-model SEO alt text on upload into a sidecar file, and add a native-`<dialog>` lightbox — the single zero-JS exception.

**Architecture:** Four coordinated changes. (1) **Wipe** the test data (days/journal/accounts/payouts/coach + media uploads) so the schema collapse is a clean slate — no migration needed. (2) **Schema + stream lib**: `MomentType` → `trade|note|quote`, `moment.images[]` replaces `moment.media`, `DayTrade.screenshots` stays, `resolveMoments` threads images + trade screenshots through, `momentMeta` 3 glyphs. (3) **Alt-text pipeline**: new `src/lib/media-alt.ts` (sidecar `public/media/alts.json` + `altFor()`), `captionAlt()` on a cheap vision model (`qwen/qwen-2.5-vl-7b-instruct` via new `modelAlt` env), wired into the media upload/delete API. (4) **Admin + public surfaces**: DayWorkspace capture stops uploading (ephemeral) and the composer gets 3 types with per-moment drop zones; MomentCard renders thumbnails (trade screenshots / note-quote images) with alt text + a shared `<dialog>` lightbox in Base; `/stream` filter shrinks to 3; day-archive screen-time screenshot grid removed.

**Tech Stack:** Astro 5, React 19 admin, existing sharp/webp media pipeline, existing `unified` stack (unused here), native HTML `<dialog>`, `zod` content schemas.

## Global Constraints

- **Public pages zero-JS** — except the ONE lightbox `<dialog>` script in Base. No React, no other JS on public routes.
- **Images always attach to an artefact** (trade / note / quote). No standalone image posts — `media` moments are deleted from the schema.
- **Trades own their screenshots.** `trades[].screenshots[]` stays; screenshots render wherever the trade shows (day-archive trade panel AND any published trade moment). You can add charts to a trade at any time, even later.
- **Capture is ephemeral:** the capture zone reads text + screenshots with the AI and NEVER uploads them. Truly gone. Screen-time values are still filled from screenshots; no public screen-time screenshots.
- **Cheap model only for alt text** — `qwen/qwen-2.5-vl-7b-instruct` (new `AI_MODEL_ALT` env), never the expensive vision model.
- **Money colors:** up = `text-up`/`num-up`, down = `text-down`/`num-down` by sign.
- **Day record is the spine; R computed via `ROf`/`riskOf`** — no re-implementation.
- **Repo has no unit-test runner.** Per-task verification = `npm run typecheck` (controller runs centrally — do not run it if a parallel task is building; astro races on `node_modules/.astro`) + targeted read-back; controller builds once per wave; final task deploys + verifies live.
- **Commit only your own files** (`git add <exact paths>`, never `git add -A` — the autosave cron may have uncommitted market-news edits in the tree).
- **No two agents build at once.** Implementation waves are write-disjoint; controller runs typecheck/build centrally between waves.

---

### Task 1: Wipe the test data

**Files:**
- Delete: `src/content/days/*` (730), `src/content/journal/*` (161), `src/content/accounts/*` (6), `src/content/payouts/*` (5), `src/content/coach/*` (24), `public/media/*` uploads (2 files)
- Keep: `src/content/{habits,models,rules,quotes,market-news,brief}`, `scripts/seed-review.mjs` (never run against the live tree)

**Interfaces:**
- Consumes: nothing.
- Produces: empty content collections — every page must still build and render empty states (they do: `dayFacts(null)` → `[]`, `flattenStream([])` → `[]`, `getStaticPaths` → `[]`, trade panels → "no trades logged", etc.).

- [ ] **Step 1: Remove the generated content dirs**

```bash
cd /root/1ed.ge
git rm -r src/content/days src/content/journal src/content/accounts src/content/payouts src/content/coach
```

- [ ] **Step 2: Remove media uploads**

```bash
git rm -r public/media 2>/dev/null || true
mkdir -p public/media
# the dir must exist for the admin upload API (fs.mkdirSync recursive on write handles it, but keep an empty tracked dir)
touch public/media/.gitkeep && git add public/media/.gitkeep
```

- [ ] **Step 3: Verify the tree builds empty (controller runs build centrally)**

The controller runs `npm run typecheck` + `npm run build` after this task. Expected: build succeeds; `/` renders with empty states; `/stream` shows "0 published moments" and "no moments yet"; no day pages generated. The `getCollection('days')` etc. return `[]` — all consumers already guard `?? []`/`?? null`.

- [ ] **Step 4: Commit**

```bash
git add -u src/content public/media
git add public/media/.gitkeep
git commit -m "chore(content): wipe test data — days/journal/accounts/payouts/coach + media uploads"
```

---

### Task 2: Moment collapse — schema, stream lib, stream page, admin API, seed script, MomentCard minimal

**Files:**
- Modify: `src/content.config.ts:58-67` (momentType + moment schema)
- Modify: `src/lib/stream.ts` (MomentType, StreamMoment, DayTrade, ResolvedMoment, resolveMoments, momentMeta)
- Modify: `src/pages/stream.astro:17-18,37` (TYPES + description)
- Modify: `src/pages/api/admin/days.ts` (MOMENT_TYPES + normalizeMoment)
- Modify: `scripts/seed-review.mjs` (pre-market → note)
- Modify: `src/components/stream/MomentCard.astro` (minimal: remove media/pre-market/post-market handling; thumbnails come in Task 5)

**Interfaces:**
- Consumes: nothing new (existing `stream.ts` consumers).
- Produces:
  - `MomentType = 'trade' | 'note' | 'quote'`
  - `StreamMoment { at; type; text?; tradeIdx?; images?: string[]; author? }` — `media` field REMOVED, `images` ADDED.
  - `DayTrade.screenshots?: string[]` (kept, already present in the schema).
  - `ResolvedMoment { iso; at; type; text?; images?; author?; trade: { …existing…; screenshots?: string[] } | null }`.
  - `resolveMoments(d)` returns the new shape; old-type stragglers map to `note`.
  - `momentMeta(type)` returns `{ glyph: '▲', label: 'trade' } | { glyph: '·', label: 'note' } | { glyph: '"', label: 'quote' }`.

- [ ] **Step 1: `src/content.config.ts` — shrink the moment schema**

Replace lines 58-67:

```ts
const momentType = z.enum(['trade', 'note', 'quote'])

const moment = z.object({
  at: z.string(),
  type: momentType,
  text: z.string().optional(),
  tradeIdx: z.number().int().nonnegative().optional(),
  images: z.array(z.string()).default([]),
  author: z.string().optional(),
})
```

(`device.screenshots` and `trade.screenshots` schema fields stay unchanged.)

- [ ] **Step 2: `src/lib/stream.ts` — types + resolution**

Replace lines 1-10:

```ts
export type MomentType = 'trade' | 'note' | 'quote'

export interface StreamMoment {
  at: string
  type: MomentType
  text?: string
  tradeIdx?: number
  images?: string[]
  author?: string
}
```

Add `screenshots?: string[]` to `DayTrade` (after `commentary?`, line 25).

Replace `ResolvedMoment` (lines 45-65) — add `images?: string[]` and `screenshots?: string[]` on the trade:

```ts
export interface ResolvedMoment {
  iso: string
  at: string
  type: MomentType
  text?: string
  images?: string[]
  author?: string
  trade: {
    R: number
    direction: 'long' | 'short'
    market: string
    model?: string
    setup?: string
    session?: string
    points: number
    entry: number
    exit: number
    stop?: number
    note?: string
    screenshots?: string[]
  } | null
}
```

Replace `resolveMoments` (lines 77-105) — map old types defensively, thread images + trade screenshots:

```ts
export function resolveMoments(d: DayData): ResolvedMoment[] {
  const sorted = [...(d.stream ?? [])].sort((a, b) => a.at.localeCompare(b.at))
  return sorted.map((m) => {
    const type: MomentType = m.type === 'quote' ? 'quote' : m.type === 'trade' ? 'trade' : 'note'
    const t = m.tradeIdx !== undefined ? d.trades[m.tradeIdx] : undefined
    return {
      iso: d.date,
      at: m.at,
      type,
      text: m.text,
      images: m.images,
      author: m.author,
      trade: t && type === 'trade'
        ? {
            R: ROf(t),
            direction: t.direction,
            market: t.market,
            model: t.model,
            setup: t.setup,
            session: t.session,
            points: t.points,
            entry: t.entry,
            exit: t.exit,
            stop: t.stop,
            note: t.note,
            screenshots: t.screenshots,
          }
        : null,
    }
  })
}
```

Replace `momentMeta` (lines 120-135):

```ts
export function momentMeta(type: MomentType): MomentMeta {
  switch (type) {
    case 'trade':
      return { glyph: '▲', label: 'trade' }
    case 'note':
      return { glyph: '·', label: 'note' }
    case 'quote':
      return { glyph: '"', label: 'quote' }
  }
}
```

- [ ] **Step 3: `src/pages/stream.astro` — filter chips + description**

Line 18: `const TYPES: (MomentType | 'all')[] = ['all', 'trade', 'note', 'quote']`
Line 37: description → `"The rolling feed of published moments — trades, notes, quotes. Everything public."`

- [ ] **Step 4: `src/pages/api/admin/days.ts` — normalizeMoment**

Replace `MOMENT_TYPES` (line ~76):

```ts
const MOMENT_TYPES = ['trade', 'note', 'quote']
```

Replace `normalizeMoment` — 3 types, `images[]` pass-through, drop `media`:

```ts
function normalizeMoment(m: Record<string, any>): Record<string, any> | null {
  const type = MOMENT_TYPES.includes(String(m.type)) ? String(m.type) : ''
  if (!type) return null
  const at = /^\d{2}:\d{2}$/.test(String(m.at ?? '')) ? String(m.at) : '00:00'
  const out: Record<string, any> = { at, type }
  if (typeof m.text === 'string' && m.text.trim()) out.text = m.text.trim()
  if (m.tradeIdx != null && String(m.tradeIdx).trim() !== '') {
    const ti = Number(m.tradeIdx)
    if (Number.isInteger(ti) && ti >= 0) out.tradeIdx = ti
  }
  const images = Array.isArray(m.images) ? m.images.filter((s: unknown) => typeof s === 'string') : []
  if (images.length) out.images = images
  if (typeof m.author === 'string' && m.author.trim()) out.author = m.author.trim()
  return out
}
```

- [ ] **Step 5: `scripts/seed-review.mjs` — pre-market → note**

In `genStream()` find `type: 'pre-market'` and change it to `type: 'note'`. (Seed emits no post-market/media — verified.) This keeps the generator build-valid if it's ever run again (it must NOT be run against the live tree).

- [ ] **Step 6: `src/components/stream/MomentCard.astro` — minimal 3-type pass**

This task only REMOVES the dead branches so typecheck passes (thumbnails + lightbox come in Task 5):

- Delete the `media` image block (lines 61-65) and the `isQuote`/else structural reliance on `media`.
- `isTrade` and the trade stats line stay. `moment.type === 'media'` comparisons must be gone (MomentType no longer includes `'media'`).
- The card still renders: trade stats line; quote `"text"` + author; note/other `text`. No images yet.

- [ ] **Step 7: Typecheck** (controller runs centrally) + build

Expected: 0 errors. `/stream` builds with 3 chips; `/` builds with empty states (data was wiped in Task 1).

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/lib/stream.ts src/pages/stream.astro src/pages/api/admin/days.ts scripts/seed-review.mjs src/components/stream/MomentCard.astro
git commit -m "feat(stream): collapse moments to trade|note|quote — images[] on moments, screenshots stay on trades"
```

---

### Task 3: Alt-text pipeline — env, cheap caption model, sidecar, media API

**Files:**
- Modify: `src/lib/env.ts` (add `modelAlt`)
- Modify: `.env.example` (document `AI_MODEL_ALT`)
- Modify: `src/lib/ai.ts` (add `captionAlt`)
- Create: `src/lib/media-alt.ts` (`readAlts`/`setAlt`/`removeAlt`/`altFor`)
- Modify: `src/pages/api/admin/media.ts` (generate alt on upload, write sidecar; remove on delete)

**Interfaces:**
- Consumes: `MEDIA` from `src/lib/content.ts`; `env.modelAlt()`; `captionAlt(dataUrl)`.
- Produces:
  - `env.modelAlt(): string` — default `'qwen/qwen-2.5-vl-7b-instruct'`.
  - `captionAlt(dataUrl: string): Promise<string>` — short SEO alt text via the cheap vision model.
  - `readAlts(): Record<string,string>` — parses `public/media/alts.json`, in-memory cache with 10s TTL.
  - `setAlt(rel: string, alt: string)` — writes `{ "/media/<rel>": alt }` (read-modify-write).
  - `removeAlt(rel: string)` — deletes the entry.
  - `altFor(url: string): string` — returns the alt or a generic fallback.
  - Media POST returns `{ ok, url, path, alt }`; DELETE removes the alt entry too.

- [ ] **Step 1: `src/lib/env.ts` — modelAlt**

Add after `modelAssist` (line 9):

```ts
  modelAlt: () => process.env.AI_MODEL_ALT ?? 'qwen/qwen-2.5-vl-7b-instruct',
```

- [ ] **Step 2: `.env.example` — document**

Add: `AI_MODEL_ALT=qwen/qwen-2.5-vl-7b-instruct   # cheap vision model for image alt text`

- [ ] **Step 3: `src/lib/ai.ts` — captionAlt**

Add at the end of the file:

```ts
export async function captionAlt(dataUrl: string): Promise<string> {
  const system = `You write alt text for images in a trader's public journal (charts, screen-time reports, statements, notes).
Write ONE short, factual, SEO-friendly alt text (max 12 words). Describe what the image actually shows — instrument, direction, what happened. Plain and honest, zero hype, no quotes, no markdown.`
  const raw = await orChat(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Write alt text for this image:' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    env.modelAlt(),
    false,
    60,
  )
  return raw.trim().replace(/^```(?:text|markdown)?\s*|\s*```$/g, '').trim()
}
```

- [ ] **Step 4: Create `src/lib/media-alt.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { MEDIA } from './content'

const ALTS_FILE = path.join(MEDIA, 'alts.json')
let cache: Record<string, string> | null = null
let cacheAt = 0
const TTL = 10_000

export function readAlts(): Record<string, string> {
  if (cache && Date.now() - cacheAt < TTL) return cache
  try {
    cache = JSON.parse(fs.readFileSync(ALTS_FILE, 'utf8')) as Record<string, string>
  } catch {
    cache = {}
  }
  cacheAt = Date.now()
  return cache
}

function writeAlts(alts: Record<string, string>) {
  fs.mkdirSync(path.dirname(ALTS_FILE), { recursive: true })
  fs.writeFileSync(ALTS_FILE, JSON.stringify(alts, null, 2))
  cache = alts
  cacheAt = Date.now()
}

export function setAlt(rel: string, alt: string) {
  const alts = readAlts()
  alts[`/media/${rel}`] = alt
  writeAlts(alts)
}

export function removeAlt(rel: string) {
  const alts = readAlts()
  const key = `/media/${rel}`
  if (key in alts) {
    delete alts[key]
    writeAlts(alts)
  }
}

/** Alt text for a public image URL, or a generic fallback. */
export function altFor(url: string): string {
  return readAlts()[url] ?? '1ed.ge — public trading journal image'
}
```

- [ ] **Step 5: `src/pages/api/admin/media.ts` — generate + write alt on upload**

Import `captionAlt` and `setAlt`/`removeAlt` at the top:

```ts
import { captionAlt } from '../../../lib/ai'
import { setAlt, removeAlt } from '../../../lib/media-alt'
```

In POST, after the webp `toFile` succeeds (before the `return json(...)` at line 46), generate and store the alt:

```ts
  let alt = ''
  try {
    alt = await captionAlt(dataUrl)
  } catch {}
  if (alt) setAlt(rel, alt)
  return json({ ok: true, url: `/media/${rel}`, path: rel, alt })
```

In the sharp-failure fallback branch (line 41-44), do the same for `rel2`:

```ts
    let alt2 = ''
    try {
      alt2 = await captionAlt(dataUrl)
    } catch {}
    if (alt2) setAlt(rel2, alt2)
    return json({ ok: true, url: `/media/${rel2}`, path: rel2, alt: alt2 })
```

In DELETE (before `return json({ ok: true })` at line 56):

```ts
  removeAlt(rel)
```

- [ ] **Step 6: Typecheck** (controller centrally) + smoke test

Controller runs `npm run typecheck` (0 errors) and a curl smoke test against a local server on :4323:

```bash
SECRET=$(grep -oP 'ADMIN_SECRET=\K.*' .env)
curl -s -X POST -H "x-admin-secret: $SECRET" -H "Content-Type: application/json" \
  -d '{"dataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","name":"smoke.png"}' \
  http://127.0.0.1:4323/api/admin/media
cat public/media/alts.json 2>/dev/null | head
```

Expected: upload returns `{ ok, url, path, alt }`; `public/media/alts.json` contains the entry (or is absent if the model call failed — the catch swallows it; the smoke image may not be a readable chart, so alt may be empty — that's fine). Then delete it and confirm the alt entry is removed:

```bash
curl -s -X DELETE -H "x-admin-secret: $SECRET" -H "Content-Type: application/json" \
  -d '{"path":"<the path from the upload>"}' http://127.0.0.1:4323/api/admin/media
grep -c "<that path>" public/media/alts.json || echo "alt removed ✓"
```

Restore state if needed: `git checkout -- public/media` (uploads are git-tracked).

- [ ] **Step 7: Commit**

```bash
git add src/lib/env.ts .env.example src/lib/ai.ts src/lib/media-alt.ts src/pages/api/admin/media.ts
git commit -m "feat(media): cheap-model SEO alt text on upload into public/media/alts.json sidecar"
```

---

### Task 4: DayWorkspace — ephemeral capture, 3-type composer with per-moment drops

**Files:**
- Modify: `src/components/admin/tabs/DayWorkspace.tsx` (only this file)

**Interfaces:**
- Consumes: `MomentType`/`images` shapes from Task 2; `/api/admin/media` upload returning `{ url, alt }` from Task 3; existing `api`, `uploadDataUrl`, `ImageDropZone`, `ui.tsx` kit.
- Produces: capture zone never uploads (ephemeral); composer offers exactly `trade|note|quote`; note/quote rows have an `ImageDropZone` that uploads → appends to that moment's `images[]`; trade rows keep `tradeIdx` picker and show the selected trade's screenshots; `momentPayload` sends `images[]` and no `media`; `toMomentForm` reads `images`.

Read the CURRENT `src/components/admin/tabs/DayWorkspace.tsx` first (it was reworked in Phase 2 — the composer has `MomentForm { at, type, text, tradeIdx, author, media }`, `toMomentForm`, `momentPayload`, `publishMoment`, `unstreamMoment`, `polishMoment`, and a composer card with a 6-type select). Match on code, not line numbers.

- [ ] **Step 1: `MomentForm` — swap `media` for `images`**

```ts
interface MomentForm {
  at: string; type: string; text: string; tradeIdx: string; author: string; images: string[]
}
```

Update `toMomentForm` (server moment → form): replace the `media: String(m?.media ?? '')` line with `images: Array.isArray(m?.images) ? m.images.map(String) : []`.

Update `momentPayload` (form → API): remove the `media` line; add:

```ts
    ...(m.images.length ? { images: m.images } : {}),
```

Update `publishMoment`'s validation: the media-presence check becomes a note/quote-image-optional rule — a note/quote moment publishes with text OR images (either is fine); keep the trade → tradeIdx requirement.

- [ ] **Step 2: Capture zone — ephemeral, never upload**

`addDayImages` (paste/upload handler for the capture strip): remove the `uploadDataUrl` call. Build `DayImage` with `url: ''` (the AI only needs `dataUrl`):

```ts
  const addDayImages = async (files: File[]) => {
    const items: DayImage[] = []
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f)
        items.push({ id: Math.random().toString(36).slice(2), dataUrl, url: '' })
      } catch (e) {
        notify(e instanceof Error ? e.message : 'read failed', false)
      }
    }
    if (!items.length) return
    const next = [...dayImagesRef.current, ...items]
    dayImagesRef.current = next
    setDayImages(next)
    markDirty()
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => runStructure(next), 900)
  }
```

`runStructure` already sends `images.map((i) => i.dataUrl)` — unchanged. The capture strip's `img src={img.url}` must fall back to the data URL when `url` is empty (thumbnails in the strip use `img.url || img.dataUrl`).

In `applyStructured`, do NOT attach screenshots from capture images — set trade `screenshots: []` (the AI's `screenshotIndices` were only meaningful when the image persisted; now capture is ephemeral). The `autoFeatured` helper should stop pulling from `trades.flatMap((t) => t.screenshots)` as those are now only kept charts — keep it pulling from `deviceScreens` (now always empty) is harmless; simplify it to leave `featuredImage` manual if no device screens exist.

- [ ] **Step 3: Screen-time — ephemeral**

`onDeviceScreens`: remove the `uploadDataUrl` call and the `setDeviceScreens((s) => [...s, url])` append. Keep the AI `screentime` read (fills hours/notes). Delete the `catch` upload block.

- [ ] **Step 4: Composer — 3 types + per-moment drop zones**

- The `+ new moment` default becomes `{ at: '', type: 'note', text: '', tradeIdx: '', author: '', images: [] }`.
- The type `<Select>` options become exactly `['trade', 'note', 'quote']`.
- Trade rows: keep the `tradeIdx` select (pick from `trades`). Below it, show the selected trade's screenshots as a read-only thumbnail strip (from `trades[parseInt(tradeIdx)]?.screenshots ?? []`).
- Note/quote rows: add an `ImageDropZone onFiles={(fs) => onMomentImages(i, fs)} label="attach images →"` plus the existing text/author fields. `onMomentImages` uploads each file and appends to the moment's `images`:

```ts
  const onMomentImages = async (i: number, files: File[]) => {
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f)
        const url = await uploadDataUrl(dataUrl, f.name)
        setDraftMoments((ms) => ms.map((m, j) => (j === i ? { ...m, images: [...m.images, url] } : m)))
        markDirty()
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
  }
```

- Show the moment's `images` as a small thumbnail strip with remove (×) buttons, same pattern as the trade screenshots strip.

- [ ] **Step 5: Typecheck** (controller centrally)

Expected: 0 errors. The composer + capture compile with the 3-type/`images` model; `media` references are gone from DayWorkspace.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/tabs/DayWorkspace.tsx
git commit -m "feat(admin): DayWorkspace — ephemeral capture, 3-type composer with per-moment image drops"
```

---

### Task 5: Public imagery — MomentCard thumbnails, lightbox, day archive cleanup

**Files:**
- Modify: `src/components/stream/MomentCard.astro` (thumbnails + alt text)
- Create: `src/components/Lightbox.astro` (native `<dialog>` + one shared script)
- Modify: `src/layouts/Base.astro` (include Lightbox)
- Modify: `src/components/archive/DayArchive.astro` (screen-time screenshot grid removed; trade panel screenshots keep; alt text on remaining imgs)
- Modify: `src/styles/app.css` (`.lb-*` lightbox styles)

**Interfaces:**
- Consumes: `ResolvedMoment` from Task 2 (`images`, `trade.screenshots`), `altFor` from `src/lib/media-alt.ts` (Task 3), `momentMeta`.
- Produces: MomentCard thumbnails for all three types; one `<dialog id="lb">` lightbox shared across every Base page; day archive without the screen-time screenshot grid.

- [ ] **Step 1: `src/components/stream/MomentCard.astro` — thumbnails + alt**

- Import: `import { altFor } from '../../lib/media-alt'`
- Compute the image list: trade moments → `moment.trade?.screenshots ?? []`; note/quote → `moment.images ?? []`.

```astro
const imgs: string[] = isTrade ? (moment.trade?.screenshots ?? []) : (moment.images ?? [])
const lbGroup = `${moment.iso}-${moment.at}`
```

- Below the text/quote block, render the thumbnail row (shared for all types), each image a lightbox link with alt text:

```astro
  {imgs.length > 0 && (
    <div class="mt-3 flex flex-wrap gap-2">
      {imgs.map((src) => (
        <a
          href={src}
          target="_blank"
          rel="noopener"
          data-lb={lbGroup}
          class="block w-32 border border-line bg-bg transition-colors hover:border-accent"
        >
          <img src={src} alt={altFor(src)} loading="lazy" class="h-20 w-full object-cover" />
        </a>
      ))}
    </div>
  )}
```

- Remove the old `media` img block (already removed in Task 2's minimal pass — verify it's gone).

- [ ] **Step 2: Create `src/components/Lightbox.astro`**

```astro
---
/** One native <dialog> lightbox, shared by every Base page. Zero deps. The site's single zero-JS exception. */
---

<dialog id="lb" class="lb">
  <button type="button" data-lb-close class="lb-btn lb-close" aria-label="close">×</button>
  <div class="lb-body"></div>
  <button type="button" data-lb-prev class="lb-btn lb-prev" aria-label="previous">‹</button>
  <button type="button" data-lb-next class="lb-btn lb-next" aria-label="next">›</button>
</dialog>

<script is:inline>
  (() => {
    const dlg = document.getElementById('lb')
    if (!dlg) return
    const body = dlg.querySelector('.lb-body')
    const links = Array.from(document.querySelectorAll('[data-lb]'))
    if (!links.length) return
    let group: HTMLAnchorElement[] = []
    let idx = 0
    const show = (i: number) => {
      idx = (i + group.length) % group.length
      const src = group[idx].getAttribute('href') ?? ''
      const alt = group[idx].querySelector('img')?.getAttribute('alt') ?? ''
      body.innerHTML = ''
      const im = new Image()
      im.src = src
      im.alt = alt
      body.appendChild(im)
    }
    dlg.querySelector('[data-lb-close]')?.addEventListener('click', () => dlg.close())
    dlg.querySelector('[data-lb-prev]')?.addEventListener('click', () => show(idx - 1))
    dlg.querySelector('[data-lb-next]')?.addEventListener('click', () => show(idx + 1))
    document.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-lb]') as HTMLAnchorElement | null
      if (!a) return
      e.preventDefault()
      const g = a.getAttribute('data-lb') ?? ''
      group = links.filter((l) => l.getAttribute('data-lb') === g)
      show(group.indexOf(a))
      dlg.showModal()
    })
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close()
    })
  })()
</script>
```

- [ ] **Step 3: `src/layouts/Base.astro` — include the lightbox**

Import at the top: `import Lightbox from '../components/Lightbox.astro'` and render it just before `</body>` (after `<MarketLive />`):

```astro
    <Lightbox />
  </body>
```

- [ ] **Step 4: `src/styles/app.css` — lightbox styles**

Add (token-consistent; off-black, mono, hairline borders):

```css
.lb {
  border: 1px solid var(--color-line);
  background: var(--color-bg);
  color: var(--color-ink);
  padding: 0;
  max-width: min(92vw, 1200px);
  max-height: 90vh;
}
.lb::backdrop {
  background: rgba(7, 8, 12, 0.85);
}
.lb-body img {
  display: block;
  max-width: min(92vw, 1200px);
  max-height: 86vh;
  width: auto;
  height: auto;
}
.lb-btn {
  position: absolute;
  top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--color-line2);
  background: var(--color-bg);
  color: var(--color-dim);
  font-size: 1rem;
  cursor: pointer;
}
.lb-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.lb-close { right: 0.5rem; }
.lb-prev { left: 0.5rem; top: 50%; transform: translateY(-50%); }
.lb-next { right: 0.5rem; top: 50%; transform: translateY(-50%); }
```

Match the existing token variable names actually used in `app.css` (check `--color-bg`/`--color-panel`/`--color-line2` exist; if the bg token is named differently, use the real name).

- [ ] **Step 5: `src/components/archive/DayArchive.astro` — screen-time cleanup + alt**

- Remove the screen-time screenshot `<img>` grid block (`/ screen time — proof`): keep the notes line (`device.notes`) and the values (they're already in the DayFacts strip); delete the `<div class="mt-4 grid ...">{device.screenshots!.map(...)}</div>`.
- Trade panels: keep `t.screenshots` (charts belong to the trade). Add `alt={altFor(s)}` to the trade screenshot `<img>` and import `altFor`.

- [ ] **Step 6: Typecheck** (controller centrally) + build

Expected: 0 errors; build completes. Smoke (controller): `curl http://127.0.0.1:4323/stream/` contains only `trade`, `note`, `quote` chips; no `pre-market`/`media` chips; the lightbox `<dialog id="lb">` is in the served HTML; a day with a trade moment renders its screenshots as `data-lb` thumbnails (once data exists).

- [ ] **Step 7: Commit**

```bash
git add src/components/stream/MomentCard.astro src/components/Lightbox.astro src/layouts/Base.astro src/components/archive/DayArchive.astro src/styles/app.css
git commit -m "feat(public): moment thumbnails with alt text + native dialog lightbox; day archive screen-time grid removed"
```

---

### Task 6: Docs + build + deploy + verify live

**Files:**
- Modify: `CHANGELOG.md`, `AGENTS.md`, `MEMORY.md`, `.env.example` (already in Task 3), `docs/superpowers/specs/2026-08-07-moment-images-design.md` (mark status shipped)

- [ ] **Step 1: Update `CHANGELOG.md`**

Add an `Unreleased` entry: moments collapsed to trade/note/quote (media + session labels deleted); images attach to artefacts (trade screenshots kept, note/quote `images[]`); ephemeral capture (screenshots read by AI, never saved); cheap-model SEO alt text on upload (`public/media/alts.json` sidecar); native `<dialog>` lightbox; test data wiped.

- [ ] **Step 2: Update `AGENTS.md`**

- Layout section: add `src/lib/media-alt.ts` and `src/components/Lightbox.astro`; adjust the stream/moment description (3 types, images-on-moments).
- Content model section: update the `stream:` example to 3 types + `images[]`; note the capture zone is ephemeral (images never saved) and alt text is generated on upload via the cheap model.

- [ ] **Step 3: Update `MEMORY.md`**

- Session log entry for this feature.
- Update the WRAP-UP: data wiped (test data gone; site starts empty until the owner logs real days); moments are 3-type; imagery model (trade screenshots + note/quote images); alt sidecar; lightbox exception. Remaining: Phase 4 remediation + owner testing.
- Remove the "accept 277KB journal" note only if it's still accurate (it is — unchanged this session).

- [ ] **Step 4: Final gate — typecheck + build**

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 5: Commit + deploy**

```bash
git add CHANGELOG.md AGENTS.md MEMORY.md
git commit -m "docs: moment-images — 3-type stream, artefact-linked images, alt sidecar, lightbox, data wipe"
bash scripts/deploy.sh
```

- [ ] **Step 6: Verify LIVE**

```bash
for i in $(seq 1 40); do
  code=$(curl --resolve 1ed.ge:443:104.21.7.179 -s -o /dev/null -w '%{http_code}' https://1ed.ge/ || true)
  [ "$code" = "200" ] && break
  sleep 3
done
echo "home: $code"
curl --resolve 1ed.ge:443:104.21.7.179 -s https://1ed.ge/stream/ | grep -oE '>all<|>trade<|>note<|>quote<' | sort -u
curl --resolve 1ed.ge:443:104.21.7.179 -s https://1ed.ge/ | grep -c 'id="lb"' || echo "no lightbox on / (expected if no thumbnails yet — dialog only renders if data-lb links exist... verify by grep for 'lb' class)"
```

Expected: home 200; `/stream` chips are exactly `all/trade/note/quote`; no `pre-market`/`media`/`post-market` chips anywhere. Kill any local test server on :4323. Visit the admin and confirm the day screen: capture zone (paste → AI → no upload), composer with 3 types, note/quote drop zones, trade screenshots strip.

---

## Self-review notes

- **Spec coverage:** §6 data wipe → Task 1. §3.1/§3.2/§7 moment collapse + trade screenshots → Task 2 (+Task 4 composer). §3.4/§7 alt sidecar + cheap model → Task 3. §4.1 ephemeral capture + §4.2 composer drops → Task 4. §5.1/§5.2/§5.3/§5.4 thumbnails + lightbox + filter + day archive → Task 5. §8 out-of-scope items untouched.
- **Dependency order:** Task 2 before Tasks 4/5 (types). Task 3 before Tasks 4/5 (alt + upload contract). Task 1 independent (first). Waves: W1 = Tasks 1+2+3 parallel (write-disjoint: content dirs / schema+stream+page+api+seed+MomentCard / env+ai+media); W2 = Tasks 4+5 parallel (DayWorkspace / MomentCard+Lightbox+Base+DayArchive+css); W3 = Task 6.
- **Type consistency:** `StreamMoment.images?: string[]` (Task 2) ↔ `MomentForm.images: string[]` + `momentPayload.images` (Task 4) ↔ `ResolvedMoment.images?` + `trade.screenshots?` (Task 2) ↔ `MomentCard imgs` (Task 5) all agree. `altFor(url)` (Task 3) used in Task 5. `captionAlt` signature stable. `momentMeta` returns the 3-case union — no default needed (exhaustive switch over the 3-type union).
- **Zero-JS:** the only public JS added is the single Lightbox inline script (owner-approved exception). MomentCard thumbnails are plain `<a>`+`<img>` with `target="_blank"` fallback if JS is off.
- **Plan-mandated risks already flagged for reviewers:** (a) `captionAlt` failing is swallowed (alt optional, upload still succeeds); (b) `resolveMoments` maps straggler old types to `note` defensively; (c) lightbox is progressive enhancement — images open in a new tab without JS; (d) trade screenshots render in both the archive panel and the trade moment (owner-confirmed "trade owns its charts").
