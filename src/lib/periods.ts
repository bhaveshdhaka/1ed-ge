// Period engine — horizon-agnostic week/month/quarter/half/year ranges.
// All arithmetic is on plain ISO date strings (YYYY-MM-DD, HKT dates). No TZ math.

export type PeriodType = 'week' | 'month' | 'quarter' | 'half' | 'year'

export const PERIOD_TYPES: PeriodType[] = ['week', 'month', 'quarter', 'half', 'year']

export interface PeriodRange {
  type: PeriodType
  anchor: string            // '2026-33' | '2026-08' | '2026-q1' | '2026-h1' | '2026'
  label: string             // 'week 33' | 'aug 2026' | 'q1 2026' | 'h1 2026' | '2026'
  startIso: string          // inclusive YYYY-MM-DD (HKT date)
  endIso: string            // inclusive
  index: number             // 1-based within the year
  prev: PeriodRange
  next: PeriodRange
}

export function periodTypeFromSlug(slug: string): PeriodType | null {   // 'q1'→'quarter', 'h1'→'half', valid type names pass through
  if (slug === 'week' || slug === 'month' || slug === 'year') return slug
  if (/^q[1-4]$/.test(slug)) return 'quarter'
  if (/^h[12]$/.test(slug)) return 'half'
  return null
}

export function slugFromType(type: PeriodType, index: number): string { // 'quarter',1 → 'q1'
  if (type === 'quarter') return `q${index}`
  if (type === 'half') return `h${index}`
  return type
}

export function periodAnchor(type: PeriodType, iso: string): string {
  return periodRange(type, iso).anchor
}

export function isoFromAnchor(type: PeriodType, urlAnchor: string, index?: number): string {
  const [yStr, ...rest] = urlAnchor.split('-')
  const y = Number(yStr)
  if (!Number.isInteger(y)) throw new Error(`bad anchor: ${urlAnchor}`)
  switch (type) {
    case 'year': return `${y}-01-01`
    case 'quarter': {
      const q = index ?? embeddedIndex(urlAnchor, 'q', 1, 4) ?? 1
      if (q < 1 || q > 4) throw new Error(`bad quarter index: ${q}`)
      return `${y}-${pad(q * 3 - 1)}-15`
    }
    case 'half': {
      const h = index ?? embeddedIndex(urlAnchor, 'h', 1, 2) ?? 1
      if (h < 1 || h > 2) throw new Error(`bad half index: ${h}`)
      return `${y}-${pad(h === 1 ? 4 : 10)}-15`
    }
    case 'month': {
      const mm = Number(rest[0])
      if (!Number.isInteger(mm) || mm < 1 || mm > 12) throw new Error(`bad month anchor: ${urlAnchor}`)
      return `${y}-${pad(mm)}-01`
    }
    case 'week': {
      const w = Number(rest[0])
      if (!Number.isInteger(w) || w < 1 || w > 53) throw new Error(`bad week anchor: ${urlAnchor}`)
      const jan4 = new Date(Date.UTC(y, 0, 4))
      const week1Mon = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS)
      return toIso(new Date(week1Mon.getTime() + (w - 1) * 7 * DAY_MS))
    }
  }
}

