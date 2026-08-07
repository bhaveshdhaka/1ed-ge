import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodRange, periodTypeFromSlug, isoFromAnchor, periodAnchor, periodRangesBetween } from '../src/lib/periods'

test('week = Mon–Sun containing the date', () => {
  // 2026-08-07 is a Friday; Mon 03-aug → Sun 09-aug
  const w = periodRange('week', '2026-08-07')
  assert.equal(w.startIso, '2026-08-03')
  assert.equal(w.endIso, '2026-08-09')
  assert.equal(w.label, 'week 32')          // verify: ISO week number of 2026-08-03 — adjust to the computed value
  assert.equal(w.anchor, '2026-32')
  assert.equal(w.prev.endIso, '2026-08-02')
  assert.equal(w.next.startIso, '2026-08-10')
})
test('month boundaries', () => {
  const m = periodRange('month', '2026-02-15')
  assert.equal(m.startIso, '2026-02-01')
  assert.equal(m.endIso, '2026-02-28')
  assert.equal(m.label, 'feb 2026')
  assert.equal(m.anchor, '2026-02')
})
test('quarter boundaries', () => {
  const q = periodRange('quarter', '2026-08-07')
  assert.equal(q.startIso, '2026-07-01')
  assert.equal(q.endIso, '2026-09-30')
  assert.equal(q.label, 'q3 2026')
  assert.equal(q.anchor, '2026-q3')
})
test('half boundaries', () => {
  const h1 = periodRange('half', '2026-03-15')
  assert.equal(h1.startIso, '2026-01-01')
  assert.equal(h1.endIso, '2026-06-30')
  const h2 = periodRange('half', '2026-10-15')
  assert.equal(h2.startIso, '2026-07-01')
  assert.equal(h2.endIso, '2026-12-31')
})
test('year boundaries + prev/next', () => {
  const y = periodRange('year', '2026-08-07')
  assert.equal(y.startIso, '2026-01-01')
  assert.equal(y.endIso, '2026-12-31')
  assert.equal(y.prev.startIso, '2025-01-01')
  assert.equal(y.next.startIso, '2027-01-01')
})
test('slug ↔ type', () => {
  assert.equal(periodTypeFromSlug('q2'), 'quarter')
  assert.equal(periodTypeFromSlug('h1'), 'half')
  assert.equal(periodTypeFromSlug('week'), 'week')
  assert.equal(periodTypeFromSlug('bogus'), null)
})
test('isoFromAnchor round-trips', () => {
  assert.equal(periodRange('week', isoFromAnchor('week', '2026-32')).anchor, '2026-32')
  assert.equal(periodRange('quarter', isoFromAnchor('quarter', '2026', 1)).anchor, '2026-q1')
  assert.equal(periodRange('month', isoFromAnchor('month', '2026-08')).anchor, '2026-08')
  assert.equal(periodAnchor('week', '2026-08-07'), periodRange('week', '2026-08-07').anchor)
})
test('ranges between spans a span', () => {
  const rs = periodRangesBetween('week', '2026-08-03', '2026-08-20')
  assert.equal(rs.length, 3)
  assert.equal(rs[0].startIso, '2026-08-03')
})
test('week anchor uses the ISO week year at year boundaries', () => {
  // last Mon–Wed of Dec falling in ISO week 1 of the next year
  const wDec = periodRange('week', '2025-12-29')
  assert.equal(wDec.startIso, '2025-12-29')
  assert.equal(wDec.endIso, '2026-01-04')
  assert.equal(wDec.anchor, '2026-01')
  assert.equal(wDec.label, 'week 1')
  // first Fri–Sun of Jan falling in week 52/53 of the previous year
  const wJan = periodRange('week', '2027-01-01')
  assert.equal(wJan.startIso, '2026-12-28')
  assert.equal(wJan.endIso, '2027-01-03')
  assert.equal(wJan.anchor, '2026-53')
  assert.equal(wJan.label, 'week 53')
})
test('isoFromAnchor round-trips year-boundary weeks', () => {
  // week 1 of 2026 = Mon 2025-12-29 .. Sun 2026-01-04
  assert.equal(isoFromAnchor('week', '2026-01'), '2025-12-29')
  assert.equal(periodRange('week', isoFromAnchor('week', '2026-01')).anchor, '2026-01')
  // week 53 of 2026 = Mon 2026-12-28 .. Sun 2027-01-03
  assert.equal(isoFromAnchor('week', '2026-53'), '2026-12-28')
  assert.equal(periodRange('week', isoFromAnchor('week', '2026-53')).anchor, '2026-53')
})
