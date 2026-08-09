import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flatten, buildStats, walkNetEquity } from '../src/lib/stats'
import type { DayEntry, AccountEntry, PayoutEntry } from '../src/lib/stats'

const account = (id: string, firm = 'Lucid', pointsValue = 2): AccountEntry =>
  ({
    id,
    collection: 'accounts',
    data: { id, firm, sizeLabel: '50k', pointsValue },
  }) as unknown as AccountEntry

const fullAccount = (id: string, firm = 'Lucid', pointsValue = 2): AccountEntry =>
  ({
    id,
    collection: 'accounts',
    data: {
      id,
      firm,
      sizeLabel: '50k',
      size: 50_000,
      drawdownLimit: 2000,
      trailing: true,
      riskPerTrade: 250,
      stage: 'eval',
      stages: [],
      pointsValue,
    },
  }) as unknown as AccountEntry

const payout = (date: string, accountId: string, amount: number): PayoutEntry =>
  ({
    id: `${date}-${accountId}`,
    collection: 'payouts',
    data: { date, account: accountId, amount },
  }) as unknown as PayoutEntry

const day = (date: string, trades: DayEntry['data']['trades']): DayEntry =>
  ({ id: date, collection: 'days', data: { date, trades } }) as unknown as DayEntry

const tr = (over: Partial<DayEntry['data']['trades'][number]> = {}): DayEntry['data']['trades'][number] => ({
  market: 'MNQ',
  direction: 'long',
  entry: 100,
  exit: 104,
  points: 4,
  riskPoints: 1,
  executions: [{ account: 'lucid-50k-a', size: 1 }],
  screenshots: [],
  models: [],
  ...over,
})

test('flatten: one trade + executions -> per-account rows', () => {
  const days = [
    day('2026-08-05', [
      {
        market: 'MNQ',
        direction: 'long',
        entry: 20800.5,
        stop: 20795,
        exit: 20812.5,
        points: 12,
        riskPoints: 5.5,
        executions: [{ account: 'lucid-50k-a', size: 1 }],
        screenshots: [],
        models: [],
      },
    ]),
  ]
  const accounts = [account('lucid-50k-a')]
  const { executions, trades, daysWithTrades } = flatten(days, accounts)

  assert.equal(daysWithTrades, 1)
  assert.equal(trades.length, 1)
  assert.equal(executions.length, 1)

  const row = executions[0]
  assert.equal(row.day, '2026-08-05')
  assert.equal(row.account, 'lucid-50k-a')
  assert.equal(row.firm, 'Lucid')
  assert.equal(row.market, 'MNQ')
  assert.equal(row.direction, 'long')
  assert.equal(row.entry, 20800.5)
  assert.equal(row.exit, 20812.5)
  assert.equal(row.stop, 20795)
  assert.equal(row.riskPoints, 5.5)
  assert.equal(row.points, 12)
  assert.equal(row.R, 2.18) // 12 / 5.5 = 2.1818... -> round2
  assert.equal(row.pnl, 24) // 12 * 2 (pointsValue) * 1 (size)
  assert.equal(row.win, true)
})

test('flatten: zero-risk trade -> R 0', () => {
  const days = [
    day('2026-08-05', [
      {
        market: 'MNQ',
        direction: 'long',
        entry: 100,
        exit: 104,
        points: 4,
        riskPoints: 0,
        executions: [{ account: 'lucid-50k-a', size: 1 }],
        screenshots: [],
        models: [],
      },
    ]),
  ]
  const { executions } = flatten(days, [account('lucid-50k-a')])
  assert.equal(executions[0].R, 0)
  assert.equal(executions[0].riskPoints, 0)
})

test('flatten: stop-based risk fallback when riskPoints absent', () => {
  const days = [
    day('2026-08-05', [
      {
        market: 'MNQ',
        direction: 'long',
        entry: 100,
        stop: 98,
        exit: 104,
        points: 4,
        executions: [{ account: 'lucid-50k-a', size: 1 }],
        screenshots: [],
        models: [],
      },
    ]),
  ]
  const { executions } = flatten(days, [account('lucid-50k-a')])
  assert.equal(executions[0].riskPoints, 2) // |100 - 98|
  assert.equal(executions[0].R, 2) // 4 / 2
})

