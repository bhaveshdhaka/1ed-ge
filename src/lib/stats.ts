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
      const execs = t.executions ?? []
      // idea-level row (uses first execution's account data for display).
      // Idea $ = Σ of ALL KNOWN-account executions (unknown accounts carry no
      // $ attribution); execution-less trades are real ideas for R but have no $.
      const first = execs.length ? accMap.get(execs[0].account) : undefined
      const ideaPnl = execs.reduce((s, ex) => {
        const acc = accMap.get(ex.account)
        if (!acc) return s
        return s + t.points * (acc.data.pointsValue ?? 2) * (ex.size ?? 1)
      }, 0)
      tradeRows.push({
        day: d.data.date,
        tradeId: ti,
        account: first ? execs[0].account : '—',
        firm: first?.data.firm ?? '—',
        sizeLabel: first?.data.sizeLabel ?? '—',
        size: first ? (execs[0].size ?? 1) : 1,
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
        pnl: round2(ideaPnl),
        win: t.points > 0,
      })
      for (const ex of execs) {
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

interface NetEvent {
  date: string
  /** exec pnl (signed) or −payout amount. */
  pnl: number
  payout: boolean
}

function netEvents(
  execRows: { date: string; pnl: number }[],
  payoutRows: { date: string; amount: number }[],
): NetEvent[] {
  const events: NetEvent[] = [
    ...execRows.map((e) => ({ date: e.date, pnl: e.pnl, payout: false })),
    ...payoutRows.map((p) => ({ date: p.date, pnl: -p.amount, payout: true })),
  ]
  // stable sort by date; same-date: executions FIRST, payouts AFTER (a payout
  // applies at end of its day — conservative for drawdown).
  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.payout !== b.payout) return a.payout ? 1 : -1
    return 0
  })
}

export interface NetEquity {
  gross: number
  net: number
  peakEq: number
  dd: number // ≤ 0
}

/**
 * Chronological equity walk — executions gain, payouts reduce net equity at
 * their date. dd = net_final − peak net (high-water). Payout timing matters:
 * a payout after a run-up is a permanent equity reduction, so the dd can go
 * past the gross drawdown. Immune to payout dates with no day record, multiple
 * payouts, and payouts before any trade.
 */
export function walkNetEquity(
  execRows: { date: string; pnl: number }[],
  payoutRows: { date: string; amount: number }[],
): NetEquity {
  const events = netEvents(execRows, payoutRows)
  let gross = 0
  let taken = 0
  let highWater = 0
  for (const e of events) {
    if (e.payout) taken += -e.pnl
    else gross += e.pnl
    highWater = Math.max(highWater, gross - taken)
  }
  const net = gross - taken
  return { gross, net, peakEq: highWater, dd: Math.min(0, net - highWater) }
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
  const accMap = new Map(accounts.map((a) => [a.data.id, a]))
  // Unknown-account executions carry no $ attribution (data fidelity rows stay
  // in flatten, but every $-sum here skips them — exactly period-stats).
  const knownExecs = executions.filter((ex) => accMap.has(ex.account))
  const n = trades.length
  const wins = trades.filter((t) => t.win) // pnl > 0
  const losses = trades.filter((t) => t.pnl < 0) // break-even (R === 0) is neither
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0)
  const sumR = trades.reduce((s, t) => s + t.R, 0)
  const sumPnl = knownExecs.reduce((s, t) => s + t.pnl, 0)

  let eqR = 0
  let peakR = 0
  let maxDDR = 0
  const curveR = trades.map((t, i) => {
    eqR += t.R
    peakR = Math.max(peakR, eqR)
    maxDDR = Math.min(maxDDR, eqR - peakR)
    return { i, date: t.day, r: t.R, equity: round2(eqR) }
  })
  // Portfolio-wide $ walk — all known executions + ALL payouts by date, so the
  // $ layer is payout-aware end to end ("payouts reduce net equity").
  const knownExecRows = knownExecs.map((e) => ({ date: e.day, pnl: e.pnl }))
  const payoutRows = payouts.map((p) => ({ date: p.data.date, amount: p.data.amount }))
  const walk = walkNetEquity(knownExecRows, payoutRows)
  const trace = netEvents(knownExecRows, payoutRows)
  let g = 0
  let tk = 0
  const curvePnl = trace.map((e, i) => {
    if (e.payout) tk += -e.pnl
    else g += e.pnl
    return { i, date: e.date, pnl: e.pnl, equity: round2(g - tk) }
  })
  const maxDDPnl = walk.dd

  const overall: OverallStat = {
    totalTrades: n,
    daysWithTrades,
    wins: wins.length,
    winRate: wins.length + losses.length ? (wins.length / (wins.length + losses.length)) * 100 : null,
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
      const w = list.filter((x) => x.win) // pnl > 0
      const l = list.filter((x) => x.pnl < 0) // break-even is neither
      const gp = w.reduce((s, x) => s + x.pnl, 0)
      const gl = l.reduce((s, x) => s + Math.abs(x.pnl), 0)
      const sumR = list.reduce((s, x) => s + x.R, 0)
      const grossPnl = list.reduce((s, x) => s + x.pnl, 0)
      const acctPayouts = payouts
        .filter((p) => p.data.account === a.data.id)
        .map((p) => ({ date: p.data.date, amount: p.data.amount }))
      // Chronological walk — payouts reduce net equity at their date.
      const walk = walkNetEquity(
        list.map((x) => ({ date: x.day, pnl: x.pnl })),
        acctPayouts,
      )
      const eqNet = walk.net
      const dd = walk.dd
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
        winRate: w.length + l.length ? (w.length / (w.length + l.length)) * 100 : null,
        points: round2(list.reduce((s, x) => s + x.points, 0)),
        grossPnl: round2(grossPnl),
        payouts: round2(acctPayouts.reduce((s, p) => s + p.amount, 0)),
        netPnl: round2(eqNet),
        sumR: round2(sumR),
        profitFactor: gl > 0 ? round2(gp / gl) : gp > 0 ? Infinity : null,
        peakEq: round2(walk.peakEq),
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
