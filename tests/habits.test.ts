import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHabitStats } from '../src/lib/habits'
import type { DayEntry, HabitEntry } from '../src/lib/stats'

const habit = (id: string): HabitEntry =>
  ({ id, collection: 'habits', data: { name: id, color: '#fff' } }) as unknown as HabitEntry

const day = (date: string, habits: Record<string, boolean | number> | undefined): DayEntry =>
  ({ id: date, collection: 'days', data: { date, trades: [], habits } }) as unknown as DayEntry

test('buildHabitStats: streak walks consecutive done days from the injected today', () => {
  const days = [
    day('2026-08-06', { 'quiet-time': true }),
    day('2026-08-07', { 'quiet-time': true }),
    day('2026-08-08', { 'quiet-time': true }),
  ]
  const stats = buildHabitStats([habit('quiet-time')], days, '2026-08-08')
  assert.equal(stats[0].currentStreak, 3)
  assert.equal(stats[0].bestStreak, 3)
  assert.equal(stats[0].doneToday, true)
})

test('buildHabitStats: doneToday reflects the injected date', () => {
  const untracked = buildHabitStats(
    [habit('quiet-time')],
    [day('2026-08-07', { 'quiet-time': true })],
    '2026-08-08',
  )
  assert.equal(untracked[0].doneToday, null) // 08-08 has no record
  const skipped = buildHabitStats(
    [habit('quiet-time')],
    [day('2026-08-08', { 'quiet-time': false })],
    '2026-08-08',
  )
  assert.equal(skipped[0].doneToday, false) // tracked but consciously skipped
  const done = buildHabitStats(
    [habit('quiet-time')],
    [day('2026-08-08', { 'quiet-time': true })],
    '2026-08-08',
  )
  assert.equal(done[0].doneToday, true)
})

test('buildHabitStats: 30d pct window is keyed to the injected today', () => {
  const days = [
    day('2026-07-05', { 'quiet-time': true }), // outside the 30d window
    day('2026-08-07', { 'quiet-time': true }),
    day('2026-08-08', { 'quiet-time': true }),
  ]
  const stats = buildHabitStats([habit('quiet-time')], days, '2026-08-08')
  assert.equal(stats[0].pct30, 100) // 2 tracked in window, 2 done
  assert.equal(stats[0].logged, 3) // per-habit tracked count, not "any habit logged"
  assert.equal(stats[0].pctAll, 100)
})

test('buildHabitStats: heatmap spans exactly to the injected today', () => {
  const stats = buildHabitStats(
    [habit('quiet-time')],
    [day('2026-08-08', { 'quiet-time': true })],
    '2026-08-08',
  )
  assert.equal(stats[0].heatmap.length, 365)
  assert.equal(stats[0].heatmap[0].date, '2025-08-09') // 08-08 minus 364 days
  assert.equal(stats[0].heatmap[364].date, '2026-08-08') // last cell = injected today
  assert.equal(stats[0].heatmap[364].value, true)
})

test('buildHabitStats: habit introduced mid-project is not diluted', () => {
  // 'read' is done on every day it is tracked (3 days). Another habit ('quiet-time')
  // is logged on 2 extra days — the OLD code diluted pctAll with those days.
  const days = [
    day('2026-08-03', { 'quiet-time': true }), // no 'read' key → not tracked for read
    day('2026-08-04', { 'quiet-time': true, read: 30 }),
    day('2026-08-05', { read: 30 }),
    day('2026-08-06', { read: 30 }),
  ]
  const stats = buildHabitStats([habit('quiet-time'), habit('read')], days, '2026-08-06')
  const byId = Object.fromEntries(stats.map((s) => [s.id, s]))
  assert.equal(byId.read.pctAll, 100) // 3 tracked, 3 done (was 75% before the fix)
  assert.equal(byId.read.logged, 3)
  assert.equal(byId['quiet-time'].pctAll, 100) // 2 tracked, 2 done
})

test('buildHabitStats: an explicitly-false day counts in the denominator', () => {
  const days = [
    day('2026-08-07', { 'quiet-time': true }),
    day('2026-08-08', { 'quiet-time': false }), // consciously skipped — still tracked
  ]
  const stats = buildHabitStats([habit('quiet-time')], days, '2026-08-08')
  assert.equal(stats[0].logged, 2)
  assert.equal(stats[0].done, 1)
  assert.equal(stats[0].pctAll, 50)
  assert.equal(stats[0].pct30, 50)
})

test('buildHabitStats: never-logged habit has null pct, not 0', () => {
  const stats = buildHabitStats(
    [habit('quiet-time'), habit('read')],
    [day('2026-08-08', { 'quiet-time': true })],
    '2026-08-08',
  )
  const byId = Object.fromEntries(stats.map((s) => [s.id, s]))
  assert.equal(byId.read.pctAll, null)
  assert.equal(byId.read.logged, 0)
  assert.equal(byId.read.doneToday, null)
  assert.equal(byId.read.currentStreak, 0)
})
