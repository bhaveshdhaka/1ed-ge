import type { CollectionEntry } from 'astro:content'
import { round2 } from './utils'
import { riskOf, ROf } from './stream'

export type AccountEntry = CollectionEntry<'accounts'>
export type DayEntry = CollectionEntry<'days'>
export type PayoutEntry = CollectionEntry<'payouts'>
export type HabitEntry = CollectionEntry<'habits'>

export interface ExecutionRow {
  day: string
  tradeId: number
  account: string
  firm: string
  sizeLabel: string
  size: number
  market: string
  session?: string
  direction: 'long' | 'short'
  setup?: string
  entry: number
  exit: number
  stop?: number
  riskPoints: number
  points: number
  confidence?: number
  note?: string
  screenshots: string[]
  R: number
  pnl: number
  win: boolean
}

export function flatten(days: DayEntry[], accounts: AccountEntry[]): {
  executions: ExecutionRow[]
  trades: ExecutionRow[] // one row per trade-idea (first execution if any)
  daysWithTrades: number
} {
  const accMap = new Map(accounts.map((a) => [a.data.id, a]))
  const executions: ExecutionRow[] = []
  const tradeRows: ExecutionRow[] = []
  let daysWithTrades = 0

  for (const d of days) {
    if (d.data.trades.length) daysWithTrades++
    d.data.trades.forEach((t, ti) => {
      const risk = riskOf(t)
      const R = ROf(t)
      const accs = t.executions.length ? t.executions : [{ account: '__unlogged__' }]
      // idea-level row (uses first execution's account data for display)
      const first = accMap.get(accs[0].account)
      tradeRows.push({
        day: d.data.date,
        tradeId: ti,
        account: accs[0].account,
        firm: first?.data.firm ?? '—',
        sizeLabel: first?.data.sizeLabel ?? accs[0].account,
        size: accs[0].size ?? 1,
        market: t.market,
        session: t.session,
        direction: t.direction,
        setup: t.setup,
        entry: t.entry,
        exit: t.exit,
        stop: t.stop,
        riskPoints: round2(risk),
        points: t.points,
        confidence: t.confidence,
        note: t.note,
        screenshots: t.screenshots,
        R: round2(R),
        pnl: round2(t.points * (first?.data.pointsValue ?? 2) * (accs[0].size ?? 1)),
        win: t.points > 0,
      })
      for (const ex of accs) {
        const acc = accMap.get(ex.account)
        const pv = acc?.data.pointsValue ?? 2
        const size = ex.size ?? 1
        executions.push({
          day: d.data.date,
          tradeId: ti,
          account: ex.account,
          firm: acc?.data.firm ?? '—',
          sizeLabel: acc?.data.sizeLabel ?? ex.account,
          size,
          market: t.market,
          session: t.session,
          direction: t.direction,
          setup: t.setup,
          entry: t.entry,
          exit: t.exit,
          stop: t.stop,
          riskPoints: round2(risk),
          points: t.points,
          confidence: t.confidence,
          note: t.note,
          screenshots: t.screenshots,
          R: round2(R),
          pnl: round2(t.points * pv * size),
          win: t.points > 0,
        })
      }
    })
  }

  const sort = (a: ExecutionRow, b: ExecutionRow) =>
    a.day === b.day ? a.tradeId - b.tradeId : a.day.localeCompare(b.day)
  executions.sort(sort)
  tradeRows.sort(sort)
  return { executions, trades: tradeRows, daysWithTrades }
}

export interface AccountStat {
  id: string
  firm: string
  sizeLabel: string
  size: number
  drawdownLimit: number
  trailing: boolean
  riskPerTrade: number
  stage: AccountEntry['data']['stage']
  started: string
  note?: string
  active: boolean
  trades: number
  wins: number
  winRate: number | null
  points: number
  grossPnl: number
  payouts: number
  netPnl: number
  sumR: number
  profitFactor: number | null
  peakEq: number
  currentDD: number
  buffer: number
  ddUsedPct: number
}

export interface OverallStat {
  totalTrades: number
  daysWithTrades: number
  wins: number
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
  equityR: { i: number; date: string; r: number; equity: number }[]
  equityPnl: { i: number; date: string; pnl: number; equity: number }[]
}

