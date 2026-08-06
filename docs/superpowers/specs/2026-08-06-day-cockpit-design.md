# The Day Cockpit — design spec

**Date:** 2026-08-06 · **Status:** Approved (v1) · **Owner:** sole trader
**Product:** 1ed.ge — the day page becomes the single surface you live in.

---

## 1. Vision

One page. The **Day Cockpit** — a public, live, zen writing surface that is your
whole trading day:

- **Ambient awareness** — the 24h market structure as a timeline, the next event
  countdown, hazard dots that breathe only when they matter.
- **Grounding** — your rules, cycling quotes, habits, self-talk. Always near.
- **Writing, not chat** — a half-page document (Ghost/Substack rhythm) in the
  site's mono/hacker type, built entry-by-entry through an **AI refine →
  approve** loop. Nothing is public until you approve it.
- **Everything public, nothing accidental** — typed thoughts and extracted data
  both go through AI prep + your approval. Screenshots are ingest-only: data is
  pulled, the image is discarded.

This is the "one-stop shop": the page you keep open in a docked PWA all day and
on your phone, for every trading-related need.

## 2. Context & problem

Current state: 9 top-level nav destinations, overlapping analytics pages
(performance / tracker / trends all answer "how am I doing?"), a 268KB journal
index, and a homepage that's a "dashboard salad". The code is well-factored —
the mess is **information architecture and weight**, not code quality.

**No database.** Files-as-database (markdown frontmatter + content collections +
git) is exactly right for a single-user, write-once-read-often public journal.
A DB would add ops surface for zero benefit. The build (~15s for 730 days) is
the query layer. Verified in session — keep the current approach.

## 3. The Day Cockpit layout

Three columns, mono type throughout, muted desaturated palette
(sage `#6ea88a` = up/flat, clay `#b06a5e` = hazard, off-black `#0a0a0c`,
hairline borders). **No bright red/green anywhere.**

```
┌ top strip: brand · now HKT · next event · day X/730 progress bar
│            24h HKT timeline (session bands + hazard dots + now-marker)
├────────────┬──────────────────────────────┬─────────────┤
│ LEFT RAIL  │ CENTER — the writing surface │ RIGHT RAIL  │
│ rules (the │ title · data cells (mood /   │ extract drop│
│ rule that  │ sleep / screen / trades —    │ zone (ephem.)│
│ matters now│ pending until extracted)     │ today record│
│ lights)    │ prose paragraphs + inline    │ hazard line │
│ quote ↻    │ images (auto-opt, auto alt/  │             │
│ habits     │ caption)                     │             │
│ self-talk  │ flat-line reassurance        │             │
│            │ composer: submit 🤖 publish 🌐│             │
└────────────┴──────────────────────────────┴─────────────┘
```

- **Rails are collapsible and pin-sticky on wide screens**; on small screens
  they tuck away (tap to open). No duplicated info: the top strip owns all
  market ambient, the rails own grounding + data.
- **Top strip (ambient layer):**
  - `now 13:18 hkt` · `next · LSE open in 41m` (the chronologically-next event:
    session open/close or hazard — always the one number that matters).
  - The **24h HKT timeline**: faint session bands (CME/TSE/LSE/NYSE, NYSE wraps
    midnight), the now-marker creeping across, hazard dots positioned at their
    event times. Hover a band for its countdown tooltip. Powered by the existing
    `src/lib/sessions.ts`.
  - `day 12/730` thin progress hairline.
- **Hazard system** (the anti-jarring rule):
  - A **6px dot, same size as the status dots**, in faded clay.
  - Label = event name + HKT time + countdown (`CPI · 20:30 · in 1h 12m`).
  - **Pulses (opacity only, no scale/glow) only inside the 30-minute window
    before the event**; otherwise it sits dim and still.
  - **The word "red" never appears.** No cards/boxes around hazards — a bare
    dot + text line, identical treatment to `CME open`.
- **Left rail:** rules (the currently-relevant rule highlights warm), a rotating
  quote with tiny position dots + ↻ control, habits checklist, self-talk.
- **Right rail:** the **extract drop zone** (small dashed box — trades /
  screen-time / sleep screenshots, data only, auto-discarded), today's record
  (mood/sleep/screen/trades/R), and the hazard line.
- **Writing surface (center):** title, a sub-line of **data cells** that show
  `pending` (dashed, faint) until AI-extracted data confirms them, prose in
  mono, inline images tagged `▤ optimized · alt auto-written`, a quiet
  `saved · synced` status, the blinking caret, and the **flat-line**:
  `flat · no positions · next touch 20:15 before CPI` in sage.
- **Actions are quiet and icon-led:** `submit 🤖` and `publish 🌐` are small
  hairline-bordered buttons with an 8px trailing emoji; secondary actions
  ("make it shorter", "discard") are faint text links.

## 4. The AI refine → approve loop

