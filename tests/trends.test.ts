import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTrends, trendsForLLM } from '../src/lib/trends'
import { addDaysIso } from '../src/lib/sessions'
import type { DayEntry, AccountEntry } from '../src/lib/stats'

const account = (id: string): AccountEntry =>
  ({
    id,
    collection: 'accounts',
    data: { id, firm: 'Lucid', sizeLabel: '50k', pointsValue: 2 },
  }) as unknown as AccountEntry

const day = (
  date: string,
  trades: DayEntry['data']['trades'],
  habits?: Record<string, boolean | number>,
): DayEntry =>
  ({ id: date, collection: 'days', data: { date, trades, habits } }) as unknown as DayEntry

const tr = (
  points: number,
  execs: { account: string; size?: number }[] = [{ account: 'lucid-50k-a', size: 1 }],
): DayEntry['data']['trades'][number] => ({
  market: 'MNQ',
  direction: 'long',
  entry: 100,
  exit: 100 + points,
  points,
  riskPoints: 1,
  executions: execs,
  screenshots: [],
  models: [],
})

const mkHabitDay = (date: string, n: number): DayEntry => {
  const habits: Record<string, boolean> = {}
  for (let i = 0; i < n; i++) habits[`h${i}`] = true
  return day(date, [tr(1)], habits)
}

test('buildTrends: 7d/30d windows are inclusive and keyed to the injected today', () => {
  const accounts = [account('lucid-50k-a')]
  const days: DayEntry[] = []
  for (let i = 0; i < 30; i++) days.push(day(addDaysIso('2026-08-08', -i), [tr(1)]))
  const t = buildTrends(days, accounts, '2026-08-08')
  const byLabel = Object.fromEntries(t.windows.map((w) => [w.label, w]))
  // cutoff = today − (daysBack − 1) → 08-02..08-08 inclusive = exactly 7 days
  assert.equal(byLabel['7d'].days, 7)
  assert.equal(byLabel['7d'].trades, 7)
  assert.equal(byLabel['7d'].sumR, 7)
  assert.equal(byLabel['30d'].days, 30)
  assert.equal(byLabel['30d'].trades, 30)
})

test('buildTrends: break-even (R 0) is excluded from every win-rate denominator', () => {
  const accounts = [account('lucid-50k-a')]
  const days = [day('2026-08-08', [tr(2), tr(1), tr(-1), tr(0)])]
  const t = buildTrends(days, accounts, '2026-08-08')
  assert.equal(t.windows[0].trades, 4)
  assert.ok(Math.abs(t.windows[0].winRate! - (2 / 3) * 100) < 0.01, `winRate ${t.windows[0].winRate}`)
  assert.equal(t.windows[0].sumR, 2) // 2 + 1 − 1 + 0
})

test('buildTrends: overtrading flag counts ideas, not executions', () => {
  const accounts = [account('lucid-50k-a')]
  // 1 idea × 7 executions, losing → NOT an overtrading flag
  const execs = Array.from({ length: 7 }, () => ({ account: 'lucid-50k-a', size: 1 }))
  const oneIdea = buildTrends([day('2026-08-08', [tr(-1, execs)])], accounts, '2026-08-08')
  assert.ok(!oneIdea.flags.some((f) => f.includes('overtrading')), oneIdea.flags.join('|'))
  // 6 ideas (each 1 execution), losing → flag
  const sixIdeas = buildTrends(
    [day('2026-08-08', [tr(-1), tr(-1), tr(-1), tr(-1), tr(-1), tr(-1)])],
    accounts,
    '2026-08-08',
  )
  assert.ok(
    sixIdeas.flags.some((f) => f.includes('overtrading flag') && f.includes('6 ideas')),
    sixIdeas.flags.join('|'),
  )
})

test('buildTrends: habit buckets are data-derived, no 5-6 cap', () => {
  const accounts = [account('lucid-50k-a')]
  const days = [mkHabitDay('2026-08-08', 7), mkHabitDay('2026-08-07', 9), mkHabitDay('2026-08-06', 14)]
  const t = buildTrends(days, accounts, '2026-08-08')
  const buckets = t.correlations.habits.map((b) => b.bucket)
  assert.ok(buckets.includes('7-8'), buckets.join(','))
  assert.ok(buckets.includes('9-10'), buckets.join(','))
  assert.ok(buckets.includes('13-14'), buckets.join(','))
  assert.ok(!buckets.some((b) => b === '5-6'), buckets.join(','))
  assert.deepEqual(buckets, [...buckets].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)))
  // width-2 buckets: no bucket absorbs more than 6 distinct habit-count values
  const allDays = Array.from({ length: 14 }, (_, i) => mkHabitDay(addDaysIso('2026-08-08', -i), i + 1))
  const t2 = buildTrends(allDays, accounts, '2026-08-08')
  for (const b of t2.correlations.habits) {
    assert.ok(b.days <= 3, `bucket ${b.bucket} absorbed ${b.days} values`)
  }
  // the LLM string still renders
  assert.ok(trendsForLLM(t2).includes('by habits done'))
})
