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
  const s = status(account({ rules: { drawdownMode: 'eod' } }), -2500)
  assert.equal(s.drawdownHit, true)
  assert.equal(s.breach, 'drawdown')
  assert.equal(s.configured, true)
  assert.equal(s.drawdownLimit, 2000)
})

test('drawdown not hit → breach none (configured account)', () => {
  const s = status(account({ rules: { drawdownMode: 'eod' } }), -1200)
  assert.equal(s.drawdownHit, false)
  assert.equal(s.breach, 'none')
})

test('daily hit via today: todayPnl <= -limit', () => {
  const s = status(
    account({ rules: { dailyLossLimit: 250 } }),
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
    account({ rules: { dailyLossLimit: 250 } }),
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

test('drawdown + daily both hit → drawdown wins', () => {
  const s = status(account({ rules: { dailyLossLimit: 250, drawdownMode: 'eod' } }), -2500, [ex('2026-08-08', 'lucid-50k-a', -300)])
  assert.equal(s.drawdownHit, true)
  assert.equal(s.dailyHit, true)
  assert.equal(s.breach, 'drawdown')
})

test('only daily hit → daily', () => {
  const s = status(account({ rules: { dailyLossLimit: 250 } }), 500, [ex('2026-08-08', 'lucid-50k-a', -300)])
  assert.equal(s.drawdownHit, false)
  assert.equal(s.dailyHit, true)
  assert.equal(s.breach, 'daily')
})

test('nothing hit → none (configured account)', () => {
  const s = status(account({ rules: { dailyLossLimit: 250 } }), 500, [ex('2026-08-08', 'lucid-50k-a', -50)])
  assert.equal(s.breach, 'none')
})

test('no rules at all → breach null (numbers still present)', () => {
  const s = status(account({}), -2500, [ex('2026-08-08', 'lucid-50k-a', -200)])
  assert.equal(s.breach, null)
  assert.equal(s.drawdownHit, true) // drawdown math still computed
  assert.equal(s.todayPnl, -200)
})

test('trailing derives from drawdownMode: eod/intraday-to-eod true, intraday false', () => {
  assert.equal(status(account({ rules: { drawdownMode: 'eod' } }), 0).trailing, true)
  assert.equal(status(account({ rules: { drawdownMode: 'intraday-to-eod' } }), 0).trailing, true)
  assert.equal(status(account({ rules: { drawdownMode: 'intraday' } }), 0).trailing, false)
  assert.equal(status(account({ rules: {} }), 0).trailing, true) // default eod
})

test('consistency: applies whenever a consistencyPct is set (any stage)', () => {
  assert.equal(status(account({ stage: 'eval', rules: { consistencyPct: 40 } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'buffer', rules: { consistencyPct: 40 } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'funded', rules: { consistencyPct: 40 } }), 0).consistencyApplies, true)
  assert.equal(status(account({ stage: 'eval' }), 0).consistencyApplies, false)
  assert.equal(status(account({ stage: 'eval', rules: { consistencyPct: 40 } }), 0).consistencyPct, 40)
})

test('no rules at all → configured false, breach + consistencyPct null, numbers present', () => {
  const s = status(account({}), 750, [ex('2026-08-08', 'lucid-50k-a', 25)])
  assert.equal(s.configured, false)
  assert.equal(s.breach, null)
  assert.equal(s.consistencyPct, null)
  assert.equal(s.consistencyApplies, false)
  assert.equal(s.netPnl, 750)
  assert.equal(s.todayPnl, 25)
  assert.equal(s.trailing, true)
})

test('any rule field counts as configured', () => {
  const s = status(account({ rules: { bufferBalance: 26100 } }), 0)
  assert.equal(s.configured, true)
  assert.equal(s.breach, 'none')
})
