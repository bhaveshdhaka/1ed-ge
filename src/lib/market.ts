export type MarketStatus = 'open' | 'early' | 'closed'

export interface MarketDay {
  status: MarketStatus
  label: string
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

const cmeEarlyCloseRules = [
  (y: number) => addDays(nthWeekday(y, 10, 4, 4), 1), // day after Thanksgiving
  (y: number) => new Date(y, 11, 24), // Christmas Eve
  (y: number) => new Date(y, 11, 31), // New Year's Eve
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
  for (const rule of cmeEarlyCloseRules) {
    const e = rule(y)
    if (isoFromDate(e) === iso && e.getDay() !== 0 && e.getDay() !== 6) {
      return { status: 'early', label: 'early close' }
    }
  }
  return { status: 'open', label: 'open' }
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

export function marketMarker(iso: string): { glyph: string; text: string; status: MarketStatus } {
  const m = cmeDay(iso)
  if (m.status === 'open') return { glyph: '●', text: 'open', status: m.status }
  if (m.status === 'early') return { glyph: '◐', text: 'early close 1:15pm ct', status: m.status }
  return { glyph: '✕', text: `closed · ${m.label}`, status: m.status }
}

/** Regular-session open/close in America/New_York (ET). Close is 1:00pm on early-close days. */
export function openCloseTimes(iso: string): { open: string; close: string } {
  const m = marketDay(iso)
  const close = m.status === 'early' ? '13:00' : '16:00'
  return { open: '09:30', close }
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
