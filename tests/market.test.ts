import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cmeDay, nextModifiedHoursDay } from '../src/lib/market'

test('cmeDay: normal weekday is open', () => {
  // 2026-08-07 is a Friday — a normal CME trading day
  assert.deepEqual(cmeDay('2026-08-07'), { status: 'open', label: 'open' })
})

test('cmeDay: Saturday/Sunday are closed · weekend', () => {
  assert.deepEqual(cmeDay('2026-08-08'), { status: 'closed', label: 'weekend' })
  assert.deepEqual(cmeDay('2026-08-09'), { status: 'closed', label: 'weekend' })
})

test('cmeDay: Christmas is a CME holiday (closed · holiday)', () => {
  // 2026-12-25 is a Friday; observed() does not shift it
  assert.deepEqual(cmeDay('2026-12-25'), { status: 'closed', label: 'holiday' })
})

test('cmeDay: MLK Day is an early-halt day (NYSE holiday, CME shortened session)', () => {
  // 3rd Monday of Jan 2027 = 2027-01-18. CME doesn't close, but the
  // session is shortened: halt ~12:00 PM CT, reopen ~5:00 PM CT. The
  // owner trades from Asia and wants these flagged because volume is
  // thin and price action is messy.
  assert.deepEqual(cmeDay('2027-01-18'), { status: 'early-halt', label: 'early halt' })
})

test('cmeDay: Presidents Day is an early-halt day', () => {
  // 3rd Monday of Feb 2026 = 2026-02-16
  assert.deepEqual(cmeDay('2026-02-16'), { status: 'early-halt', label: 'early halt' })
})

test('cmeDay: Memorial Day is an early-halt day', () => {
  // Last Monday of May 2026 = 2026-05-25
  assert.deepEqual(cmeDay('2026-05-25'), { status: 'early-halt', label: 'early halt' })
})

test('cmeDay: Jul 2 2026 is an early-close day (day before Friday-observed Independence Day)', () => {
  // Jul 4 2026 is a Saturday → Independence Day observed on Fri Jul 3 (closed).
  // The Thursday before (Jul 2) is an early close 1:15pm ct.
  assert.deepEqual(cmeDay('2026-07-02'), { status: 'early', label: 'early close' })
})

/* ------------------------------------------------------------------ */
/* nextModifiedHoursDay — the nudge the owner sees in zen.             */
/* Scans the next 90 days from `fromIso` for any early-halt or         */
/* early-close CME day and returns the soonest.                        */
/* ------------------------------------------------------------------ */

test('nextModifiedHoursDay: from 2026-08-08 (today) finds day after Thanksgiving 2026', () => {
  // The 2026 modified-hours days (Jan 19, Feb 16, May 25, Jul 2, Nov 27, Dec 24, Dec 31)
  // are all in the past relative to 2026-08-08 except Nov 27 (111 days away),
  // Dec 24 (138d), Dec 31 (145d). withinDays=120 picks up Nov 27.
  const next = nextModifiedHoursDay('2026-08-08', 120)
  assert.ok(next)
  assert.equal(next!.iso, '2026-11-27')
  assert.equal(next!.kind, 'early-close')
  assert.equal(next!.reason, 'day after Thanksgiving')
  assert.equal(next!.daysAway, 111)
})

test('nextModifiedHoursDay: from 2026-01-05 finds MLK Day 2026 (Jan 19)', () => {
  const next = nextModifiedHoursDay('2026-01-05')
  assert.ok(next)
  assert.equal(next!.iso, '2026-01-19')
  assert.equal(next!.kind, 'early-halt')
  assert.equal(next!.reason, 'MLK Day')
  assert.equal(next!.daysAway, 14)
})

test('nextModifiedHoursDay: from 2026-07-01 finds Jul 2 (day before Independence Day)', () => {
  const next = nextModifiedHoursDay('2026-07-01')
  assert.ok(next)
  assert.equal(next!.iso, '2026-07-02')
  assert.equal(next!.kind, 'early-close')
  assert.equal(next!.reason, 'day before Independence Day')
  assert.equal(next!.daysAway, 1)
})

test('nextModifiedHoursDay: from 2026-12-01 finds Dec 24 (Christmas Eve)', () => {
  const next = nextModifiedHoursDay('2026-12-01')
  assert.ok(next)
  assert.equal(next!.iso, '2026-12-24')
  assert.equal(next!.kind, 'early-close')
  assert.equal(next!.reason, 'Christmas Eve')
})

