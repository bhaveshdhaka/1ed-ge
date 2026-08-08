import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildModelStats } from '../src/lib/models'
import type { CollectionEntry } from 'astro:content'

const model = (id: string): CollectionEntry<'models'> =>
  ({ id, collection: 'models', data: { name: id, status: 'active', order: 0 } }) as unknown as CollectionEntry<'models'>

// trades are loosely typed — buildModelStats only reads market/direction/entry/exit/points/R fields
const day = (date: string, trades: unknown[]): CollectionEntry<'days'> =>
  ({ id: date, collection: 'days', data: { date, trades } }) as unknown as CollectionEntry<'days'>

test('buildModelStats: break-even (R 0) is excluded from the win-rate denominator', () => {
  const days = [
    day('2026-08-03', [
      { market: 'MNQ', direction: 'long', entry: 100, exit: 102, points: 2, riskPoints: 1, model: 'orb-drive', screenshots: [] },
      { market: 'MNQ', direction: 'long', entry: 100, exit: 101, points: 1, riskPoints: 1, model: 'orb-drive', screenshots: [] },
      { market: 'MNQ', direction: 'short', entry: 100, exit: 99, points: -1, riskPoints: 1, model: 'orb-drive', screenshots: [] },
      { market: 'MNQ', direction: 'long', entry: 100, exit: 100, points: 0, riskPoints: 1, model: 'orb-drive', screenshots: [] },
    ]),
  ]
  const stats = buildModelStats(days, [model('orb-drive')])
  assert.equal(stats.length, 1)
  assert.equal(stats[0].count, 4)
  assert.ok(Math.abs(stats[0].winRate - 2 / 3) < 1e-9, `winRate = ${stats[0].winRate}`)
})

test('buildModelStats: all-break-even model has winRate 0 (renderer shows —)', () => {
  const days = [
    day('2026-08-03', [
      { market: 'MNQ', direction: 'long', entry: 100, exit: 100, points: 0, riskPoints: 1, model: 'orb-drive', screenshots: [] },
      { market: 'MNQ', direction: 'short', entry: 100, exit: 100, points: 0, riskPoints: 1, model: 'orb-drive', screenshots: [] },
    ]),
  ]
  const stats = buildModelStats(days, [model('orb-drive')])
  assert.equal(stats[0].count, 2)
  assert.equal(stats[0].winRate, 0)
})
