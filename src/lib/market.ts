export type MarketStatus = 'open' | 'early' | 'early-halt' | 'closed'

export interface MarketDay {
  status: MarketStatus
  label: string
}

/* ------------------------------------------------------------------ */
/* Timezone helpers — DST-aware US wall-clock → HKT. The site is HKT   */
/* everywhere; a CT label like "12pm ct" is meaningless to the owner   */
/* and the CT→HKT offset shifts by an hour between CST and CDT. These  */
/* helpers convert a CT wall time on a specific date to HKT, honoring  */
/* DST via Intl.                                                       */
/* ------------------------------------------------------------------ */

export const HKT_OFFSET_MS = 8 * 3600 * 1000

/** Offset of `tz` from UTC in minutes at the given instant. */
export function tzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** Wall-clock (hh:mm) on local date `iso` in `tz` → UTC ms. */
export function wallToUTC(tz: string, iso: string, hh: number, mm: number): number {
  const [y, m, d] = iso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off = tzOffsetMinutes(tz, new Date(guess))
  return guess - off * 60000
}

export function hktIso(utcMs: number): string {
  const d = new Date(utcMs + HKT_OFFSET_MS)
  return d.toISOString().slice(0, 16) + '+08:00'
}

/** CT wall-clock hh:mm on date `iso` → HKT "HH:MM" (DST-aware, per-date). */
export function ctToHktHhmm(iso: string, hh: number, mm: number): string {
  return hktIso(wallToUTC('America/Chicago', iso, hh, mm)).slice(11, 16)
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export { isoFromDate }

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export { addDays }

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  return addDays(first, diff + (n - 1) * 7)
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return addDays(last, -diff)
}
export { easterSunday, nthWeekday, lastWeekday }

/** NYSE/CME observed-day shift: Saturday → Friday before, Sunday → Monday after. */
function observed(d: Date): Date {
  const dow = d.getDay()
  if (dow === 6) return addDays(d, -1)
  if (dow === 0) return addDays(d, 1)
  return d
}

export function holidaysForYear(year: number): Date[] {
  return [
    new Date(year, 0, 1),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    addDays(easterSunday(year), -2),
    lastWeekday(year, 4, 1),
    new Date(year, 5, 19),
    new Date(year, 6, 4),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 10, 4, 4),
    new Date(year, 11, 25),
  ].map(observed)
}

const earlyCloseRules = [
  (y: number) => addDays(nthWeekday(y, 10, 4, 4), 1),
  (y: number) => new Date(y, 11, 24),
  (y: number) => new Date(y, 11, 31),
]

/* ------------------------------------------------------------------ */
/* CME equity-index futures (MNQ) — the master clock. US-centric.      */
/* Full trading days (23h) EXCEPT these observed holidays; NYSE closed */
/* days like MLK/Presidents/Memorial/Labor are normal CME days.        */
/* ------------------------------------------------------------------ */

function cmeHolidaysForYear(year: number): Date[] {
  return [
    new Date(year, 0, 1), // New Year's
    addDays(easterSunday(year), -2), // Good Friday
    new Date(year, 5, 19), // Juneteenth
    new Date(year, 6, 4), // Independence Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving
    new Date(year, 11, 25), // Christmas
  ].map(observed)
}

/* [rule, reason, ctHh, ctMm] — the CT wall-clock time of the modified
 * session event for each early-close day. The standard half-days close at
 * 13:15 CT; the day before a Friday-observed Independence Day closes at
 * 12:00 CT (owner-provided 2026 CME schedule). Display always converts to
 * HKT via ctToHktHhmm — never shows the raw CT time. */
const cmeEarlyCloseRules: [(y: number) => Date | null, string, number, number][] = [
  [(y) => addDays(nthWeekday(y, 10, 4, 4), 1), 'day after Thanksgiving', 13, 15],
  [(y) => new Date(y, 11, 24), 'Christmas Eve', 13, 15],
  [(y) => new Date(y, 11, 31), "New Year's Eve", 13, 15],
  // Day before Independence Day when July 4 falls on Saturday
  // (Independence Day observed on Friday Jul 3 → Thursday Jul 2 early close).
  [
    (y) => {
      const jul4 = new Date(y, 6, 4)
      return jul4.getDay() === 6 ? addDays(jul4, -2) : null
    },
    'day before Independence Day',
    12,
    0,
  ],
]

/* CME equity-index futures: low-volume / modified-hours days. These are
 * NYSE-observed bank holidays that the CME does NOT close for, but it
 * shortens the session to a morning half (halt ~12:00 PM CT, reopen
 * ~5:00 PM CT). The owner trades from Asia and wants these flagged
 * because volume is thin and price action is messy. */
const cmeEarlyHaltRules: [(y: number) => Date, string, number, number][] = [
  [(y) => nthWeekday(y, 0, 1, 3), 'MLK Day', 12, 0],
  [(y) => nthWeekday(y, 1, 1, 3), "Presidents' Day", 12, 0],
  [(y) => lastWeekday(y, 4, 1), 'Memorial Day', 12, 0],
]

