import { marketEvents, addDaysIso, todayHkt } from './sessions'
import type { MarketEvent, MarketKey } from './sessions'

export interface TimelineBand {
  market: MarketKey
  left: number
  width: number
}
export interface HazardDot {
  title: string
  time: string
  left: number
  kind: 'red' | 'orange'
}
export interface NextEvent {
  label: string
  when: string
}
export interface TimelineData {
  bands: TimelineBand[]
  hazards: HazardDot[]
  nowLeft: number | null
  next: NextEvent | null
}

export function minsHM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export function pctOfDay(hhmm: string): number {
  return (minsHM(hhmm) / 1440) * 100
}

const DAY = 1440

/** Absolute minutes of an HKT instant since `iso` 00:00 HKT. */
function absMins(iso: string, hkt: string): number {
  const base = Date.parse(iso + 'T00:00:00+08:00')
  const day = Date.parse(hkt.slice(0, 10) + 'T00:00:00+08:00')
  return (day - base) / 60000 + minsHM(hkt.slice(11, 16))
}

/** Events → per-market [start, end] windows in absolute minutes since `iso` 00:00 HKT. */
function windows(iso: string, evs: MarketEvent[]): Map<MarketKey, Array<[number, number]>> {
  const absMin = (hkt: string) => absMins(iso, hkt)
  const openAt = new Map<MarketKey, number>()
  const out = new Map<MarketKey, Array<[number, number]>>()
  const push = (m: MarketKey, s: number, e: number) => {
    if (!out.has(m)) out.set(m, [])
    out.get(m)!.push([s, e])
  }
  for (const e of evs) {
    const m = absMin(e.hkt)
    if (e.type === 'open' || e.type === 'resume') openAt.set(e.market, m)
    else if (e.type === 'close' || e.type === 'halt') {
      const s = openAt.get(e.market)
      if (s !== undefined) {
        push(e.market, s, m)
        openAt.delete(e.market)
      }
    }
  }
  // a session still open at end of window: close it at iso+1 00:00
  for (const [m, s] of openAt) push(m, s, DAY)
  return out
}

export function buildTimeline(
  iso: string,
  red: { time: string; title: string }[],
  orange: { time: string; title: string }[],
): TimelineData {
  const evs = marketEvents(addDaysIso(iso, -1), 3)
  const bands: TimelineBand[] = []
  const seen = new Set<string>()
  for (const [market, ws] of windows(iso, evs)) {
    for (const [s, e] of ws) {
      const lo = Math.max(s, 0)
      const hi = Math.min(e, DAY)
      if (hi <= lo) continue
      const key = `${market}:${lo}:${hi}`
      if (seen.has(key)) continue
      seen.add(key)
      bands.push({ market, left: (lo / DAY) * 100, width: ((hi - lo) / DAY) * 100 })
    }
  }

  const hazards: HazardDot[] = [
    ...red.map((r) => ({ title: r.title, time: r.time, left: pctOfDay(r.time), kind: 'red' as const })),
    ...orange.map((o) => ({ title: o.title, time: o.time, left: pctOfDay(o.time), kind: 'orange' as const })),
  ].sort((a, b) => a.left - b.left)

  const now = todayHkt() === iso
  let nowLeft: number | null = null
  if (now) {
    const d = new Date(Date.now() + 8 * 3600 * 1000)
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    nowLeft = pctOfDay(`${hh}:${mm}`)
  }

  let next: NextEvent | null = null
  if (now) {
    const d = new Date(Date.now() + 8 * 3600 * 1000)
    const nowAbs = d.getUTCHours() * 60 + d.getUTCMinutes()
    const mk = (label: string, m: number) => {
      if (m <= nowAbs) return
      const mins = m - nowAbs
      const when = mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`
      if (!next || m < nextM) { next = { label, when }; nextM = m }
    }
    let nextM = Infinity
    for (const e of evs) {
      if (e.hkt.slice(0, 10) === iso || Date.parse(e.hkt.slice(0, 10) + 'T00:00:00+08:00') - Date.parse(iso + 'T00:00:00+08:00') === 86400000) {
        mk(marketLabel(e), absMins(iso, e.hkt))
      }
    }
    for (const h of hazards) mk(`${h.title} · ${h.time}`, minsHM(h.time))
  }

  return { bands, hazards, nowLeft, next }
}

function marketLabel(e: MarketEvent): string {
  const names: Record<MarketKey, string> = { cme: 'CME', tse: 'TSE', lse: 'LSE', nyse: 'NYSE' }
  const t: Record<string, string> = { open: 'open', close: 'close', halt: 'halt', resume: 'resume' }
  return `${names[e.market]} ${t[e.type]}`
}