The heart of the experience. Every published word and every datum passes through
this:

1. **You write it raw** — stream of consciousness, typos fine, nothing leaves
   the building.
2. **`submit 🤖`** → AI refines in ~2s: tone and core info kept, mistakes fixed,
   nothing added. A refined block appears with the original behind a small
   toggle.
3. **Decide:** `publish 🌐` · `make it shorter` · `discard` · or type any custom
   instruction in the quiet "ask for a change" input (AI re-refines, loops
   until you approve).
4. **Published** → appended to the day document, `● live · public`, visible to
   the world within seconds (SSR reads fs directly — **no rebuild mid-session**).

The same loop drives **screenshots**: drop into the extract zone → AI OCRs and
proposes structured data (trades, screen-time, sleep, workout) → you approve or
correct → data folds into the day record → **the image is discarded**.

**Screenshot types:**
- **Ephemeral track** (extract zone): trades/PnL, screen-time, sleep, workouts —
  data only, image held in a temp buffer during the AI call, then deleted. Never
  saved, never public, never viewable.
- **Public track** (in the document): chart screenshots, weekend top-down
  analysis — persist to `public/media/<date>/`, auto-optimized (sharp → webp),
  embedded with an auto-written SEO alt + caption.

## 5. Live mechanics

- The day page becomes **SSR** (`prerender = false`). First load = fully
  server-rendered HTML (SEO + instant). Then a **~1KB deferred poller** appends
  new published entries and ticks the timeline/now-marker. This is the **only
  JS on public pages** — a deliberate, documented carve-out to the zero-JS rule
  (the composer island is auth-gated and only loads for you).
- **No rebuilds mid-session.** SSR reads the day document + day record via fs
  (as the admin already does), so approved entries are live in seconds.
  Rebuilds remain for meaningful moments (end-of-day synthesis, journal title,
  account changes) and the static analytics pages.
- **Data model:** published entries append to `journal/<date>.md` body (the day
  document). Drafts awaiting refine/approve live in a private ephemeral queue
  (`/tmp/1edge-queue/<date>.json`). The structured day record
  (`days/<date>.md`) stays the aggregation spine.
- **Role of the admin app:** the cockpit becomes the daily-input surface
  (replacing the capture/summary portion of the DayWorkspace). The admin app
  remains for structured-data correction, accounts, coach, media management,
  brief, and rebuild — the management layer, not the daily home.

## 6. IA consolidation

- `/` = **today** (the cockpit for the current day). The day page is the
  centerpiece; the homepage stops being a dashboard salad.
- Nav shrinks from 9 to ~5: `today · journal · calendar · performance ·
  accounts` (+ about). `/performance`, `/tracker`, `/trends` merge into one
  analytics destination.
- The market widget, brief, day record, journal, and coach all hang off the day
  page rather than competing as separate top-level worlds.

## 7. Phasing

Each phase ships, deploys, and is verified live on 1ed.ge independently.

- **P1 · Cockpit shell + IA** — day page → cockpit layout (rails, writing
  surface, ambient strip with static timeline), homepage → today, nav shrink +
  analytics merge, mono-only typography. Zero-JS.
- **P2 · Live layer** — SSR day page, journal-as-live-document, ~1KB poller,
  secret-keyed write API, ticking timeline + `next` line + countdown tooltips,
  hazard pulse timing (30-min window).
- **P3 · AI loop + extract** — refine/approve pipeline (submit/publish/
  shorter/discard/custom), ephemeral screenshot ingest (two tracks), pending→
  confirmed data cells, autosave.
- **P4 · Polish + bloat + PWA** — visual polish from approved mockups, fix the
  268KB journal index, drop unused fonts, Lighthouse + SEO sweep, mobile rail
  behavior, PWA install experience.

## 8. Constraints & non-goals

- **Single user.** No multi-user anything. One writer (you), secret-keyed.
- **Everything public except the admin.** Approval is the only guard between
  you and the public record.
- **US/CME/NYSE-futures-centric.** TSE/LSE appear only as session bands for
  awareness (e.g., don't be caught in the London open). No news *content* —
  only schedules/hazard timing.
- **All times HKT.**
- **Fast, bloat-free, SEO-clean.** Zero-JS on public pages except the ~1KB
  poller; fully server-rendered HTML.
- **No CSV, no manual trade entry.** Trades come from screenshots only.
- **PWA-friendly** — docked app on desktop, full-screen on mobile.

## 9. Success criteria

- The cockpit is the only page you need open on a trading day (desktop + phone).
- A thought goes from raw typing to published-on-the-day in a few taps, with no
  rebuild ceremony.
- A trade screenshot → approved structured trade in under a minute, image gone.
- You always know: next event countdown, whether you're flat, what data is
  still pending.
- Public pages stay sub-100KB HTML, zero third-party JS, Lighthouse ≥0.95.
- Nav is ≤6 destinations, no overlapping analytics pages.