export function buildStats(
  days: DayEntry[],
  accounts: AccountEntry[],
  payouts: PayoutEntry[],
) {
  const { executions, trades, daysWithTrades } = flatten(days, accounts)
  const payoutTotal = payouts.reduce((s, p) => s + p.data.amount, 0)
  const n = trades.length
  const wins = trades.filter((t) => t.win)
  const losses = trades.filter((t) => !t.win)
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0)
  const sumR = trades.reduce((s, t) => s + t.R, 0)
  const sumPnl = executions.reduce((s, t) => s + t.pnl, 0)

  let eqR = 0
  let eqPnl = 0
  let peakR = 0
  let peakPnl = 0
  let maxDDR = 0
  let maxDDPnl = 0
  const curveR = trades.map((t, i) => {
    eqR += t.R
    peakR = Math.max(peakR, eqR)
    maxDDR = Math.min(maxDDR, eqR - peakR)
    return { i, date: t.day, r: t.R, equity: round2(eqR) }
  })
  const curvePnl = executions.map((t, i) => {
    eqPnl += t.pnl
    peakPnl = Math.max(peakPnl, eqPnl)
    maxDDPnl = Math.min(maxDDPnl, eqPnl - peakPnl)
    return { i, date: t.day, pnl: t.pnl, equity: round2(eqPnl) }
  })

  const overall: OverallStat = {
    totalTrades: n,
    daysWithTrades,
    wins: wins.length,
    winRate: n ? (wins.length / n) * 100 : null,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : null,
    sumR: round2(sumR),
    avgR: n ? round2(sumR / n) : 0,
    expectancy: n ? round2(sumR / n) : 0,
    bestR: n ? round2(Math.max(...trades.map((t) => t.R))) : 0,
    worstR: n ? round2(Math.min(...trades.map((t) => t.R))) : 0,
    avgWinR: wins.length ? round2(wins.reduce((s, t) => s + t.R, 0) / wins.length) : 0,
    avgLossR: losses.length ? round2(losses.reduce((s, t) => s + t.R, 0) / losses.length) : 0,
    maxDrawdownR: round2(maxDDR),
    maxDrawdownPnl: round2(maxDDPnl),
    equityR: curveR,
    equityPnl: curvePnl,
  }

  const byAccount = new Map<string, ExecutionRow[]>()
  for (const ex of executions) {
    if (!byAccount.has(ex.account)) byAccount.set(ex.account, [])
    byAccount.get(ex.account)!.push(ex)
  }

  const perAccount: AccountStat[] = accounts
    .map((a) => {
      const list = byAccount.get(a.data.id) ?? []
      const w = list.filter((x) => x.win)
      const l = list.filter((x) => !x.win)
      const gp = w.reduce((s, x) => s + x.pnl, 0)
      const gl = l.reduce((s, x) => s + Math.abs(x.pnl), 0)
      const sumR = list.reduce((s, x) => s + x.R, 0)
      const grossPnl = list.reduce((s, x) => s + x.pnl, 0)
      const payoutsFor = payouts
        .filter((p) => p.data.account === a.data.id)
        .reduce((s, p) => s + p.data.amount, 0)
      let eq = 0
      let peak = 0
      for (const x of list) {
        eq += x.pnl
        peak = Math.max(peak, eq)
      }
      const eqNet = eq - payoutsFor
      const peakNet = Math.max(peak, eqNet) - payoutsFor
      const dd = Math.min(0, eqNet - peakNet)
      const buffer = Math.max(0, a.data.drawdownLimit + dd)
      const ddUsedPct =
        a.data.drawdownLimit > 0 ? Math.min(100, Math.max(0, (-dd / a.data.drawdownLimit) * 100)) : 0
      return {
        id: a.data.id,
        firm: a.data.firm,
        sizeLabel: a.data.sizeLabel,
        size: a.data.size,
        drawdownLimit: a.data.drawdownLimit,
        trailing: a.data.trailing,
        riskPerTrade: a.data.riskPerTrade,
        stage: a.data.stage,
        started: a.data.stages[0]?.from ?? '',
        note: a.data.note,
        active: a.data.stage !== 'failed' && a.data.stage !== 'paused',
        trades: list.length,
        wins: w.length,
        winRate: list.length ? (w.length / list.length) * 100 : null,
        points: round2(list.reduce((s, x) => s + x.points, 0)),
        grossPnl: round2(grossPnl),
        payouts: round2(payoutsFor),
        netPnl: round2(eqNet),
        sumR: round2(sumR),
        profitFactor: gl > 0 ? round2(gp / gl) : gp > 0 ? Infinity : null,
        peakEq: round2(peakNet),
        currentDD: round2(dd),
        buffer: round2(buffer),
        ddUsedPct,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  return { executions, trades, perAccount, overall, payoutTotal, sumPnl: round2(sumPnl) }
}

export function fmtPnl(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
export function fmtPts(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
}
