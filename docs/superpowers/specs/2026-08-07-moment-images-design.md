# Moment Images — Design Spec

**Date:** 2026-08-07 · **Status:** Approved (owner, via brainstorm) · **Owner:** sole trader
**Product:** 1ed.ge — cockpit (private production) → approved broadcast → public archive.

---

## 1. Problem

The stream's moment taxonomy has types that don't earn their place, and imagery is
unmoored:

- `media` moments post a standalone image — but the owner wants **every image
  attached to an artefact** (a trade, a note, a quote). No standalone image posts.
- `pre-market` / `post-market` are hierarchy the owner doesn't need — he trades any
  time, not bound to a session. They're just labels; the `at` time already says when.
- Screen-time screenshots are shown publicly today, but the owner considers that
  unnecessary — trust is trust; an extraction method isn't tamper-proof anyway.
- Uploaded images have no SEO alt text, and the owner wants it auto-generated with a
  **cheap** model at upload time, stored out-of-band (sidecar), so day records stay lean.
- The trade-chart gap: a published `trade` moment on `/stream` shows stats but **not**
  the chart, even though the trade owns screenshots.

The old filler data (730 days etc.) was test data — the owner wants it wiped.

## 2. Design decisions (owner-confirmed)

1. **Images always attach to an artefact.** No standalone image posts, ever.
2. **Keep screenshots on trades.** `trades[].screenshots[]` stays; a published trade
   moment renders the trade's screenshots as thumbnails → lightbox.
3. **Moment types collapse to `trade | note | quote`.** `media`, `pre-market`,
   `post-market` are deleted from the schema.
4. **Two admin zones:** an **ephemeral capture zone** (AI reads text + screenshots →
   fills the day → images never uploaded, truly deleted) and **keep-and-link zones**
   in the composer (paste onto a trade / note / quote → saved + attached). No AI
   guessing where a kept image goes — the owner places it.
5. **Screen-time values** are still filled from screenshots (ephemeral); no public
   screen-time screenshots.
6. **Lightbox is the one zero-JS exception** — native `<dialog>`, shared tiny script.
7. **Cheap-model SEO alt text on upload**, stored in a sidecar file, used by every
   public `<img>`.
8. **Old test data wiped** (days/journal/accounts/payouts/coach/media uploads);
   definitions (habits/models/rules/quotes) + market-news + brief stay.

## 3. Data model

### 3.1 Moment (day record `stream[]` + `draft.moments[]`)

```yaml
stream:
  - at: "14:05"
    type: trade        # trade | note | quote (media/pre-market/post-market deleted)
    tradeIdx: 0        # trade type: references trades[]; its screenshots render
    text: "..."        # note/quote text; optional for trade
    author: "..."      # quote type only
    images: ["/media/2026-08-07/xxx.webp"]   # note/quote keep their own images
```

- `MomentType = 'trade' | 'note' | 'quote'`.
- `images: string[]` (0..n) — the ONLY image channel for note/quote. Trade moments
  render `trades[tradeIdx].screenshots[]` instead (see 3.2).
- `draft.moments[]` uses the same shape (private until published).

### 3.2 Trade (unchanged)

`trades[].screenshots: string[]` stays exactly as today — the trade owns its charts.
The trade moment is a pointer (`tradeIdx`); the public card shows the trade stats
(`▲/▼ market · model/setup · ±R`) plus its `screenshots[]` thumbnails.

### 3.3 Device (screen-time)

`device.screenshots[]` stays in the schema (old files, harmless) but is **no longer
rendered publicly** and **no longer populated** by the admin (ephemeral extraction
only fills the hours/notes). Day archive "screen time — proof" section shows values +
notes only.

### 3.4 Media + alt-text sidecar

- Uploads: `POST /api/admin/media` → sharp → webp (max 1920w, q82) →
  `public/media/<date>/<slug>-<ts>.webp` (unchanged).
- **New:** on upload, a **cheap vision model** generates a short SEO alt caption.
- **Sidecar:** `public/media/alts.json` — one map, git-tracked, bind-mount-safe:
  ```json
  { "/media/2026-08-07/slug-abc.webp": "MNQ long entry chart, ORB drive setup, +12 points" }
  ```
  Written read-modify-write on each upload (single-user, low volume). Deleted entry
  on media DELETE.
- **Renderer:** `altFor(url)` helper (fs read of `alts.json`, cached in-memory with a
  short TTL) used by every public `<img>` (MomentCard thumbnails, trade screenshots,
  day-archive images, lightbox). Fallback to a generic description when absent.

## 4. Admin UX (DayWorkspace)

### 4.1 Ephemeral capture zone (top of day screen — unchanged position)

- Paste text + screenshots → `structureDayFull` reads everything (Qwen VL for image
  days, DeepSeek for text) → fills mood/sleep/habits/device/trades → **images are
  never uploaded** (data URLs go straight to the AI, then discarded).
- **Behavior change:** `addDayImages` no longer calls `uploadDataUrl`. The AI still
  receives the image data; nothing is persisted. (Today it uploads first — that
  orphan-upload path is removed.)
