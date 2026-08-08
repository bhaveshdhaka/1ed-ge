import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodRange, periodRangesBetween } from '../src/lib/periods'
import { aggregatePeriod, buildTape, periodDelta, toDateLadder, trendSeries, type PeriodStats, type PeriodStatsCtx } from '../src/lib/period-stats'
import type { DayData, DayTrade } from '../src/lib/stream'

const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

function trade(over: Partial<DayTrade> = {}): DayTrade {
  return {
    market: 'MNQ',
    direction: 'long',
    entry: 100,
    stop: 99,
    exit: 101,
    points: 1,
    screenshots: [], // required by DayTrade
    ...over,
  }
}

function day(date: string, trades: DayTrade[], over: Partial<DayData> = {}): DayData {
  return { date, trades, stream: [], ...over }
}

const ctx: PeriodStatsCtx = {
  habits: [
    { id: 'quiet-time', kind: 'bool' },
    { id: 'read', kind: 'count', target: 30 },
  ],
  accounts: [
    { id: 'lucid-50k-a', pointsValue: 2 },
    { id: 'tpt-25k-a', pointsValue: 5 },
  ],
}

// A 2-day range within the Mon–Fri week of Mon 03-aug .. Fri 07-aug 2026.
// Day 3 (Mon 10-aug) is outside the range and must be excluded everywhere.
const range = periodRange('week', '2026-08-04')

const days: DayData[] = [
  day(
    '2026-08-03',
    [
      // win: R = 10/5 = 2
      trade({ entry: 20800, stop: 20795, exit: 20810, points: 10, model: 'orb-drive', executions: [{ account: 'lucid-50k-a', size: 2 }, { account: 'tpt-25k-a', size: 1 }] }),
      // loss: R = -4/5 = -0.8, no model tag
      trade({ entry: 20800, stop: 20795, exit: 20796, points: -4, executions: [{ account: 'lucid-50k-a', size: 1 }] }),
    ],
    { mood: 3, sleep: { hours: 6.5, quality: 3 }, device: { iphoneHours: 4, macHours: 5 }, habits: { 'quiet-time': true, read: 45 } },
  ),
  day(
    '2026-08-04',
    [
      // win: R = 1/1 = 1; unknown account execution must be skipped
      trade({ points: 1, model: 'orb-drive', executions: [{ account: 'tpt-25k-a', size: 2 }, { account: 'ghost-99k', size: 1 }] }),
    ],
    { mood: 4, sleep: { hours: 7, quality: 4 }, device: { iphoneHours: 3 }, habits: { 'quiet-time': false, read: 20 } },
  ),
  day('2026-08-10', [trade({ points: 99, executions: [{ account: 'lucid-50k-a', size: 1 }] })], { mood: 5, habits: { 'quiet-time': true, read: 60 } }),
]

test('aggregatePeriod: every metric over the in-range days', () => {
  const s = aggregatePeriod(days, range, ctx)
  assert.equal(s.daysCount, 2) // 10-aug is out of range
  assert.equal(s.tradedDays, 2)
  assert.equal(s.trades, 3)
  assert.ok(approx(s.sumR, 2.2), `sumR = ${s.sumR}`) // 2 + (-0.8) + 1
  assert.ok(approx(s.expectancyR, 2.2 / 3), `expectancyR = ${s.expectancyR}`)
  assert.ok(approx(s.winRate, 2 / 3), `winRate = ${s.winRate}`)
  assert.equal(s.profitFactor, 3.75) // grossWin 3 / |grossLoss| 0.8
  // per-account $ pnl: lucid = 10*2*2 + (-4)*2*1 = 32; tpt = 10*5*1 + 1*5*2 = 60
  assert.deepEqual(s.pnlByAccount, [
    { account: 'lucid-50k-a', pnl: 32 },
    { account: 'tpt-25k-a', pnl: 60 },
  ])
  // per-model: only tagged trades, summed R
  assert.deepEqual(s.modelStats, [{ model: 'orb-drive', count: 2, sumR: 3 }])
  assert.equal(s.avgSleep, 6.75) // (6.5 + 7) / 2
  assert.equal(s.avgMood, 3.5) // (3 + 4) / 2
  assert.equal(s.avgScreenHours, 6) // ((4+5) + (3+0)) / 2 — macHours defaults to 0
  assert.deepEqual(s.habitAdherence, [
    { habit: 'quiet-time', pct: 50 }, // true on 03-aug, false on 04-aug
    { habit: 'read', pct: 50 }, // 45 ≥ 30 ✓, 20 < 30 ✗
  ])
})

