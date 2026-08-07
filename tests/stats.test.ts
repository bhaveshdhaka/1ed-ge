import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flatten } from '../src/lib/stats'
import type { DayEntry, AccountEntry } from '../src/lib/stats'

const account = (id: string, firm = 'Lucid', pointsValue = 2): AccountEntry =>
  ({
    id,
    collection: 'accounts',
    data: { id, firm, sizeLabel: '50k', pointsValue },
  }) as unknown as AccountEntry

const day = (date: string, trades: DayEntry['data']['trades']): DayEntry =>
  ({ id: date, collection: 'days', data: { date, trades } }) as unknown as DayEntry

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
      },
    ]),
  ]
  const { executions } = flatten(days, [account('lucid-50k-a')])
  assert.equal(executions[0].account, '__unlogged__')
  assert.equal(executions[0].firm, '—')
  assert.equal(executions[0].pnl, 4) // pointsValue default 2
})
