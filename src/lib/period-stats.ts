// Period aggregation — R / win-rate / profit-factor / per-account pnl /
// per-model / life metrics over any PeriodRange, plus prev↔cur deltas and a
// rolling trend series. R math comes exclusively from ./stream (ROf) — never
// re-implemented here.

import { ROf, type DayData } from './stream'
import { periodRange, periodRangesBetween, publicAnchor, slugFromType, type PeriodRange, type PeriodType } from './periods'

export interface PeriodStats {
  daysCount: number
  tradedDays: number
  trades: number
  sumR: number
  expectancyR: number
  winRate: number
  profitFactor: number
  pnlByAccount: { account: string; pnl: number }[]
  modelStats: { model: string; count: number; sumR: number }[]
  avgSleep: number | null
  avgMood: number | null
  habitAdherence: { habit: string; pct: number }[]
  avgScreenHours: number | null
}

export interface PeriodDelta {
  field: string
  cur: number
  prev: number
  delta: number
  pct: number | null
}

export interface TrendPoint {
  label: string
  sumR: number
  winRate: number
  trades: number
}

export interface PeriodStatsCtx {
  habits: { id: string; kind: 'bool' | 'count'; target?: number }[]
  accounts: { id: string; pointsValue: number }[]
}

const DELTA_FIELDS = ['sumR', 'expectancyR', 'winRate', 'profitFactor', 'trades', 'tradedDays'] as const

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Aggregate the metrics of one period. Days are filtered to `startIso..endIso`
 * (inclusive; ISO strings sort chronologically). R per trade via `ROf`.
 */
export function aggregatePeriod(days: DayData[], range: PeriodRange, ctx: PeriodStatsCtx): PeriodStats {
  const inRange = days.filter((d) => d.date >= range.startIso && d.date <= range.endIso)

  // --- trades / R ---
  let sumR = 0
  let wins = 0
  let grossWin = 0
  let grossLoss = 0
  let tradedDays = 0
  for (const d of inRange) {
    if (d.trades.length > 0) tradedDays++
    for (const t of d.trades) {
      const r = ROf(t)
      sumR += r
      if (r > 0) { wins++; grossWin += r }
      else if (r < 0) grossLoss += -r // |grossLoss|
    }
  }
  const trades = inRange.reduce((s, d) => s + d.trades.length, 0)
  const expectancyR = trades > 0 ? sumR / trades : 0
  const winRate = trades > 0 ? wins / trades : 0
  // ∞ when there were winners but no losers; 0 when nothing was won (or nothing traded)
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0

  // --- per-account $ pnl (unknown account → skipped) ---
  const pnl = new Map<string, number>()
  for (const d of inRange) {
    for (const t of d.trades) {
      for (const ex of t.executions ?? []) {
        const acct = ctx.accounts.find((a) => a.id === ex.account)
        if (!acct) continue
        const p = t.points * acct.pointsValue * (ex.size ?? 1)
        pnl.set(ex.account, (pnl.get(ex.account) ?? 0) + p)
      }
    }
  }
  const pnlByAccount = [...pnl.entries()].map(([account, pnlValue]) => ({ account, pnl: pnlValue }))

  // --- per-model stats (tagged trades only) ---
  const models = new Map<string, { count: number; sumR: number }>()
  for (const d of inRange) {
    for (const t of d.trades) {
      if (!t.model) continue
      const cur = models.get(t.model) ?? { count: 0, sumR: 0 }
      cur.count++
      cur.sumR += ROf(t)
      models.set(t.model, cur)
    }
  }
  const modelStats = [...models.entries()].map(([model, v]) => ({ model, count: v.count, sumR: v.sumR }))

  // --- life metrics: averages over in-range days that record the value ---
  let sleepSum = 0, sleepCount = 0
  let moodSum = 0, moodCount = 0
  let screenSum = 0, screenCount = 0
  for (const d of inRange) {
    if (d.sleep?.hours !== undefined) { sleepSum += d.sleep.hours; sleepCount++ }
    if (d.mood !== undefined) { moodSum += d.mood; moodCount++ }
    const screen = (d.device?.iphoneHours ?? 0) + (d.device?.macHours ?? 0)
    if (d.device?.iphoneHours !== undefined || d.device?.macHours !== undefined) { screenSum += screen; screenCount++ }
  }
  const avgSleep = sleepCount > 0 ? sleepSum / sleepCount : null
  const avgMood = moodCount > 0 ? moodSum / moodCount : null
  const avgScreenHours = screenCount > 0 ? screenSum / screenCount : null

  // --- habit adherence: pct of in-range days that satisfied the habit ---
  const habitAdherence = ctx.habits.map((h) => {
    let done = 0
    for (const d of inRange) {
      const v = d.habits?.[h.id]
      if (h.kind === 'count') {
        if (typeof v === 'number' && v >= (h.target ?? 1)) done++
      } else {
        if (v === true) done++
      }
    }
    return { habit: h.id, pct: inRange.length > 0 ? (done / inRange.length) * 100 : 0 }
  })

  return {
    daysCount: inRange.length,
    tradedDays,
    trades,
    sumR,
    expectancyR,
    winRate,
    profitFactor,
    pnlByAccount,
    modelStats,
    avgSleep,
    avgMood,
    habitAdherence,
    avgScreenHours,
  }
}