test('aggregatePeriod: empty period yields zeros / nulls', () => {
  const empty = aggregatePeriod([], range, ctx)
  assert.equal(empty.daysCount, 0)
  assert.equal(empty.tradedDays, 0)
  assert.equal(empty.trades, 0)
  assert.equal(empty.sumR, 0)
  assert.equal(empty.expectancyR, 0)
  assert.equal(empty.winRate, 0)
  assert.equal(empty.profitFactor, 0) // no grossWin → 0, not ∞
  assert.deepEqual(empty.pnlByAccount, [])
  assert.deepEqual(empty.modelStats, [])
  assert.equal(empty.avgSleep, null)
  assert.equal(empty.avgMood, null)
  assert.equal(empty.avgScreenHours, null)
  assert.deepEqual(empty.habitAdherence, [
    { habit: 'quiet-time', pct: 0 },
    { habit: 'read', pct: 0 },
  ])
})

test('aggregatePeriod: profitFactor ∞ when there are winners but no losers', () => {
  const winOnly = [day('2026-08-03', [trade({ points: 2 })])]
  assert.equal(aggregatePeriod(winOnly, range, ctx).profitFactor, Infinity)
})

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

test('periodDelta: delta + 3dp pct per numeric headline field', () => {
  const prev = base()
  const cur = base({ sumR: 16, expectancyR: 1.6, winRate: 0.6, profitFactor: 3, trades: 12, tradedDays: 5 })
  const d = periodDelta(prev, cur)
  assert.equal(d.length, 6)
  const byField = Object.fromEntries(d.map((x) => [x.field, x]))
  assert.deepEqual(
    d.map((x) => x.field),
    ['sumR', 'expectancyR', 'winRate', 'profitFactor', 'trades', 'tradedDays'],
  )
  assert.equal(byField.sumR.cur, 16)
  assert.equal(byField.sumR.prev, 10)
  assert.equal(byField.sumR.delta, 6)
  assert.equal(byField.sumR.pct, 0.6)
  assert.equal(byField.winRate.pct, 0.2)
  assert.equal(byField.profitFactor.pct, 0.5)
  assert.equal(byField.trades.delta, 2)
  assert.equal(byField.trades.pct, 0.2)
  assert.equal(byField.tradedDays.pct, 0.25)
  assert.equal(byField.expectancyR.pct, 0.6)
})

test('periodDelta: pct is null when prev is 0', () => {
  const prev = base({ sumR: 0, trades: 0, winRate: 0, profitFactor: 0, tradedDays: 0, expectancyR: 0 })
  const cur = base({ sumR: 5, trades: 3, winRate: 0.5, profitFactor: 3, tradedDays: 2, expectancyR: 1 })
  const byField = Object.fromEntries(periodDelta(prev, cur).map((x) => [x.field, x]))
  assert.equal(byField.sumR.pct, null)
  assert.equal(byField.sumR.delta, 5)
  assert.equal(byField.trades.pct, null)
  assert.equal(byField.winRate.pct, null)
  assert.equal(byField.profitFactor.pct, null)
  assert.equal(byField.tradedDays.pct, null)
  assert.equal(byField.expectancyR.pct, null)
})

