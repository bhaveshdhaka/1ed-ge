import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountabilityStatus } from '../src/lib/accountability'
import type { DayData, DayTrade } from '../src/lib/stream'

// HKT plain dates: 2026-08-03 = Mon, 2026-08-07 = Fri, 2026-08-08 = Sat,
// 2026-08-09 = Sun, 2026-08-10 = Mon. Week 32 = Mon 03-aug .. Fri 07-aug.

function day(date: string, trades: DayTrade[] = [], over: Partial<DayData> = {}): DayData {
  return { date, trades, stream: [], ...over }
}

const GRACE = 'T03:00:00' // 03:00 HKT — the strict 3h-after-midnight boundary

test('day is NOT pending before the 03:00 grace boundary, pending AT it', () => {
  const days = [day('2026-08-03')] // Monday, zero trades, no journal
  // 02:59 on the next day — one minute before grace → not pending
  assert.equal(accountabilityStatus(days, [], [], '2026-08-04T02:59:00').pendingDays, 0)
  // exactly 03:00 → due (>=)
  assert.equal(accountabilityStatus(days, [], [], '2026-08-04T03:00:00').pendingDays, 1)
  // later the same morning → still pending
  assert.equal(accountabilityStatus(days, [], [], '2026-08-04T09:30:00').pendingDays, 1)
})

test('the day itself is never pending during its own evening (grace starts next day 03:00)', () => {
  const days = [day('2026-08-03')]
  assert.equal(accountabilityStatus(days, [], [], '2026-08-03T23:59:00').pendingDays, 0)
})

test('zero-trade days count exactly like trading days', () => {
  const days = [
    day('2026-08-03', []), // zero trades — the writing habit still applies
    day('2026-08-04', [
      { market: 'MNQ', direction: 'long', entry: 20800, stop: 20795, exit: 20810, points: 10, screenshots: [] },
    ]),
  ]
  const s = accountabilityStatus(days, [], [], '2026-08-06T03:00:00')
  assert.equal(s.pendingDays, 2)
})

test('a journal post clears the day; missing journal keeps it pending', () => {
  const days = [day('2026-08-03'), day('2026-08-04')]
  // journal for 08-03 exists, 08-04 missing
  const s = accountabilityStatus(days, ['2026-08-03'], [], '2026-08-06T03:00:00')
  assert.equal(s.pendingDays, 1)
})

test('weekends are relaxed — Sat/Sun never count as pending days', () => {
  const days = [day('2026-08-07'), day('2026-08-08'), day('2026-08-09')] // Fri + Sat + Sun
  const s = accountabilityStatus(days, [], [], '2026-08-11T03:00:00') // all far past grace
  assert.equal(s.pendingDays, 1) // only Friday
})

test('future day records are never pending', () => {
  const days = [day('2026-08-07'), day('2026-08-10')] // Mon 10-aug is in the future at now=Sat
  const s = accountabilityStatus(days, [], [], '2026-08-08T03:00:00')
  assert.equal(s.pendingDays, 1) // only Friday 07-aug
})

test('week review due exactly at Mon 03:00 after the Mon–Fri week', () => {
  const days = [day('2026-08-03'), day('2026-08-04'), day('2026-08-05'), day('2026-08-06'), day('2026-08-07')]
  const journals = days.map((d) => d.date) // all day reflections posted
  // week 32 ended Fri 07-aug; due Mon 10-aug 03:00
  assert.deepEqual(accountabilityStatus(days, journals, [], '2026-08-10T02:59:00').pendingPeriods, [])
  assert.deepEqual(accountabilityStatus(days, journals, [], '2026-08-10T03:00:00').pendingPeriods, ['week 32'])
  // with the week's review note present → not pending
  assert.deepEqual(
    accountabilityStatus(days, journals, [{ type: 'week', anchor: '2026-32' }], '2026-08-10T03:00:00').pendingPeriods,
    [],
  )
})

test('in-progress periods never count (completed periods only)', () => {
  const days = [day('2026-08-03'), day('2026-08-04'), day('2026-08-05'), day('2026-08-06'), day('2026-08-07')]
  const journals = days.map((d) => d.date)
  // Friday 07-aug mid-day: current week (32) and current month (aug) are NOT completed
  const s = accountabilityStatus(days, journals, [], '2026-08-07T12:00:00')
  assert.deepEqual(s.pendingPeriods, [])
})

test('month/quarter/half due 03:00 the day after the period ends; review note clears it', () => {
  const days = [day('2026-06-01')] // Mon — horizon opens June 2026
  // July period? no — June month ends 30-jun, Q2 ends 30-jun, H1 ends 30-jun
  // 30-jun 03:00+1d = 01-jul 03:00. At 02:59 nothing period-wise due (weeks ARE due — see next test)
  // Use a single day so the only horizon period is june month itself:
  const atBoundary = accountabilityStatus(days, [], [], '2026-07-01T03:00:00').pendingPeriods
  assert.ok(atBoundary.includes('month'))
  assert.ok(atBoundary.includes('quarter'))
  assert.ok(atBoundary.includes('half'))
  // a minute before → none of month/quarter/half due yet (01-jul 02:59)
  const before = accountabilityStatus(days, [], [], '2026-07-01T02:59:00').pendingPeriods
  assert.ok(!before.includes('month') && !before.includes('quarter') && !before.includes('half'))
  // a review note clears the quarter only — month/half still pending
  const cleared = accountabilityStatus(days, [], [{ type: 'quarter', anchor: '2026-q2' }], '2026-07-01T03:00:00')
  assert.deepEqual(cleared.pendingPeriods.filter((p) => p === 'quarter'), [])
  assert.ok(cleared.pendingPeriods.includes('month') && cleared.pendingPeriods.includes('half'))
})

test('multiple pending periods: past weeks + month + quarter + half all listed', () => {
  const days = [day('2026-06-01'), day('2026-06-08'), day('2026-06-15'), day('2026-06-22')] // Mon horizon
  // now = Wed 01-jul 03:00 — weeks 23-26 due (their Mondays 08/15/22/29 passed 03:00),
  // week 27 (Mon 29-jun, due 06-jul) still in grace; june month + q2 + h1 all due
  const s = accountabilityStatus(days, [], [], '2026-07-01T03:00:00')
  assert.deepEqual(s.pendingPeriods, ['week 23', 'week 24', 'week 25', 'week 26', 'month', 'quarter', 'half'])
})

test('no 2-year/730-day cap — 150 weeks (≈2.9y) all counted', () => {
  const DAY_MS = 86400000
  const start = new Date(Date.UTC(2021, 0, 4)) // Mon 04-jan-2021 = week 1 2021
  const days: DayData[] = []
  for (let i = 0; i < 150; i++) {
    const d = new Date(start.getTime() + i * 7 * DAY_MS)
    days.push(day(d.toISOString().slice(0, 10)))
  }
  const lastMonday = days[days.length - 1].date
  const now = new Date(Date.parse(lastMonday + 'T00:00:00Z') + 11 * DAY_MS) // well past every week's Mon-03:00 grace
  const nowIso = now.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
  const s = accountabilityStatus(days, [], [], nowIso)
  assert.equal(s.pendingDays, 150) // every Monday past grace, no journals
  const weekStrings = s.pendingPeriods.filter((p) => p.startsWith('week '))
  assert.ok(weekStrings.length >= 150, `expected ≥150 pending weeks, got ${weekStrings.length}`)
})

test('empty inputs are safe', () => {
  assert.deepEqual(accountabilityStatus([], [], [], '2026-08-10T03:00:00'), { pendingDays: 0, pendingPeriods: [] })
})
