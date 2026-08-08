import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountRuleStatus, type AccountLike, type AccountRuleStatus } from '../src/lib/account-rules'

// flatten()-shaped executions: day / account / pnl (dollars, per-account).
const ex = (day: string, account: string, pnl: number) => ({ day, account, pnl })

const account = (patch: Partial<AccountLike>): AccountLike => ({
  id: 'lucid-50k-a',
  stage: 'eval',
  drawdownLimit: 2000,
  trailing: true,
  ...patch,
})

function status(a: AccountLike, netPnl: number, executions: { day: string; account: string; pnl: number }[] = []): AccountRuleStatus {
  return accountRuleStatus(a, { netPnl, drawdownLimit: a.drawdownLimit ?? 2000, trailing: true }, executions, '2026-08-08')
}

test('drawdown hit: net <= -limit flips drawdownHit + breach drawdown', () => {
  const s = status(account({ rules: { breach: 'drawdown' } }), -2500)
  assert.equal(s.drawdownHit, true)
  assert.equal(s.breach, 'drawdown')
  assert.equal(s.configured, true)
  assert.equal(s.drawdownLimit, 2000)
})

test('drawdown rule not hit → breach none', () => {
  const s = status(account({ rules: { breach: 'drawdown' } }), -1200)
  assert.equal(s.drawdownHit, false)
  assert.equal(s.breach, 'none')
})

test('daily hit via today: todayPnl <= -limit', () => {
  const s = status(
    account({ rules: { dailyLoss: 250, breach: 'daily' } }),
    1000,
    [ex('2026-08-08', 'lucid-50k-a', -300), ex('2026-08-07', 'lucid-50k-a', 50)],
  )
  assert.equal(s.dailyLossLimit, 250)
  assert.equal(s.todayPnl, -300)
  assert.equal(s.dailyHit, true)
  assert.equal(s.breach, 'daily')
})

test('daily hit via worst day (today clean, worst earlier)', () => {
  const s = status(
    account({ rules: { dailyLoss: 250, breach: 'daily' } }),
    0,
    [ex('2026-08-08', 'lucid-50k-a', 20), ex('2026-08-06', 'lucid-50k-a', -400), ex('2026-08-06', 'lucid-50k-a', 100)],
  )
  assert.equal(s.todayPnl, 20)
  assert.equal(s.worstDayPnl, -300) // -400 + 100 summed per day
  assert.equal(s.dailyHit, true)
  assert.equal(s.breach, 'daily')
})

test('no daily rule → dailyLossLimit null, dailyHit false', () => {
  const s = status(account({}), 0, [ex('2026-08-08', 'lucid-50k-a', -500)])
  assert.equal(s.dailyLossLimit, null)
  assert.equal(s.todayPnl, -500)
  assert.equal(s.dailyHit, false)
})

test('breach either: drawdown wins over daily', () => {
  const s = status(
    account({ rules: { dailyLoss: 250, breach: 'either' } }),
    -2500,
    [ex('2026-08-08', 'lucid-50k-a', -300)],
  )
  assert.equal(s.drawdownHit, true)
  assert.equal(s.dailyHit, true)
  assert.equal(s.breach, 'drawdown')
})

test('breach either: only daily hit → daily', () => {
  const s = status(account({ rules: { dailyLoss: 250, breach: 'either' } }), 500, [ex('2026-08-08', 'lucid-50k-a', -300)])
  assert.equal(s.drawdownHit, false)
  assert.equal(s.dailyHit, true)
  assert.equal(s.breach, 'daily')
})

test('breach either: nothing hit → none', () => {
  const s = status(account({ rules: { dailyLoss: 250, breach: 'either' } }), 500, [ex('2026-08-08', 'lucid-50k-a', -50)])
  assert.equal(s.breach, 'none')
})

test('no breach rule → breach null (numbers still present)', () => {
  const s = status(account({}), -2500, [ex('2026-08-08', 'lucid-50k-a', -200)])
  assert.equal(s.breach, null)
  assert.equal(s.drawdownHit, true) // drawdown math still computed
  assert.equal(s.todayPnl, -200)
})

test('consistency stage applicability: eval / funded / both / none / absent', () => {
  assert.equal(status(account({ stage: 'eval', rules: { consistency: 'eval' } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'buffer', rules: { consistency: 'eval' } }), 0).consistencyApplies, false)
  assert.equal(status(account({ stage: 'funded', rules: { consistency: 'funded' } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'eval', rules: { consistency: 'funded' } }), 0).consistencyApplies, false)
  assert.equal(status(account({ stage: 'eval', rules: { consistency: 'both' } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'funded', rules: { consistency: 'both' } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'buffer', rules: { consistency: 'both' } }), 0).consistencyApplies, false)
  assert.equal(status(account({ stage: 'eval', rules: { consistency: 'none' } }), 0).consistencyApplies, false)
  assert.equal(status(account({ stage: 'eval' }), 0).consistencyApplies, false)
  assert.equal(status(account({ stage: 'eval', rules: { consistency: 'eval' } }), 0).consistency, 'eval')
})

test('no rules at all → configured false, breach + consistency null, numbers present', () => {
  const s = status(account({}), 750, [ex('2026-08-08', 'lucid-50k-a', 25)])
  assert.equal(s.configured, false)
  assert.equal(s.breach, null)
  assert.equal(s.consistency, null)
  assert.equal(s.consistencyApplies, false)
  assert.equal(s.netPnl, 750)
  assert.equal(s.todayPnl, 25)
  assert.equal(s.trailing, true)
})

test('only a note counts as configured', () => {
  const s = status(account({ rules: { consistencyNote: '30% rule — no single day above 30%' } }), 0)
  assert.equal(s.configured, true)
  assert.equal(s.breach, null)
})