test('flatten: two executions on one trade -> two rows, per-account pnl', () => {
  const days = [
    day('2026-08-05', [
      {
        market: 'MNQ',
        direction: 'long',
        entry: 100,
        stop: 99,
        exit: 103,
        points: 3,
        riskPoints: 1,
        executions: [
          { account: 'lucid-50k-a', size: 1 },
          { account: 'tpt-25k-a', size: 2 },
        ],
        screenshots: [],
        models: [],
      },
    ]),
  ]
  const accounts = [account('lucid-50k-a', 'Lucid', 2), account('tpt-25k-a', 'TPT', 2)]
  const { executions } = flatten(days, accounts)

  assert.equal(executions.length, 2)
  assert.equal(executions[0].pnl, 6) // 3 * 2 * 1
  assert.equal(executions[1].pnl, 12) // 3 * 2 * 2
  assert.equal(executions[1].account, 'tpt-25k-a')
  assert.equal(executions[0].R, 3)
  assert.equal(executions[1].R, 3) // R is price-based, identical across executions
})

test('flatten: executions without an account map fall back to defaults', () => {
  const days = [
    day('2026-08-05', [
      {
        market: 'MNQ',
        direction: 'long',
        entry: 100,
        stop: 99,
        exit: 101,
        points: 2,
        riskPoints: 1,
        executions: [{ account: '__unlogged__', size: 1 }],
        screenshots: [],
        models: [],
      },
    ]),
  ]
  const { executions } = flatten(days, [account('lucid-50k-a')])
  assert.equal(executions[0].account, '__unlogged__')
  assert.equal(executions[0].firm, '—')
  assert.equal(executions[0].pnl, 4) // pointsValue default 2
})

/* ---- #1 payout-aware drawdown / buffer ---- */

test('walkNetEquity: payout after a run-up is a permanent equity cut (QA example)', () => {
  const w = walkNetEquity(
    [
      { date: '2026-08-01', pnl: 1000 },
      { date: '2026-08-03', pnl: -200 },
    ],
    [{ date: '2026-08-02', amount: 500 }],
  )
  assert.equal(w.gross, 800)
  assert.equal(w.net, 300)
  assert.equal(w.peakEq, 1000)
  assert.equal(w.dd, -700) // not -200
})

test('walkNetEquity: payout before any trade does not create a dd', () => {
  const w = walkNetEquity([{ date: '2026-08-02', pnl: 1000 }], [{ date: '2026-08-01', amount: 500 }])
  assert.equal(w.net, 500)
  assert.equal(w.peakEq, 500)
  assert.equal(w.dd, 0)
})

test('walkNetEquity: two payouts, one after the peak', () => {
  const w = walkNetEquity(
    [
      { date: '2026-08-01', pnl: 1000 },
      { date: '2026-08-03', pnl: 200 },
    ],
    [
      { date: '2026-08-02', amount: 300 },
      { date: '2026-08-04', amount: 400 },
    ],
  )
  assert.equal(w.peakEq, 1000)
  assert.equal(w.net, 500)
  assert.equal(w.dd, -500)
})

test('walkNetEquity: payout on a date with no day record still counts', () => {
  const w = walkNetEquity(
    [
      { date: '2026-08-01', pnl: 1000 },
      { date: '2026-08-03', pnl: -200 },
    ],
    [{ date: '2026-08-02', amount: 500 }],
  )
  assert.equal(w.dd, -700)
})

test('walkNetEquity: empty sets are zero', () => {
  assert.deepEqual(walkNetEquity([], []), { gross: 0, net: 0, peakEq: 0, dd: 0 })
})

test('buildStats: payout timing drives per-account dd and overall maxDrawdownPnl', () => {
  const days = [
    day('2026-08-01', [tr({ points: 500, riskPoints: 1 })]),
    day('2026-08-03', [tr({ points: -100, riskPoints: 1 })]),
  ]
  const accounts = [fullAccount('lucid-50k-a')]
  const payouts = [payout('2026-08-02', 'lucid-50k-a', 500)]
  const { perAccount, overall } = buildStats(days, accounts, payouts)
  assert.equal(perAccount[0].peakEq, 1000)
  assert.equal(perAccount[0].currentDD, -700)
  assert.equal(perAccount[0].netPnl, 300)
  assert.equal(perAccount[0].buffer, 1300) // drawdownLimit 2000 − 700
  assert.equal(overall.maxDrawdownPnl, -700) // payouts at their dates, net-of-payouts
})