export function periodRange(type: PeriodType, representativeIso: string): PeriodRange {
  const [y, m] = representativeIso.split('-').map(Number)
  const base = (startIso: string, endIso: string, anchor: string, label: string, index: number): PeriodRange => {
    const rep = (dir: number): string => {
      switch (type) {
        case 'week': return addDays(startIso, dir * 7)
        case 'month': return shiftMonth(startIso, dir)
        case 'quarter': return shiftMonth(startIso, dir * 3)
        case 'half': return shiftMonth(startIso, dir * 6)
        case 'year': return `${y + dir}-06-15`
      }
    }
    // prev/next are lazy getters: eager evaluation would recurse infinitely
    // (periodRange → base → periodRange has no base case). A getter computes
    // exactly one adjacent range on access, so .prev/.next chains terminate.
    const range: PeriodRange = {
      type,
      anchor,
      label,
      startIso,
      endIso,
      index,
      get prev() { return periodRange(type, rep(-1)) },
      get next() { return periodRange(type, rep(1)) },
    }
    return range
  }
  switch (type) {
    case 'week': {
      const start = mondayOf(representativeIso)
      const thu = new Date(parseIso(start).getTime() + 3 * DAY_MS)
      const isoYear = thu.getUTCFullYear()
      const weekNo = isoWeekNumber(start)
      // Trading week = Mon–Fri only (owner-locked): weekend day records fall
      // outside every week and flow into month/quarter reviews. prev/next still
      // step by 7 days so consecutive weeks tile the calendar without gaps.
      return base(start, addDays(start, 4), `${isoYear}-${pad(weekNo)}`, `week ${weekNo}`, weekNo)
    }
    case 'month': {
      const start = `${y}-${pad(m)}-01`
      return base(start, `${y}-${pad(m)}-${lastDayOfMonth(y, m)}`, `${y}-${pad(m)}`, `${MON[m - 1]} ${y}`, m)
    }
    case 'quarter': {
      const q = Math.floor((m - 1) / 3) + 1
      const sm = q * 3 - 2, em = q * 3
      return base(`${y}-${pad(sm)}-01`, `${y}-${pad(em)}-${lastDayOfMonth(y, em)}`, `${y}-q${q}`, `q${q} ${y}`, q)
    }
    case 'half': {
      const h = m <= 6 ? 1 : 2
      const sm = h === 1 ? 1 : 7, em = h === 1 ? 6 : 12
      return base(`${y}-${pad(sm)}-01`, `${y}-${pad(em)}-${lastDayOfMonth(y, em)}`, `${y}-h${h}`, `h${h} ${y}`, h)
    }
    case 'year':
      return base(`${y}-01-01`, `${y}-12-31`, `${y}`, `${y}`, 1)
  }
}

export function periodRangesBetween(type: PeriodType, fromIso: string, toIso: string): PeriodRange[] {
  const out: PeriodRange[] = []
  let cur = periodRange(type, fromIso)
  let guard = 0
  // ISO strings sort chronologically
  while (cur.startIso <= toIso && guard < 2000) {
    out.push(cur)
    cur = cur.next
    guard++
  }
  return out
}

// --- plain-ISO date helpers (no TZ) ---

const DAY_MS = 86400000
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Parse an embedded '-qN' / '-hN' suffix ('2026-q2' → 2). Returns null when absent, throws on out-of-range. */
function embeddedIndex(anchor: string, letter: 'q' | 'h', min: number, max: number): number | null {
  const m = new RegExp(`-${letter}([1-9]\\d*)$`).exec(anchor)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`bad ${letter} index: ${n}`)
  return n
}

function parseIso(iso: string): Date { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
function toIso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(iso: string, n: number): string { return toIso(new Date(parseIso(iso).getTime() + n * DAY_MS)) }
function pad(n: number): string { return String(n).padStart(2, '0') }
function mondayOf(iso: string): string { const d = parseIso(iso); return toIso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS)) }
function isoWeekNumber(iso: string): number {
  const d = parseIso(iso)
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAY_MS)
  const y = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const week1Thu = new Date(jan4.getTime() + (3 - ((jan4.getUTCDay() + 6) % 7)) * DAY_MS)
  return 1 + Math.round((thursday.getTime() - week1Thu.getTime()) / (7 * DAY_MS))
}
function lastDayOfMonth(y: number, m: number): number { return new Date(Date.UTC(y, m, 0)).getUTCDate() }  // m = 1..12
function shiftMonth(iso: string, n: number): string { const [y, m] = iso.split('-').map(Number); return toIso(new Date(Date.UTC(y, m - 1 + n, 15))) }
