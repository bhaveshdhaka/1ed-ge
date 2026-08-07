import { test } from 'node:test'
import assert from 'node:assert/strict'
import { riskOf, ROf, type DayTrade } from '../src/lib/stream'

function trade(partial: Partial<DayTrade> & Pick<DayTrade, 'entry' | 'points'>): DayTrade {
  return {
    market: 'MNQ',
    direction: 'long',
    exit: partial.entry + partial.points,
    ...partial,
  } as DayTrade
}

test('riskOf: explicit riskPoints wins', () => {
  const t = trade({ entry: 100, points: 4, riskPoints: 2, stop: 99 })
  assert.equal(riskOf(t), 2)
})

test('riskOf: stop-based fallback is |entry - stop|', () => {
  const t = trade({ entry: 100, points: 4, stop: 97 })
  assert.equal(riskOf(t), 3)
})

test('riskOf: fallback 1 when no riskPoints and no stop', () => {
  const t = trade({ entry: 100, points: 4 })
  assert.equal(riskOf(t), 1)
})

test('riskOf: zero riskPoints is honored (not overridden by stop)', () => {
  const t = trade({ entry: 100, points: 4, riskPoints: 0, stop: 99 })
  assert.equal(riskOf(t), 0)
})

test('ROf: R = points / risk', () => {
  const t = trade({ entry: 100, points: 6, riskPoints: 2 })
  assert.equal(ROf(t), 3)
})

test('ROf: zero when risk <= 0', () => {
  assert.equal(ROf(trade({ entry: 100, points: 6, riskPoints: 0 })), 0)
  assert.equal(ROf(trade({ entry: 100, points: 6, riskPoints: -2 })), 0)
})

test('ROf: stop-based fallback', () => {
  const t = trade({ entry: 100, points: 4, stop: 98 })
  assert.equal(ROf(t), 2)
})