/* ---- #2 idea $ = Σ of ALL executions ---- */

test('buildStats: idea $ is the sum of ALL executions (copy-traded day)', () => {
  const days = [
    day('2026-08-05', [
      tr({
        points: 3,
        riskPoints: 1,
        executions: [
          { account: 'lucid-50k-a', size: 1 },
          { account: 'tpt-25k-a', size: 2 },
        ],
      }),
    ]),
  ]
  const accounts = [fullAccount('lucid-50k-a'), fullAccount('tpt-25k-a', 'TPT')]
  const { trades, perAccount, overall, sumPnl } = buildStats(days, accounts, [])
  assert.equal(trades.length, 1) // one idea
  assert.equal(overall.totalTrades, 1)
  assert.equal(overall.sumR, 3) // R counted once per idea
  assert.equal(overall.grossProfit, 18) // 3*2*1 + 3*2*2
  assert.equal(overall.grossLoss, 0)
  assert.equal(overall.grossProfit - overall.grossLoss, sumPnl)
  const perAccountSum = perAccount.reduce((s, a) => s + a.grossPnl, 0)
  assert.equal(perAccountSum, overall.grossProfit - overall.grossLoss)
  assert.equal(sumPnl, 18)
})

/* ---- #7 break-even excluded from the win-rate denominator ---- */

test('buildStats: break-even (R 0) is excluded from the win-rate denominator', () => {
  const days = [
    day('2026-08-05', [
      tr({ points: 2, riskPoints: 1 }),
      tr({ points: 1, riskPoints: 1 }),
      tr({ points: -1, riskPoints: 1 }),
      tr({ points: 0, riskPoints: 1 }), // break-even
    ]),
  ]
  const accounts = [fullAccount('lucid-50k-a')]
  const { overall, perAccount } = buildStats(days, accounts, [])
  assert.equal(overall.totalTrades, 4)
  assert.equal(overall.wins, 2)
  assert.ok(Math.abs(overall.winRate! - (2 / 3) * 100) < 1e-6, `overall winRate ${overall.winRate}`)
  assert.equal(perAccount[0].wins, 2)
  assert.ok(Math.abs(perAccount[0].winRate! - (2 / 3) * 100) < 1e-6, `per-account winRate ${perAccount[0].winRate}`)
})

/* ---- #10 no $ invention for execution-less / unknown-account trades ---- */

test('buildStats: execution-less trade counts for R but has no $ attribution', () => {
  const days = [day('2026-08-05', [tr({ points: 2, riskPoints: 1, executions: [] })])]
  const accounts = [fullAccount('lucid-50k-a')]
  const { trades, perAccount, overall, sumPnl } = buildStats(days, accounts, [])
  assert.equal(trades.length, 1) // still a real idea
  assert.equal(overall.totalTrades, 1)
  assert.equal(overall.sumR, 2)
  assert.equal(sumPnl, 0) // no $ attribution
  assert.equal(perAccount[0].trades, 0)
  assert.equal(perAccount[0].grossPnl, 0)
  assert.equal(perAccount[0].netPnl, 0)
})

test('buildStats: explicit unknown-account execution has no $ attribution', () => {
  const days = [
    day('2026-08-05', [
      tr({ points: 2, riskPoints: 1, executions: [{ account: '__unlogged__', size: 1 }] }),
    ]),
  ]
  const accounts = [fullAccount('lucid-50k-a')]
  const { executions, perAccount, overall, sumPnl } = buildStats(days, accounts, [])
  assert.equal(executions.length, 1) // flatten keeps the row (data fidelity)
  assert.equal(executions[0].account, '__unlogged__')
  assert.equal(executions[0].pnl, 4) // the row still carries its computed pnl
  assert.equal(overall.sumR, 2)
  assert.equal(sumPnl, 0) // skipped in the $-sum
  assert.equal(perAccount[0].grossPnl, 0)
})
