import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodRange, periodTypeFromSlug, isoFromAnchor, periodAnchor, periodRangesBetween, resolvePeriod, publicAnchor, slugFromType } from '../src/lib/periods'

test('week = Mon–Fri trading week containing the date', () => {
  // 2026-08-07 is a Friday; Mon 03-aug → Fri 07-aug
  const w = periodRange('week', '2026-08-07')
  assert.equal(w.startIso, '2026-08-03')
  assert.equal(w.endIso, '2026-08-07')
  assert.equal(w.label, 'week 32')
  assert.equal(w.anchor, '2026-32')
  assert.equal(w.prev.endIso, '2026-07-31')
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
test('isoFromAnchor parses embedded quarter suffix', () => {
  assert.equal(isoFromAnchor('quarter', '2026-q1'), '2026-02-15')
  assert.equal(isoFromAnchor('quarter', '2026-q2'), '2026-05-15')
  assert.equal(isoFromAnchor('quarter', '2026-q3'), '2026-08-15')
  assert.equal(isoFromAnchor('quarter', '2026-q4'), '2026-11-15')
})
test('isoFromAnchor parses embedded half suffix', () => {
  assert.equal(isoFromAnchor('half', '2026-h1'), '2026-04-15')
  assert.equal(isoFromAnchor('half', '2026-h2'), '2026-10-15')
})
test('isoFromAnchor explicit index overrides the embedded suffix', () => {
  assert.equal(isoFromAnchor('quarter', '2026-q2', 1), '2026-02-15')
  assert.equal(isoFromAnchor('half', '2026-h2', 1), '2026-04-15')
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
  assert.equal(wDec.endIso, '2026-01-02')
  assert.equal(wDec.anchor, '2026-01')
  assert.equal(wDec.label, 'week 1')
  // first Fri of Jan falling in week 52/53 of the previous year
  const wJan = periodRange('week', '2027-01-01')
  assert.equal(wJan.startIso, '2026-12-28')
  assert.equal(wJan.endIso, '2027-01-01')
  assert.equal(wJan.anchor, '2026-53')
  assert.equal(wJan.label, 'week 53')
})
test('isoFromAnchor round-trips year-boundary weeks', () => {
  // week 1 of 2026 = Mon 2025-12-29 .. Fri 2026-01-02
  assert.equal(isoFromAnchor('week', '2026-01'), '2025-12-29')
  assert.equal(periodRange('week', isoFromAnchor('week', '2026-01')).anchor, '2026-01')
  // week 53 of 2026 = Mon 2026-12-28 .. Fri 2027-01-01
  assert.equal(isoFromAnchor('week', '2026-53'), '2026-12-28')
  assert.equal(periodRange('week', isoFromAnchor('week', '2026-53')).anchor, '2026-53')
})
test('resolvePeriod — bare quarter/half slugs = that index of the CURRENT year', () => {
  // sanity: week 32 of 2026 = Mon 03-aug → Fri 07-aug
  assert.equal(periodRange('week', '2026-08-08').anchor, '2026-32')
  assert.equal(resolvePeriod('q1', undefined, '2026-08-08')!.anchor, '2026-q1')
  assert.equal(resolvePeriod('q1', undefined, '2026-08-08')!.label, 'q1 2026')
  assert.equal(resolvePeriod('q3', undefined, '2026-08-08')!.anchor, '2026-q3') // bare honors the slug index, not today's month
  assert.equal(resolvePeriod('h2', undefined, '2026-08-08')!.anchor, '2026-h2')
  assert.equal(resolvePeriod('q1', undefined, '2027-01-15')!.anchor, '2027-q1') // rolls with the year
})
test('resolvePeriod — quarter/half anchors are canonical year-only', () => {
  assert.equal(resolvePeriod('q1', '2026', '2026-08-08')!.anchor, '2026-q1')
  assert.equal(resolvePeriod('q1', '2026-q1', '2026-08-08'), null) // alias → 404
  assert.equal(resolvePeriod('q1', '2026-q2', '2026-08-08'), null) // embedded suffix no longer silently renders q1
})
test('resolvePeriod — week/month/year keep their anchored forms', () => {
  assert.equal(resolvePeriod('week', undefined, '2026-08-08')!.anchor, '2026-32')
  assert.equal(resolvePeriod('week', '2026-32', '2026-08-08')!.anchor, '2026-32')
  assert.equal(resolvePeriod('month', '2026-08', '2026-08-08')!.anchor, '2026-08')
  assert.equal(resolvePeriod('year', '2026', '2026-08-08')!.anchor, '2026')
})
test('resolvePeriod — malformed/mismatched anchors → null', () => {
  assert.equal(resolvePeriod('week', '2026-32/extra', '2026-08-08'), null) // nested junk
  assert.equal(resolvePeriod('week', '2026', '2026-08-08'), null) // month-style anchor in week
  assert.equal(resolvePeriod('month', '2026', '2026-08-08'), null) // year-style anchor in month
  assert.equal(resolvePeriod('bogus', undefined, '2026-08-08'), null) // unknown slug
})
test('resolvePeriod — future periods do not resolve by default (caller 404s or redirects)', () => {
  // entirely-future anchored periods
  assert.equal(resolvePeriod('week', '2026-33', '2026-08-08'), null) // starts mon 10-aug
  assert.equal(resolvePeriod('week', '2026-40', '2026-08-08'), null)
  assert.equal(resolvePeriod('month', '2026-09', '2026-08-08'), null)
  assert.equal(resolvePeriod('month', '2027-01', '2026-08-08'), null)
  assert.equal(resolvePeriod('year', '2027', '2026-08-08'), null)
  // future quarters/halves of the current year (bare + anchored)
  assert.equal(resolvePeriod('q4', undefined, '2026-08-08'), null) // q4 2026 starts 01-oct
  assert.equal(resolvePeriod('q4', '2026', '2026-08-08'), null)
  assert.equal(resolvePeriod('h2', '2027', '2026-08-08'), null)
  // past + in-progress periods still resolve
  assert.equal(resolvePeriod('q3', undefined, '2026-08-08')!.anchor, '2026-q3') // in progress (01-jul..30-sep)
  assert.equal(resolvePeriod('h2', undefined, '2026-08-08')!.anchor, '2026-h2') // in progress
  assert.equal(resolvePeriod('week', undefined, '2026-08-08')!.anchor, '2026-32') // current week
  assert.equal(resolvePeriod('month', '2026-08', '2026-08-08')!.anchor, '2026-08') // current month
  assert.equal(resolvePeriod('q1', '2026', '2026-08-08')!.anchor, '2026-q1') // past
  // boundary: a period that STARTS today is not future (it resolves); the day
  // before its start is still future
  assert.equal(resolvePeriod('week', '2026-33', '2026-08-09'), null) // 09-aug, day before week 33 starts
  assert.equal(resolvePeriod('week', '2026-33', '2026-08-10')?.anchor ?? null, '2026-33') // starts exactly today
})

test('resolvePeriod — allowFuture returns the future range (caller detects futurity → redirects)', () => {
  // future periods resolve with the opt — the redirect target is today's period of the same type
  const futureWeek = resolvePeriod('week', '2026-33', '2026-08-08', { allowFuture: true })
  assert.ok(futureWeek)
  assert.equal(futureWeek!.startIso, '2026-08-10')
  const currentWeek = periodRange('week', '2026-08-08')
  assert.equal(slugFromType(currentWeek.type, currentWeek.index), 'week') // → /week
  const futureQ4 = resolvePeriod('q4', undefined, '2026-08-08', { allowFuture: true })
  assert.ok(futureQ4)
  assert.equal(futureQ4!.anchor, '2026-q4')
  const currentQuarter = periodRange('quarter', '2026-08-08')
  assert.equal(slugFromType(currentQuarter.type, currentQuarter.index), 'q3') // → /q3
  const futureYear = resolvePeriod('year', '2027', '2026-08-08', { allowFuture: true })
  assert.ok(futureYear)
  assert.equal(futureYear!.anchor, '2027')
  // malformed anchors stay null even with allowFuture
  assert.equal(resolvePeriod('q1', '2026-q1', '2026-08-08', { allowFuture: true }), null) // alias → 404, not redirect
  assert.equal(resolvePeriod('week', '2026-32/extra', '2026-08-08', { allowFuture: true }), null)
})
test('public URLs round-trip through resolvePeriod (prev + archive links)', () => {
  const today = '2026-08-08'
  for (const type of ['week', 'month', 'quarter', 'half', 'year'] as const) {
    const range = periodRange(type, today)
    // range.next is the FUTURE period here (today is 08-aug-2026) — it must not resolve
    assert.equal(resolvePeriod(slugFromType(range.next.type, range.next.index), publicAnchor(range.next.type, range.next.anchor), today), null, `${type}: future next must 404`)
    for (const r of [range, range.prev]) {
      const slug = slugFromType(r.type, r.index)
      const anchor = publicAnchor(r.type, r.anchor)
      const rt = resolvePeriod(slug, anchor, today)
      assert.ok(rt, `${type}: resolvePeriod('${slug}', '${anchor}') must resolve`)
      assert.equal(rt.anchor, r.anchor)
    }
  }
})
test('publicAnchor strips quarter/half suffix only', () => {
  assert.equal(publicAnchor('quarter', '2026-q3'), '2026')
  assert.equal(publicAnchor('half', '2026-h1'), '2026')
  assert.equal(publicAnchor('week', '2026-32'), '2026-32')
  assert.equal(publicAnchor('month', '2026-08'), '2026-08')
  assert.equal(publicAnchor('year', '2026'), '2026')
})
