import { addDays, easterSunday, isoFromDate, lastWeekday, marketDay, cmeDay, nthWeekday } from './market'
export type MarketKey = 'cme' | 'tse' | 'lse' | 'nyse'

export interface MarketEvent {
  market: MarketKey
  type: 'open' | 'close' | 'halt' | 'resume'
  /** Absolute HKT wall time, e.g. "2026-08-07T21:30+08:00" */
  hkt: string
  label?: string
}

export const HKT_OFFSET_MS = 8 * 3600 * 1000

/** Offset of `tz` from UTC in minutes at the given instant. */
function tzOffsetMinutes(tz: string, date: Date): number {
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
function wallToUTC(tz: string, iso: string, hh: number, mm: number): number {
  const [y, m, d] = iso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off = tzOffsetMinutes(tz, new Date(guess))
  return guess - off * 60000
}

function hktIso(utcMs: number): string {
  const d = new Date(utcMs + HKT_OFFSET_MS)
  return d.toISOString().slice(0, 16) + '+08:00'
}

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function dow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function todayHkt(): string {
  return new Date(Date.now() + HKT_OFFSET_MS).toISOString().slice(0, 10)
}

/** Current HKT wall time — `YYYY-MM-DDTHH:MM` (the shape accountability uses). */
export function nowHkt(): string {
  return new Date(Date.now() + HKT_OFFSET_MS).toISOString().slice(0, 16)
}

/** HKT calendar-day number of a timestamp (the homepage last-seen span helper). */
export function hktDayNumber(ts: string | number): number {
  return Math.floor((Date.parse(String(ts)) + HKT_OFFSET_MS) / 86400000)
}

/* ------------------------------------------------------------------ */
/* Japan (TSE) — no DST. Fixed + floating holidays + equinox formula.  */
/* ------------------------------------------------------------------ */

export function japanHolidays(year: number): string[] {
  const out: Date[] = []
  out.push(new Date(year, 0, 1))
  out.push(new Date(year, 0, 2))
  out.push(nthWeekday(year, 0, 1, 2)) // Coming of Age — 2nd Mon Jan
  out.push(new Date(year, 1, 11)) // National Foundation Day
  out.push(new Date(year, 1, 23)) // Emperor's Birthday
  out.push(new Date(year, 2, Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)))) // Vernal Equinox
  out.push(new Date(year, 3, 29)) // Showa Day
  out.push(new Date(year, 4, 3)) // Constitution Memorial Day
  out.push(new Date(year, 4, 4)) // Greenery Day
  out.push(new Date(year, 4, 5)) // Children's Day
  out.push(nthWeekday(year, 6, 1, 3)) // Marine Day — 3rd Mon Jul
  out.push(new Date(year, 7, 11)) // Mountain Day
  out.push(nthWeekday(year, 8, 1, 3)) // Respect for the Aged Day — 3rd Mon Sep
  out.push(new Date(year, 8, Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)))) // Autumnal Equinox
  out.push(nthWeekday(year, 9, 1, 2)) // Sports Day — 2nd Mon Oct
  out.push(new Date(year, 10, 3)) // Culture Day
  out.push(new Date(year, 10, 23)) // Labor Thanksgiving Day
  // substitute holiday: a national holiday on Sunday → the next day that is
  // itself not already a holiday/weekend becomes a holiday (chains handled).
  const base = [...out]
  const holidaysSet = new Set(base.map(isoFromDate))
  const added: string[] = []
  for (const d of base) {
    if (d.getDay() === 0) {
      let sub = addDays(d, 1)
      while (holidaysSet.has(isoFromDate(sub)) || sub.getDay() === 0 || sub.getDay() === 6) {
        sub = addDays(sub, 1)
      }
      added.push(isoFromDate(sub))
    }
  }
  return [...new Set([...holidaysSet, ...added])]
}

/* ------------------------------------------------------------------ */
/* UK (LSE) — BST/GMT via Intl. England & Wales bank holidays.         */
/* ------------------------------------------------------------------ */