- Screen-time paste (`onDeviceScreens`) also becomes upload-free: values extracted,
  image gone.

### 4.2 Composer — keep-and-link (unchanged position, 3 types)

- `+ new moment` offers `trade | note | quote` (media/pre-market/post-market gone).
- **Every moment row has its own drop zone** (`ImageDropZone`). Drop → upload →
  alt text generated → attached to that moment's `images[]` (note/quote) or pushed
  onto the selected trade's `screenshots[]` (trade type).
- Trade type: pick the trade (`tradeIdx`); its screenshots show in the row; you can
  add more charts to the trade from here.
- Publish (`publish →`) moves draft → `stream`, as today. AI-polish edits drafts
  only. The AI never guesses where a kept image goes.

### 4.3 Media tab

Unchanged, plus: delete removes the entry from `alts.json` too.

## 5. Public UX

### 5.1 MomentCard (trade | note | quote)

- **Trade moment:** stats line (`▲/▼ market · session · model/setup · ±R`,
  entry/exit/stop/points fallback) + **the trade's `screenshots[]`** as a thumbnail
  row → lightbox. (Closes the trade-chart gap.)
- **Note:** text + its `images[]` thumbnails → lightbox.
- **Quote:** `"text"` — author + its `images[]` thumbnails → lightbox.
- All `<img>` use `altFor(url)`.

### 5.2 Lightbox (the one zero-JS exception)

- Native `<dialog>` element. One shared inline script in `Base.astro` (~30 lines):
  open on thumbnail click, Esc + click-outside close, prev/next within the same
  moment's images. No library.
- Public pages otherwise remain zero-JS.

### 5.3 `/stream` filter

`all / trade / note / quote` (media/pre-market/post-market chips removed).

### 5.4 Day archive (`DayArchive.astro`)

- Trade panels: facts (unchanged; screenshots continue to render in the panel).
- Moments: MomentCard as above.
- Screen-time section: values + notes only — screenshot grid removed.

## 6. Data wipe (Task 0)

- `git rm -r` of `src/content/{days,journal,accounts,payouts,coach}` and
  `public/media/*` (uploads + any alt sidecar). Git history preserves everything.
- Keep `src/content/{habits,models,rules,quotes,market-news,brief}`.
- `scripts/seed-review.mjs` stays in the repo (never run against the live tree —
  it clears dirs) but no content regeneration happens.

## 7. Schema + code touch list

- `src/content.config.ts`: `MomentType` enum → `trade|note|quote`; `moment` schema:
  `images: string[]` default `[]`; drop `media` field; `tradeIdx` stays.
- `src/lib/stream.ts`: `MomentType`, `StreamMoment` (+`images`), `ResolvedMoment`
  (+`images`, trade screenshots threaded), `momentMeta` glyphs
  (`▲ trade · note " quote`), `resolveMoments` maps old types on read
  (pre-market/post-market/media → note for any surviving old files).
- `src/lib/media-alt.ts` (new): `alts.json` read/write/delete + `altFor()`.
- `src/pages/api/admin/media.ts`: generate alt on upload (cheap model), write sidecar;
  delete from sidecar on DELETE.
- `src/pages/api/admin/days.ts`: `normalizeMoment` — 3-type allowlist, `images[]`
  pass-through, drop `media`.
- `src/lib/ai.ts`: add `captionAlt(dataUrl)` using a cheap vision model
  (`env.modelAlt()`, new env key; `.env.example` updated; default
  `qwen/qwen-2.5-vl-7b-instruct`).
- `src/components/admin/tabs/DayWorkspace.tsx`: capture zone stops uploading;
  composer 3 types with per-row drop zones; trade screenshots kept; screen-time
  upload-free.
- `src/components/stream/MomentCard.astro`: 3 types + thumbnails + lightbox hooks;
  trade screenshots; alt text.
- `src/components/archive/DayArchive.astro`: screen-time screenshot grid removed;
  trade panel screenshots stay.
- `src/pages/stream.astro`: filter chips 3 types.
- `src/layouts/Base.astro`: shared lightbox script.
- `src/lib/env.ts`: `modelAlt`.

## 8. Out of scope

- Phase 4 remediation items (money colors elsewhere, tablet breakpoint, sticky
  subnav, journal API path traversal, rebuild mutex, unit tests, dead CSS purge,
  `--font-display`, lighthouserc dead URLs).
- Public `/` and `/stream` SSR semantics unchanged.
- No changes to accounts/payouts/coach/brief/market-news surfaces.
- No migration of old moment data (data is wiped; `resolveMoments` maps any
  stragglers to `note` defensively).

## 9. Locked tradeoffs

- Lightbox is the single zero-JS exception on public pages (owner approved).
- Alt text comes from a cheap vision model; quality is "good enough SEO", not
  perfect — never uses the expensive models.
- `alts.json` is a single read-modify-write file — fine for a single-user admin at
  low volume; revisit if uploads scale.
- Screen-time screenshots are ephemeral-only: values public, images never saved.
