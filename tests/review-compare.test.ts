import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatNum, formatPct, renderComparisonFallback } from '../src/lib/review-compare'
import { periodDelta, type PeriodStats, type TrendPoint } from '../src/lib/period-stats'

function base(over: Partial<PeriodStats> = {}): PeriodStats {
  return {
    daysCount: 5,
    tradedDays: 4,
    trades: 10,
    sumR: 10,
    expectancyR: 1,
    winRate: 0.5,
    profitFactor: 2,
    pnlByAccount: [],
    modelStats: [],
    avgSleep: 6,
    avgMood: 3,
    habitAdherence: [],
    avgScreenHours: 5,
    ...over,
  }
}

const trend: TrendPoint[] = [
  { label: 'week 32', sumR: 5, winRate: 0.5, trades: 9 },
  { label: 'week 33', sumR: -2, winRate: 0.33, trades: 6 },
  { label: 'week 34', sumR: 16, winRate: 0.6, trades: 12 },
]

test('formatNum: finite values round to 2dp, non-finite render as ∞ (never NaN)', () => {
  assert.equal(formatNum(3.14159), '3.14')
  assert.equal(formatNum(-12.346), '-12.35')
  assert.equal(formatNum(0), '0')
  assert.equal(formatNum(Infinity), '∞')
  assert.equal(formatNum(-Infinity), '∞')
  assert.equal(formatNum(NaN), '∞')
})

test('formatPct: fraction → percent, null → —, non-finite → ∞', () => {
  assert.equal(formatPct(0.6), '60%')
  assert.equal(formatPct(-0.5), '-50%')
  assert.equal(formatPct(0.375), '37.5%')
  assert.equal(formatPct(null), '—')
  assert.equal(formatPct(Infinity), '∞')
})

test('renderComparisonFallback: exact deltas, trend in order, one direction bullet, no NaN', () => {
  const prev = base()
  const cur = base({ sumR: 16, expectancyR: 1.6, winRate: 0.6, profitFactor: 3, trades: 12, tradedDays: 5 })
  const out = renderComparisonFallback(prev, cur, trend)

  // Deltas match periodDelta exactly.
  for (const d of periodDelta(prev, cur)) {
    assert.ok(out.includes(`- ${d.field}:`), `missing field ${d.field}`)
  }
  assert.ok(out.includes('- sumR: 16 vs 10 (+6, 60%)'), out)
  assert.ok(out.includes('- winRate: 60% vs 50% (+10%, 20%)'), out)
  assert.ok(out.includes('- profitFactor: 3 vs 2 (+1, 50%)'), out)

  // Trend series read in order, oldest → newest.
  assert.ok(out.indexOf('week 32') < out.indexOf('week 33'), 'trend out of order')
  assert.ok(out.indexOf('week 33') < out.indexOf('week 34'), 'trend out of order')

  // One direction bullet summarizing the series (5 → 16 = up).
  assert.ok(out.includes('- trend: up (5 → 16)'), out)

  // Never NaN, never bare Infinity.
  assert.ok(!out.includes('NaN'), out)
  assert.ok(!out.includes('Infinity'), out)
})

test('renderComparisonFallback: profitFactor ∞ renders cleanly', () => {
  const prev = base({ profitFactor: 2 })
  const cur = base({ profitFactor: Infinity }) // winners, no losers
  const out = renderComparisonFallback(prev, cur, [])
  assert.ok(out.includes('- profitFactor: ∞ vs 2 (∞, ∞)'), out)
  assert.ok(!out.includes('NaN'), out)
})

test('renderComparisonFallback: pct is — when prev is 0 (no baseline)', () => {
  const prev = base({ sumR: 0, expectancyR: 0, winRate: 0, profitFactor: 0, trades: 0, tradedDays: 0 })
  const cur = base({ sumR: 5 })
  const out = renderComparisonFallback(prev, cur, [])
  assert.ok(out.includes('- sumR: 5 vs 0 (+5, —)'), out)
})

test('renderComparisonFallback: no trend section when the series is empty', () => {
  const out = renderComparisonFallback(base(), base({ sumR: 12 }), [])
  assert.ok(!out.includes('trend:'), out)
})