export function ukHolidays(year: number): string[] {
  const out: Date[] = []
  const ny = new Date(year, 0, 1)
  out.push(ny.getDay() === 6 ? addDays(ny, 2) : ny.getDay() === 0 ? addDays(ny, 1) : ny)
  out.push(addDays(easterSunday(year), -2)) // Good Friday
  out.push(addDays(easterSunday(year), 1)) // Easter Monday
  out.push(nthWeekday(year, 4, 1, 1)) // Early May bank holiday
  out.push(lastWeekday(year, 4, 1)) // Spring bank holiday
  out.push(lastWeekday(year, 7, 1)) // Summer bank holiday
  const shift = (d: Date) => (d.getDay() === 0 || d.getDay() === 6 ? addDays(d, 2) : d)
  out.push(shift(new Date(year, 11, 25))) // Christmas
  out.push(shift(new Date(year, 11, 26))) // Boxing Day
  return [...new Set(out.map(isoFromDate))]
}

function isTradingDay(iso: string, holidays: Set<string>): boolean {
  const w = dow(iso)
  return w !== 0 && w !== 6 && !holidays.has(iso)
}

/* ------------------------------------------------------------------ */
/* Events — one list, sorted, absolute HKT instants.                   */
/* ------------------------------------------------------------------ */

export function marketEvents(startHkt: string, days: number): MarketEvent[] {
  const years = new Set<number>()
  for (let i = -1; i < days + 2; i++) years.add(+addDaysIso(startHkt, i).slice(0, 4))
  const jpH = new Set<string>()
  const ukH = new Set<string>()
  for (const y of years) {
    for (const h of japanHolidays(y)) jpH.add(h)
    for (const h of ukHolidays(y)) ukH.add(h)
  }

  const out: MarketEvent[] = []
  for (let i = -1; i < days + 2; i++) {
    const d = addDaysIso(startHkt, i)
    const us = marketDay(d)
    const cm = cmeDay(d)
    const w = dow(d)

    // CME equity-index futures (CT date = d) — the master clock.
    // If CME is totally closed for the day, no exchange trades CME futures,
    // so ALL session bands (NYSE/TSE/LSE) are suppressed that day too.
    if (cm.status !== 'closed') {
      if (us.status !== 'closed') {
        // NYSE equity cash session (ET date = d) — a band on the CME clock
        out.push({ market: 'nyse', type: 'open', hkt: hktIso(wallToUTC('America/New_York', d, 9, 30)) })
        out.push({
          market: 'nyse',
          type: 'close',
          hkt: hktIso(wallToUTC('America/New_York', d, us.status === 'early' ? 13 : 16, 0)),
          label: us.status === 'early' ? 'half day' : undefined,
        })
      }

      if (cm.status === 'early') {
        out.push({ market: 'cme', type: 'close', hkt: hktIso(wallToUTC('America/Chicago', d, 13, 15)), label: 'early close' })
      } else if (w === 5) {
        out.push({ market: 'cme', type: 'close', hkt: hktIso(wallToUTC('America/Chicago', d, 16, 0)), label: 'weekend close' })
      } else if (w !== 0 && w !== 6) {
        out.push({ market: 'cme', type: 'halt', hkt: hktIso(wallToUTC('America/Chicago', d, 16, 0)), label: 'maintenance halt' })
        out.push({ market: 'cme', type: 'resume', hkt: hktIso(wallToUTC('America/Chicago', d, 17, 0)) })
      }
    }
    // CME reopen Sunday 5pm CT when the following Monday is a CME trading day
    if (dow(d) === 0) {
      const mon = addDaysIso(d, 1)
      if (cmeDay(mon).status !== 'closed') {
        out.push({ market: 'cme', type: 'open', hkt: hktIso(wallToUTC('America/Chicago', d, 17, 0)), label: 'reopen' })
      }
    }

    if (cm.status !== 'closed' && isTradingDay(d, jpH)) {
      // TSE (JST date = d): 09:00–11:30 lunch 12:30–15:30 — only on CME trading days
      out.push({ market: 'tse', type: 'open', hkt: hktIso(wallToUTC('Asia/Tokyo', d, 9, 0)) })
      out.push({ market: 'tse', type: 'close', hkt: hktIso(wallToUTC('Asia/Tokyo', d, 11, 30)), label: 'lunch' })
      out.push({ market: 'tse', type: 'open', hkt: hktIso(wallToUTC('Asia/Tokyo', d, 12, 30)) })
      out.push({ market: 'tse', type: 'close', hkt: hktIso(wallToUTC('Asia/Tokyo', d, 15, 30)) })
    }

    if (cm.status !== 'closed' && isTradingDay(d, ukH)) {
      // LSE (London date = d): 08:00–16:30 — only on CME trading days
      out.push({ market: 'lse', type: 'open', hkt: hktIso(wallToUTC('Europe/London', d, 8, 0)) })
      out.push({ market: 'lse', type: 'close', hkt: hktIso(wallToUTC('Europe/London', d, 16, 30)) })
    }
  }

  return out.sort((a, b) => a.hkt.localeCompare(b.hkt))
}