/**
 * prev↔cur deltas over the numeric headline fields. `pct` is rounded to 3dp
 * and is null whenever `prev` is 0.
 */
export function periodDelta(prev: PeriodStats, cur: PeriodStats): PeriodDelta[] {
  return DELTA_FIELDS.map((field) => {
    const p = prev[field]
    const c = cur[field]
    return {
      field,
      cur: c,
      prev: p,
      delta: c - p,
      pct: p !== 0 ? round3((c - p) / Math.abs(p)) : null,
    }
  })
}

/**
 * Rolling trend: the last `n` periods ending at the latest in-range day,
 * oldest → newest. Each point aggregates its whole period over `days`.
 */
export function trendSeries(type: PeriodType, days: DayData[], n: number, ctx: PeriodStatsCtx): TrendPoint[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const ranges = periodRangesBetween(type, sorted[0].date, sorted[sorted.length - 1].date).slice(-n)
  return ranges.map((range) => {
    const s = aggregatePeriod(days, range, ctx)
    return { label: range.label, sumR: s.sumR, winRate: s.winRate, trades: s.trades }
  })
}

export interface TapePoint {
  href: string       // canonical URL, e.g. '/week/2026-33' or '/q1/2026'
  short: string      // 'w33' | 'aug' | 'q1' | 'h1' | '2026'
  sumR: number       // that period's sumR
  cumulative: number // running total of sumR through this period
  current: boolean   // the period containing todayIso
}

export interface LadderEntry {
  label: string // 'day' | 'week' | 'month' | 'quarter' | 'year'
  sumR: number
}

function tapeShort(type: PeriodType, range: PeriodRange): string {
  switch (type) {
    case 'week': return `w${range.index}`
    case 'month': return range.label.split(' ')[0]
    case 'quarter': return `q${range.index}`
    case 'half': return `h${range.index}`
    case 'year': return range.label
  }
}

/**
 * The tape — chronological periods with day data (oldest first), each with its
 * sumR and the running cumulative R (the compounding arc the SVG draws). The
 * current period is ALWAYS the final point (appended at 0-R when it has no data
 * yet) and marked `current` — the tape always extends to now.
 */
export function buildTape(type: PeriodType, days: DayData[], ctx: PeriodStatsCtx, todayIso: string): TapePoint[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const ranges = periodRangesBetween(type, sorted[0].date, todayIso)
  const currentAnchor = periodRange(type, todayIso).anchor
  const points: TapePoint[] = []
  let cumulative = 0
  for (const range of ranges) {
    const s = aggregatePeriod(days, range, ctx)
    if (range.anchor === currentAnchor) {
      cumulative = round3(cumulative + s.sumR)
      points.push({
        href: `/${slugFromType(type, range.index)}/${publicAnchor(type, range.anchor)}`,
        short: tapeShort(type, range),
        sumR: s.sumR,
        cumulative,
        current: true,
      })
      break
    }
    if (s.daysCount === 0) continue // data-only for past periods
    cumulative = round3(cumulative + s.sumR)
    points.push({
      href: `/${slugFromType(type, range.index)}/${publicAnchor(type, range.anchor)}`,
      short: tapeShort(type, range),
      sumR: s.sumR,
      cumulative,
      current: false,
    })
  }
  return points
}

/**
 * The to-date ladder — cumulative R at each horizon containing today:
 * day · week · month · quarter · year. Day = today's trades; the rest are the
 * current period of each horizon.
 */
export function toDateLadder(days: DayData[], todayIso: string, ctx: PeriodStatsCtx): LadderEntry[] {
  const today = days.find((d) => d.date === todayIso)
  const daySumR = today ? round3(today.trades.reduce((s, t) => s + ROf(t), 0)) : 0
  const horizon = (type: PeriodType): number => round3(aggregatePeriod(days, periodRange(type, todayIso), ctx).sumR)
  return [
    { label: 'day', sumR: daySumR },
    { label: 'week', sumR: horizon('week') },
    { label: 'month', sumR: horizon('month') },
    { label: 'quarter', sumR: horizon('quarter') },
    { label: 'year', sumR: horizon('year') },
  ]
}
