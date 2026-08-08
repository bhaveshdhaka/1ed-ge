import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cmeDay } from '../src/lib/market'

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
  assert.deepEqual(cmeDay('2027-01-18'), { status: 'early-halt', label: 'early halt 12pm ct' })
})

test('cmeDay: Presidents Day is an early-halt day', () => {
  // 3rd Monday of Feb 2026 = 2026-02-16
  assert.deepEqual(cmeDay('2026-02-16'), { status: 'early-halt', label: 'early halt 12pm ct' })
})

test('cmeDay: Memorial Day is an early-halt day', () => {
  // Last Monday of May 2026 = 2026-05-25
  assert.deepEqual(cmeDay('2026-05-25'), { status: 'early-halt', label: 'early halt 12pm ct' })
})

test('cmeDay: Jul 2 2026 is an early-close day (day before Friday-observed Independence Day)', () => {
  // Jul 4 2026 is a Saturday → Independence Day observed on Fri Jul 3 (closed).
  // The Thursday before (Jul 2) is an early close 1:15pm CT.
  assert.deepEqual(cmeDay('2026-07-02'), { status: 'early', label: 'early close' })
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