test('trendSeries: last n weeks oldest→newest', () => {
  const trendDays: DayData[] = [
    day('2026-08-03', [trade({ points: 2, riskPoints: 1 })]), // week 32: sumR 2
    day('2026-08-10', [trade({ points: -1, riskPoints: 1 })]), // week 33: sumR -1
    day('2026-08-17', [trade({ points: 3, riskPoints: 1 })]), // week 34: sumR 3
  ]
  assert.deepEqual(trendSeries('week', trendDays, 2, ctx), [
    { label: 'week 33', sumR: -1, winRate: 0, trades: 1 },
    { label: 'week 34', sumR: 3, winRate: 1, trades: 1 },
  ])
  assert.deepEqual(trendSeries('week', trendDays, 5, ctx), [
    { label: 'week 32', sumR: 2, winRate: 1, trades: 1 },
    { label: 'week 33', sumR: -1, winRate: 0, trades: 1 },
    { label: 'week 34', sumR: 3, winRate: 1, trades: 1 },
  ])
  assert.deepEqual(trendSeries('week', [], 2, ctx), [])
})

test('trendSeries: spans only whole periods between earliest and latest day', () => {
  const trendDays: DayData[] = [day('2026-08-04', [trade({ points: 2 })]), day('2026-08-13', [trade({ points: 4 })])]
  const ranges = periodRangesBetween('week', '2026-08-04', '2026-08-13')
  assert.deepEqual(
    ranges.map((r) => r.label),
    ['week 32', 'week 33'],
  )
  assert.deepEqual(trendSeries('week', trendDays, 3, ctx), [
    { label: 'week 32', sumR: 2, winRate: 1, trades: 1 },
    { label: 'week 33', sumR: 4, winRate: 1, trades: 1 },
  ])
})

test('buildTape: chronological data-only arc, current marked', () => {
  const tape = buildTape('week', days, ctx, '2026-08-10')
  assert.equal(tape.length, 2)
  assert.equal(tape[0].short, 'w32')
  assert.ok(approx(tape[0].sumR, 2.2))
  assert.ok(approx(tape[0].cumulative, 2.2))
  assert.equal(tape[0].current, false)
  assert.equal(tape[0].href, '/week/2026-32')
  assert.equal(tape[1].short, 'w33')
  assert.equal(tape[1].sumR, 99)
  assert.ok(approx(tape[1].cumulative, 101.2))
  assert.equal(tape[1].current, true)
  assert.equal(tape[1].href, '/week/2026-33')
})

test('buildTape: empty current week appended at 0-R with the live mark', () => {
  const tape = buildTape('week', days, ctx, '2026-08-21') // Fri of an empty w34
  assert.equal(tape.length, 3)
  assert.equal(tape[2].short, 'w34')
  assert.equal(tape[2].sumR, 0)
  assert.ok(approx(tape[2].cumulative, 101.2))
  assert.equal(tape[2].current, true)
})

test('buildTape: empty past periods are skipped (data-only arc)', () => {
  const gapDays = [days[0], day('2026-08-24', [trade({ points: 2 })])]
  const tape = buildTape('week', gapDays, ctx, '2026-08-24')
  assert.deepEqual(tape.map((p) => p.short), ['w32', 'w35'])
  assert.equal(tape[tape.length - 1].current, true)
})

test('toDateLadder: day feeds week month quarter year', () => {
  const ladder = toDateLadder(days, '2026-08-04', ctx)
  const byLabel = Object.fromEntries(ladder.map((l) => [l.label, l.sumR]))
  assert.equal(byLabel.day, 1)
  assert.ok(approx(byLabel.week, 2.2))
  assert.ok(approx(byLabel.month, 101.2))
  assert.ok(approx(byLabel.quarter, 101.2))
  assert.ok(approx(byLabel.year, 101.2))
})

test('toDateLadder: no day record → day is 0', () => {
  const ladder = toDateLadder(days, '2026-08-05', ctx)
  const byLabel = Object.fromEntries(ladder.map((l) => [l.label, l.sumR]))
  assert.equal(byLabel.day, 0)
})