/** Deterministic CME equity-index-futures day status (master clock). */
export function cmeDay(iso: string): MarketDay {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  if (dow === 0 || dow === 6) return { status: 'closed', label: 'weekend' }

  for (const yy of [y - 1, y, y + 1]) {
    for (const h of cmeHolidaysForYear(yy)) {
      if (isoFromDate(h) === iso) return { status: 'closed', label: 'holiday' }
    }
  }
  // Early-halt (MLK / Presidents / Memorial): the morning session runs,
  // a 5-hour halt starts ~12:00 PM CT, then a normal afternoon session.
  for (const [rule] of cmeEarlyHaltRules) {
    const e = rule(y)
    if (e && isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) {
      return { status: 'early-halt', label: 'early halt' }
    }
  }
  for (const [rule] of cmeEarlyCloseRules) {
    const e = rule(y)
    if (e && isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) {
      return { status: 'early', label: 'early close' }
    }
  }
  return { status: 'open', label: 'open' }
}

export interface CmeModifiedTime {
  hh: number
  mm: number
  kind: 'halt' | 'close'
}

/** The CT wall-clock time of the modified-session event for `iso`, or null. */
export function cmeModifiedCt(iso: string): CmeModifiedTime | null {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  if (dow === 0 || dow === 6) return null
  for (const [rule, , hh, mm] of cmeEarlyHaltRules) {
    const e = rule(y)
    if (e && isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) return { hh, mm, kind: 'halt' }
  }
  for (const [rule, , hh, mm] of cmeEarlyCloseRules) {
    const e = rule(y)
    if (e && isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) return { hh, mm, kind: 'close' }
  }
  return null
}

/** Deterministic US-market status for a calendar day. */
export function marketDay(iso: string): MarketDay {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  if (dow === 0 || dow === 6) return { status: 'closed', label: 'weekend' }

  for (const yy of [y - 1, y, y + 1]) {
    for (const h of holidaysForYear(yy)) {
      if (isoFromDate(h) === iso) return { status: 'closed', label: 'holiday' }
    }
  }
  for (const rule of earlyCloseRules) {
    const e = rule(y)
    if (isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) {
      return { status: 'early', label: 'early close' }
    }
  }
  return { status: 'open', label: 'open' }
}

/** Market-state marker for the live widget header. Labels are HKT — the
 * site is HKT everywhere, so a CT time is never shown. DST-aware. */
export function marketMarker(iso: string): { glyph: string; text: string; status: MarketStatus } {
  const m = cmeDay(iso)
  if (m.status === 'open') return { glyph: '●', text: 'open', status: m.status }
  if (m.status === 'early-halt' || m.status === 'early') {
    const mt = cmeModifiedCt(iso)
    const hkt = mt ? ctToHktHhmm(iso, mt.hh, mt.mm) : '--:--'
    const verb = m.status === 'early-halt' ? 'early halt' : 'early close'
    return { glyph: '◐', text: `${verb} ${hkt} hkt`, status: m.status }
  }
  return { glyph: '✕', text: `closed · ${m.label}`, status: m.status }
}

/** Compact per-year schedule for the client-side live marker: observed US holidays + early closes. */
export function marketSchedule(year: number): { holidays: string[]; earlyCloses: string[] } {
  const holidays = holidaysForYear(year).map(isoFromDate)
  const earlyCloses: string[] = []
  for (const rule of earlyCloseRules) {
    const e = rule(year)
    if (e.getDay() !== 0 && e.getDay() !== 6) earlyCloses.push(isoFromDate(e))
  }
  return { holidays, earlyCloses }
}

/* ------------------------------------------------------------------ */
/* Modified-hours day lookup. The owner only looks at zen and needs    */
/* to know in advance when CME will be shortened so they don't get     */
/* caught in thin-volume Asia-hours mess. Scans the next `withinDays`  */
/* days from `fromIso` for any early-halt (MLK/Presidents/Memorial) or */
/* early-close (day after Thanksgiving, Christmas Eve, NYE, day before*/
/* a Friday-observed Independence Day). Returns the soonest match.     */
/* ------------------------------------------------------------------ */

export interface ModifiedHoursDay {
  iso: string
  kind: 'early-halt' | 'early-close'
  /** Human label for the reason: "MLK Day", "day before Independence Day", … */
  reason: string
  daysAway: number
}

/** All modified-hours days in a given year, sorted by date. */
function modifiedHoursDaysInYear(year: number): { iso: string; kind: 'early-halt' | 'early-close'; reason: string }[] {
  const out: { iso: string; kind: 'early-halt' | 'early-close'; reason: string }[] = []
  for (const [rule, reason] of cmeEarlyHaltRules) {
    const e = rule(year)
    if (e && e.getDay() !== 0 && e.getDay() !== 6) {
      out.push({ iso: isoFromDate(e), kind: 'early-halt', reason })
    }
  }
  for (const [rule, reason] of cmeEarlyCloseRules) {
    const e = rule(year)
    if (e && e.getDay() !== 0 && e.getDay() !== 6) {
      out.push({ iso: isoFromDate(e), kind: 'early-close', reason })
    }
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso))
}

/** The next modified-hours day strictly after `fromIso` (or on it), within `withinDays`. */
export function nextModifiedHoursDay(fromIso: string, withinDays = 90): ModifiedHoursDay | null {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const horizonMs = fromMs + withinDays * 86400000
  const years = new Set<number>([fy, fy + 1])
  const candidates: ModifiedHoursDay[] = []
  for (const y of years) {
    for (const d of modifiedHoursDaysInYear(y)) {
      const [y2, m2, d2] = d.iso.split('-').map(Number)
      const ms = Date.UTC(y2, m2 - 1, d2)
      if (ms >= fromMs && ms <= horizonMs) {
        candidates.push({ ...d, daysAway: Math.round((ms - fromMs) / 86400000) })
      }
    }
  }
  candidates.sort((a, b) => a.iso.localeCompare(b.iso))
  return candidates[0] ?? null
}
