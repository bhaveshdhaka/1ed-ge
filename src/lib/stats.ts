import type { CollectionEntry } from 'astro:content'
import { round2 } from './ai'

export type AccountEntry = CollectionEntry<'accounts'>
export type TradeEntry = CollectionEntry<'trades'>
export type HabitEntry = CollectionEntry<'habits'>
export type HabitLogEntry = CollectionEntry<'habitLog'>

export interface EnrichedTrade {
  slug: string
  date: string
  account: string
  accountLabel: string
  firm: string
  market: string
  session?: string
  direction: 'long' | 'short'
  setup?: string
  entry: number
  stop: number
  target?: number
  exit: number
  riskPoints: number
  points: number
  confidence?: number
  screenshots: string[]
  note?: string
  pointsValue: number
  R: number
  pnl: number
  risk: number
  win: boolean
}

export function enrichTrades(trades: TradeEntry[], accounts: AccountEntry[]): EnrichedTrade[] {
  const map = new Map(accounts.map((a) => [a.id, a]))
  return trades.map((t) => {
    const acc = map.get(t.data.account)
    const pv = acc?.data.pointsValue ?? 2
    const riskPoints = t.data.riskPoints
    const R = riskPoints > 0 ? t.data.points / riskPoints : 0
    const pnl = t.data.points * pv
    return {
      slug: t.id,
      ...t.data,
      accountLabel: acc?.data.sizeLabel ?? t.data.account,
      firm: acc?.data.firm ?? '—',
      pointsValue: pv,
      R,
      pnl,
      risk: riskPoints * pv,
      win: t.data.points > 0,
    }
  })
}

export interface AccountStat {
  id: string
  firm: string
  sizeLabel: string
  size: number
  drawdownLimit: number
  trailing: boolean
  contract: string
  riskPerTrade: number
  status: AccountEntry['data']['status']
  started: string
  ended?: string
  note?: string
  trades: number
  wins: number
  losses: number
  winRate: number | null
  points: number
  pnl: number
  sumR: number
  avgR: number
  profitFactor: number | null
  peakPnl: number
  ddFromPeak: number
  buffer: number
  ddUsedPct: number
}

export interface OverallStat {
  totalTrades: number
  wins: number
  losses: number
  winRate: number | null
  grossProfit: number
  grossLoss: number
  profitFactor: number | null
  sumR: number
  avgR: number
  expectancy: number
  bestR: number
  worstR: number
  avgWinR: number
  avgLossR: number
  maxDrawdownR: number
  maxDrawdownPnl: number
  equityR: { i: number; date: string; slug: string; r: number; equity: number }[]
  equityPnl: { i: number; date: string; slug: string; pnl: number; equity: number }[]
}

export function buildStats(trades: TradeEntry[], accounts: AccountEntry[]) {
  const list = enrichTrades(trades, accounts).sort((a, b) =>
    a.date === b.date ? a.slug.localeCompare(b.slug) : a.date.localeCompare(b.date),
  )

  const n = list.length
  const wins = list.filter((t) => t.win)
  const losses = list.filter((t) => !t.win)
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0)
  const sumR = list.reduce((s, t) => s + t.R, 0)
  const sumPnl = list.reduce((s, t) => s + t.pnl, 0)

  let equityR = 0
  let equityPnl = 0
  let peakR = 0
  let peakPnl = 0
  let maxDDR = 0
  let maxDDPnl = 0
  const curveR = list.map((t, i) => {
    equityR += t.R
    peakR = Math.max(peakR, equityR)
    maxDDR = Math.min(maxDDR, equityR - peakR)
    return { i, date: t.date, slug: t.slug, r: t.R, equity: round2(equityR) }
  })
  const curvePnl = list.map((t, i) => {
    equityPnl += t.pnl
    peakPnl = Math.max(peakPnl, equityPnl)
    maxDDPnl = Math.min(maxDDPnl, equityPnl - peakPnl)
    return { i, date: t.date, slug: t.slug, pnl: t.pnl, equity: round2(equityPnl) }
  })

  const overall: OverallStat = {
    totalTrades: n,
    wins: wins.length,
    losses: losses.length,
    winRate: n ? (wins.length / n) * 100 : null,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : null,
    sumR: round2(sumR),
    avgR: n ? round2(sumR / n) : 0,
    expectancy: n ? round2(sumR / n) : 0,
    bestR: n ? round2(Math.max(...list.map((t) => t.R))) : 0,
    worstR: n ? round2(Math.min(...list.map((t) => t.R))) : 0,
    avgWinR: wins.length ? round2(wins.reduce((s, t) => s + t.R, 0) / wins.length) : 0,
    avgLossR: losses.length ? round2(losses.reduce((s, t) => s + t.R, 0) / losses.length) : 0,
    maxDrawdownR: round2(maxDDR),
    maxDrawdownPnl: round2(maxDDPnl),
    equityR: curveR,
    equityPnl: curvePnl,
  }

  const perAccount: AccountStat[] = accounts
    .map((a) => {
      const t = list.filter((x) => x.account === a.id)
      const w = t.filter((x) => x.win)
      const l = t.filter((x) => !x.win)
      const gp = w.reduce((s, x) => s + x.pnl, 0)
      const gl = l.reduce((s, x) => s + Math.abs(x.pnl), 0)
      let eq = 0
      let peak = 0
      for (const x of t) {
        eq += x.pnl
        peak = Math.max(peak, eq)
      }
      const dd = Math.min(0, eq - peak)
      const buffer = Math.max(0, a.data.drawdownLimit + dd)
      const ddUsedPct = a.data.drawdownLimit > 0 ? Math.min(100, Math.max(0, (-dd / a.data.drawdownLimit) * 100)) : 0
      const sumR = t.reduce((s, x) => s + x.R, 0)
      return {
        id: a.id,
        firm: a.data.firm,
        sizeLabel: a.data.sizeLabel,
        size: a.data.size,
        drawdownLimit: a.data.drawdownLimit,
        trailing: a.data.trailing,
        contract: a.data.contract,
        riskPerTrade: a.data.riskPerTrade,
        status: a.data.status,
        started: a.data.started,
        ended: a.data.ended,
        note: a.data.note,
        trades: t.length,
        wins: w.length,
        losses: l.length,
        winRate: t.length ? (w.length / t.length) * 100 : null,
        points: round2(t.reduce((s, x) => s + x.points, 0)),
        pnl: round2(t.reduce((s, x) => s + x.pnl, 0)),
        sumR: round2(sumR),
        avgR: t.length ? round2(sumR / t.length) : 0,
        profitFactor: gl > 0 ? round2(gp / gl) : gp > 0 ? Infinity : null,
        peakPnl: round2(peak),
        ddFromPeak: round2(dd),
        buffer: round2(buffer),
        ddUsedPct,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const byDate = new Map<string, EnrichedTrade[]>()
  for (const t of list) {
    if (!byDate.has(t.date)) byDate.set(t.date, [])
    byDate.get(t.date)!.push(t)
  }

  return { list, overall, perAccount, byDate, sumPnl: round2(sumPnl) }
}

export function fmtPnl(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
export function fmtR(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${round2(n).toFixed(2)}R`
}
export function fmtPts(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
}
