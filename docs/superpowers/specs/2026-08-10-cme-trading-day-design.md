# CME Trading Day — Design Spec

> **Date:** 2026-08-10
> **Status:** Design — awaiting approval
> **Goal:** Organize the entire site around the CME trading day instead of calendar days

---

## Problem

The CME trading session runs **17:00 → 16:00 US Central** (23 hours, with a 1-hour maintenance halt). In HKT, that's **06:00 → 05:00** the next day.

The codebase currently uses `todayHkt()` which returns the **calendar HKT date** (midnight→midnight). This means:

- At 03:00 HKT Tuesday, the stream shows "Tuesday" but the CME session is still Monday's
- A news event at 02:00 HKT Tuesday is in Tuesday's market-news file, but it belongs to Monday's trading session
- The admin saves to the calendar date, not the trading date
- Everything between midnight and 06:00 HKT is orphaned from its trading day

---

## Solution

Replace `todayHkt()` with a CME-aware `cmeToday()` everywhere it's used as a "which day is it" boundary. Add a configurable display timezone so the user sees times in their local clock.

### Core principle

**The CME trading day is the organizing unit.** Everything that happens during a trading session (17:00 CT → 16:00 CT next day) belongs to that trading day. The trading-day boundary is always expressed in the user's selected timezone.

---

## Architecture

### 1. Trading-day boundary (hardcoded to CT)

The CME session opens at **17:00 America/Chicago**. This is not configurable — it's where CME lives. The `cmeDate()` function always uses `America/Chicago` as the source of truth.

### 2. Display timezone (user-configurable, for rendering only)

The user selects a display timezone from `{ lax, nyc, lon, del, hk, tyo, syd }`. This controls how times render on the site ("8:30am" vs "21:30"). It does NOT affect which trading day it is — that's always CT.

Stored in admin settings. Public pages read it at build time (via config file). Admin reads it client-side. Changing it requires a rebuild of public pages (one click via the admin "rebuild now" button). The admin React app picks it up instantly.

| Label | IANA | DST? |
|-------|------|------|
| LAX | `America/Los_Angeles` | Yes (US) |
| NYC | `America/New_York` | Yes (US) |
| LON | `Europe/London` | Yes (UK) |
| DEL | `Asia/Kolkata` | No |
| HKG | `Asia/Hong_Kong` | No |
| TYO | `Asia/Tokyo` | No |
| SYD | `Australia/Sydney` | Yes (AU) |

**The display timezone does NOT affect `cmeDate()`.** The trading-day boundary is always `17:00 America/Chicago`. The display timezone only controls how times are formatted for the user's eye.

### 3. Core function: `cmeDate(ms)`

```ts
/**
 * CME session opens at 17:00 America/Chicago.
 * For any UTC timestamp, determine which CME trading day it belongs to.
 *
 * Logic:
 *   - CT hour >= 17 → trading day started at 17:00 CT today → date = CT date + 1
 *   - CT hour < 17  → trading day started at 17:00 CT yesterday → date = CT date
 *
 * Examples:
 *   Sun 17:30 CT → Monday's trading day (CT date Sun + 1 = Mon)
 *   Mon 14:00 CT → Monday's trading day (CT date Mon, hour < 17)
 *   Mon 17:00 CT → Tuesday's trading day (CT date Mon + 1 = Tue)
 *   Tue 03:00 HKT / Mon 14:00 CT (CDT) → Monday's trading day
 *   Tue 06:30 HKT / Mon 17:30 CT (CDT) → Tuesday's trading day
 *   Tue 06:30 HKT / Mon 16:30 CT (CST) → Monday's trading day (CME opens at 07:00 HKT in winter)
 *
 * DST-safe: uses Intl.DateTimeFormat with IANA timezone identifiers.
 * The boundary is always in US Central — not configurable.
 */
export function cmeDate(ms: number): string {
  const d = new Date(ms)

  // Get the CT wall-clock hour
  const ctHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false,
      timeZone: 'America/Chicago'
    }).format(d)
  )

  // Get the CT date
  const ctDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d)

  // If CT hour < 17: the current trading day started yesterday at 17:00 CT
  // → trading date = CT date (today)
  if (ctHour < 17) return ctDateStr

  // If CT hour >= 17: a new trading day just started at 17:00 CT today
  // → trading date = CT date + 1 (tomorrow)
  const [y, m, day] = ctDateStr.split('-').map(Number)
  const next = new Date(y, m - 1, day + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

/** Convenience: right now → current CME trading date */
export function cmeToday(): string {
  return cmeDate(Date.now())
}
```

### 4. Display timezone helper

```ts
const DISPLAY_TIMEZONES = {
  lax: 'America/Los_Angeles',
  nyc: 'America/New_York',
  lon: 'Europe/London',
  del: 'Asia/Kolkata',
  hk:  'Asia/Hong_Kong',
  tyo: 'Asia/Tokyo',
  syd: 'Australia/Sydney',
} as const

export type DisplayTimezone = keyof typeof DISPLAY_TIMEZONES

/** Format a timestamp in the user's selected display timezone */
export function formatInTz(ms: number, tz: DisplayTimezone = 'hk'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONES[tz],
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(ms))
}

/** Format a date in the user's selected display timezone */
export function dateInTz(ms: number, tz: DisplayTimezone = 'hk'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONES[tz],
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(ms))
}
```