/* ------------------------------------------------------------------ */
/* Context-aware day marker.                                           */
/*  - today: LIVE marker (data-mkt-live drives the ticking countdown)  */
/*  - other dates: scheduled presentation — hollow ○ + session window, */
/*    never a green "● open" (which would imply it's open right now).  */
/* ------------------------------------------------------------------ */

export interface DayMarker {
  glyph: string
  text: string
  cls: 'text-up' | 'text-warn' | 'text-down' | 'text-dim'
  live: boolean
}

export function scheduledDayMarker(iso: string): DayMarker {
  const m = cmeDay(iso)
  if (m.status === 'closed') return { glyph: '✕', text: `closed · ${m.label}`, cls: 'text-down', live: false }
  if (m.status === 'early') return { glyph: '◐', text: 'early close 1:15pm ct', cls: 'text-warn', live: false }
  if (iso === todayHkt()) return { glyph: '●', text: 'open', cls: 'text-up', live: true }
  const cmeWin = daySessionWindows(iso).cme
  const suffix = cmeWin.startsWith('halt') ? `${cmeWin} hkt` : cmeWin === '~23h' ? '~23h' : ''
  return { glyph: '○', text: suffix ? `open · ${suffix}` : 'open', cls: 'text-dim', live: false }
}

/** Compact per-market session window for a date (HKT), e.g. NYSE "21:30→04:00". */
export function daySessionWindows(iso: string): Record<MarketKey, string> {
  const evs = marketEvents(iso, 1)
  const t = (h: string) => h.slice(11, 16)
  const day = (h: string) => h.slice(0, 10)
  const first = (market: MarketKey, type: string) => evs.find((e) => e.market === market && e.type === type && day(e.hkt) === iso)
  const after = (market: MarketKey, type: string, afterHkt: string) =>
    evs.find((e) => e.market === market && e.type === type && e.hkt > afterHkt)

  const nyseOpen = first('nyse', 'open')
  const nyseClose = nyseOpen ? after('nyse', 'close', nyseOpen.hkt) : undefined
  const nyse = nyseOpen ? `${t(nyseOpen.hkt)}→${nyseClose ? t(nyseClose.hkt) : '—'}` : '—'

  const tseOpen = first('tse', 'open')
  const tseCloses = tseOpen ? evs.filter((e) => e.market === 'tse' && e.type === 'close' && e.hkt > tseOpen.hkt) : []
  const tse = tseOpen ? `${t(tseOpen.hkt)}–${t(tseCloses[tseCloses.length - 1]?.hkt ?? '—')}` : '—'

  const lseOpen = first('lse', 'open')
  const lseClose = lseOpen ? after('lse', 'close', lseOpen.hkt) : undefined
  const lse = lseOpen ? `${t(lseOpen.hkt)}→${lseClose ? t(lseClose.hkt) : '—'}` : '—'

  const cm = cmeDay(iso)
  let cme: string
  if (cm.status === 'closed') {
    cme = 'closed'
  } else if (cm.status === 'early') {
    cme = 'early close 1:15pm ct'
  } else {
    const cmeHalt = first('cme', 'halt')
    const cmeResume = cmeHalt ? after('cme', 'resume', cmeHalt.hkt) : undefined
    cme = cmeHalt && cmeResume ? `halt ${t(cmeHalt.hkt)}–${t(cmeResume.hkt)}` : '~23h'
  }

  return { nyse, tse, lse, cme }
}