test('nextModifiedHoursDay: from 2026-12-25 finds Dec 31 (New Year\'s Eve)', () => {
  const next = nextModifiedHoursDay('2026-12-25')
  assert.ok(next)
  assert.equal(next!.iso, '2026-12-31')
  assert.equal(next!.kind, 'early-close')
  assert.equal(next!.reason, "New Year's Eve")
})

test('nextModifiedHoursDay: from 2026-12-26 returns Dec 31 (soonest, 5 days away)', () => {
  // Dec 31 is closer than MLK 2027 (Jan 18, 23 days). The function returns
  // the soonest match. To skip to next year, use a fromIso strictly after Dec 31.
  const next = nextModifiedHoursDay('2026-12-26')
  assert.ok(next)
  assert.equal(next!.iso, '2026-12-31')
  assert.equal(next!.kind, 'early-close')
  assert.equal(next!.reason, "New Year's Eve")
  assert.equal(next!.daysAway, 5)
})

test('nextModifiedHoursDay: from 2027-01-01 wraps to MLK Day 2027 (Jan 18)', () => {
  const next = nextModifiedHoursDay('2027-01-01')
  assert.ok(next)
  assert.equal(next!.iso, '2027-01-18')
  assert.equal(next!.kind, 'early-halt')
  assert.equal(next!.reason, 'MLK Day')
})

test('nextModifiedHoursDay: respects withinDays horizon', () => {
  // From 2026-12-01, within 7 days should find Dec 24? No — 23 days away.
  // Within 30 days from 2026-12-01: no modified-hours days (Dec 24 is 23d away → fits).
  const within30 = nextModifiedHoursDay('2026-12-01', 30)
  assert.equal(within30?.iso, '2026-12-24')
  // Within 20 days from 2026-12-01: no match.
  const within20 = nextModifiedHoursDay('2026-12-01', 20)
  assert.equal(within20, null)
})

test('nextModifiedHoursDay: pins the next ~24 months of known dates (regression guard)', () => {
  // These are the dates the owner provided in the 2026 CME schedule.
  // If the rules drift, this test fails — the nudge would show a wrong day.
  assert.equal(nextModifiedHoursDay('2026-01-01')?.iso, '2026-01-19') // MLK
  assert.equal(nextModifiedHoursDay('2026-02-01')?.iso, '2026-02-16') // Presidents
  assert.equal(nextModifiedHoursDay('2026-05-01')?.iso, '2026-05-25') // Memorial
  assert.equal(nextModifiedHoursDay('2026-07-01')?.iso, '2026-07-02') // Day before Indep
  assert.equal(nextModifiedHoursDay('2026-11-15')?.iso, '2026-11-27') // Day after Thanks
  assert.equal(nextModifiedHoursDay('2026-12-15')?.iso, '2026-12-24') // Christmas Eve
  assert.equal(nextModifiedHoursDay('2026-12-28')?.iso, '2026-12-31') // NYE
  // 2027
  assert.equal(nextModifiedHoursDay('2027-01-01')?.iso, '2027-01-18') // MLK 2027
})

test('cmeDay: day after Thanksgiving is an early close', () => {
  // Thanksgiving 2026 = 4th Thu Nov = 2026-11-26; day after = Fri 2026-11-27
  assert.deepEqual(cmeDay('2026-11-27'), { status: 'early', label: 'early close' })
})

test('cmeDay: Christmas Eve is an early close', () => {
  // 2026-12-24 is a Thursday
  assert.deepEqual(cmeDay('2026-12-24'), { status: 'early', label: 'early close' })
})

test('cmeDay: early close only applies on weekdays (weekend wins)', () => {
  // New Year's Eve 2023 = Sunday 2023-12-31 → weekend, not early close
  assert.deepEqual(cmeDay('2023-12-31'), { status: 'closed', label: 'weekend' })
})

test('cmeDay: observed holiday shift (Sunday -> Monday after)', () => {
  // Independence Day 2026 = Sat 2026-07-04 → observed Fri 2026-07-03
  assert.deepEqual(cmeDay('2026-07-03'), { status: 'closed', label: 'holiday' })
  assert.deepEqual(cmeDay('2026-07-04'), { status: 'closed', label: 'weekend' })
})