### 3. What changes (14 sites)

| # | File | Current | Change to |
|---|------|---------|-----------|
| 1 | `src/pages/index.astro` | `todayHkt()` | `cmeToday(tz)` |
| 2 | `src/pages/stream.astro` | `todayHkt()` | `cmeToday(tz)` |
| 3 | `src/pages/calendar.astro` | `todayHkt()` | `cmeToday(tz)` |
| 4 | `src/components/MarketWidget.astro` | `todayHkt()` | `cmeToday(tz)` |
| 5 | `src/components/MarketDay.astro` | `todayHkt()` | `cmeToday(tz)` |
| 6 | `src/components/MarketLive.astro` | `todayHkt()` | `cmeToday(tz)` |
| 7 | `src/components/MarketFooter.astro` | `todayHkt()` | `cmeToday(tz)` |
| 8 | `src/layouts/Base.astro` | `todayHkt()` | `cmeToday(tz)` |
| 9 | `src/components/admin/tabs/DayWorkspace.tsx` | `todayStr()` (browser-local) | `cmeToday(tz)` via API |
| 10 | `src/components/admin/CommandPalette.tsx` | `todayStr()` | `cmeToday(tz)` |
| 11 | `src/pages/api/admin/coach.ts` | `new Date().toISOString().slice(0,10)` (UTC) | `cmeToday(tz)` |
| 12 | `src/pages/api/admin/status.ts` | `todayKey()` | `todayKey()` (inherits fix) |
| 13 | `src/pages/api/admin/market.ts` | `todayKey()` | `todayKey()` (inherits fix) |
| 14 | `scripts/market-news-fetch.mjs` | `isoDay(ms)` (HKT calendar) | `cmeDate(ms, 'hk')` |

### 4. What stays the same

- **Accountability** (`accountability.ts`) — grace is wall-clock, not market-clock
- **Period reviews** (`periods.ts`) — weeks are calendar Mon–Fri
- **Stats/trends** — rolling windows over stored day dates
- **Day record files** — still `YYYY-MM-DD.md`, but the date is now the CME trading date
- **`nowHkt()`** — wall-clock timestamp, no day-key semantics

### 5. News fetch shift

`scripts/market-news-fetch.mjs` currently buckets events by their HKT calendar date (`isoDay(ms)`). Change to `cmeDate(ms, 'hk')`. An event at 02:00 HKT Tuesday → Monday's file.

**One-time migration:** The next fetch run will re-bucket everything (it overwrites files). Or write a one-time migration script.

### 6. The 3 UTC bugs (fix along the way)

| File | Bug | Fix |
|------|-----|-----|
| `src/pages/api/admin/coach.ts:53` | `new Date().toISOString().slice(0,10)` = UTC | `cmeToday(tz)` |
| `src/pages/api/admin/media.ts:33` | UTC date → media folder | `cmeToday(tz)` (or keep UTC — just a folder name) |
| `src/components/admin/NotificationDrawer.tsx:43` | UTC date → grace bucket | Use server-provided `nowHkt()` date |

### 7. Admin timezone setting

The admin stores the timezone in a config file. The admin React app reads it on mount and uses it for all date computations. No rebuild needed — it's client-side JS.

The public pages are SSR — they read the config at build time. Changing the timezone requires a rebuild, but since the admin has a "rebuild now" button, this is one click.

### 8. DST handling

All DST is handled by `Intl.DateTimeFormat` with IANA timezone identifiers. No manual offset math, no DST tables. The `cmeDate()` function uses `America/Chicago` as the source of truth for the CME boundary, then expresses it in the user's timezone. Both conversions are DST-safe.

When US switches between CST/CDT:
- The CME session shifts by 1 hour in UTC (22:00 → 23:00 or vice versa)
- In HKG, the boundary shifts from 06:00 → 07:00 HKT (or vice versa)
- In NYC, the boundary stays at 18:00 ET (because ET also shifts)
- `Intl.DateTimeFormat` handles all of this automatically

---

## How to ensure completeness

1. Grep for `todayHkt` — every usage must be replaced or verified as "can stay"
2. Grep for `todayStr` — every usage must be replaced
3. Grep for `todayKey` — verify it calls `todayHkt()` (inherits the fix)
4. Grep for `new Date().toISOString().slice(0,10)` — find UTC bugs
5. Grep for `isoDay` — the news fetch script
6. Run typecheck + build after all changes
7. Test the boundary: set system clock to 03:00 HKT, verify stream shows yesterday's trading day

---

## What this enables (future work)

- Display timezone switcher in admin (no rebuild for admin, rebuild for public pages)
- "Trading day" concept in period reviews (week = Mon–Fri CME trading days)
- Correct attribution of overnight news events to their trading day
