import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daySessionWindows, scheduledDayMarker, addDaysIso } from '../src/lib/sessions'
import { cmeDay } from '../src/lib/market'

/* ------------------------------------------------------------------ */
/* Regression: HKT-day boundary in the CME halt lookup.                */
/*   Pre-fix: Mon 2026-08-03 returned '~23h', Tue 2026-08-04 returned  */
/*   'halt 05:00–06:00' — same data, different output.                 */
/*   Post-fix: every normal CME weekday attributes its halt/resume     */
/*   to the correct HKT-day (addDaysIso(iso, 1)).                       */
/*                                                                     */
/* Design note on Friday: marketEvents emits a `close` (label          */
/* 'weekend close') on Friday at 16:00 CT — NOT a halt. The day-       */
/* marker therefore shows '~23h' for Friday, which is correct (the     */
/* session is open continuously for ~23h, no scheduled maintenance).   */
/* Mon–Thu show the 05:00–06:00 HKT halt window.                        */
/* ------------------------------------------------------------------ */

test('sessions: regression — two consecutive normal CME days now produce the same window', () => {
  // The original user-reported bug: Mon 2026-08-03 and Tue 2026-08-04
  // were rendering different CME window strings. They must match now.
  const mon = daySessionWindows('2026-08-03')
  const tue = daySessionWindows('2026-08-04')
  assert.equal(mon.cme, tue.cme, `Mon cme=${mon.cme} but Tue cme=${tue.cme}`)
  assert.equal(mon.cme, 'halt 05:00–06:00')
})

test('sessions: Mon–Thu in summer (CDT) all halts 05:00–06:00 HKT', () => {
  // 2026-08-03 (Mon) through 2026-08-06 (Thu) — all normal CME days with halt
  for (const d of ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']) {
    assert.equal(cmeDay(d).status, 'open', `${d} should be a normal CME day`)
    assert.equal(daySessionWindows(d).cme, 'halt 05:00–06:00', `${d} should show the halt`)
  }
})

test('sessions: Friday has no halt (weekend close instead) → shows ~23h', () => {
  // 2026-08-07 is Friday. marketEvents emits a `close` event (label
  // 'weekend close') at 16:00 CT, not a halt/resume pair. The day-marker
  // legitimately shows '~23h' — the session IS open ~23h with no break.
  assert.equal(cmeDay('2026-08-07').status, 'open')
  assert.equal(daySessionWindows('2026-08-07').cme, '~23h')
})

test('sessions: Saturday/Sunday are closed', () => {
  assert.equal(daySessionWindows('2026-08-08').cme, 'closed') // Sat
  assert.equal(daySessionWindows('2026-08-09').cme, 'closed') // Sun
})

test('sessions: CME early-close day shows the HKT time, DST-aware (no raw CT)', () => {
  // 2026-11-27 is the day after Thanksgiving — CME early close 13:15 CT.
  // November = CST (UTC-6): 13:15 CT = 19:15 UTC = 03:15 HKT next day.
  assert.equal(cmeDay('2026-11-27').status, 'early')
  assert.equal(daySessionWindows('2026-11-27').cme, 'early close 03:15 hkt')
  // 2026-12-24 is Christmas Eve — same winter close.
  assert.equal(daySessionWindows('2026-12-24').cme, 'early close 03:15 hkt')
})

test('sessions: CME holiday is closed (no halt, no early close)', () => {
  // 2026-12-25 is Friday Christmas — CME closed.
  assert.equal(cmeDay('2026-12-25').status, 'closed')
  assert.equal(daySessionWindows('2026-12-25').cme, 'closed')
  // 2026-07-03 (Fri) is the observed Independence Day.
  assert.equal(daySessionWindows('2026-07-03').cme, 'closed')
})

test('sessions: NYSE/TSE/LSE windows are unaffected by the CME halt fix', () => {
  // TSE is JST → HKT (+1h, no DST in JST): 09:00 JST = 08:00 HKT, 15:30 JST = 14:30 HKT.
  // NYSE summer (EDT): 09:30 ET = 21:30 HKT, 16:00 ET = 04:00 HKT next day.
  // LSE summer (BST): 08:00 BST = 15:00 HKT, 16:30 BST = 23:30 HKT.
  const mon = daySessionWindows('2026-08-03')
  assert.equal(mon.nyse, '21:30→04:00')
  assert.equal(mon.tse, '08:00–14:30')
  assert.equal(mon.lse, '15:00→23:30')
})

test('sessions: scheduledDayMarker renders a normal past day as "○ open" (state only, no schedule window)', () => {
  // The day-page header / calendar row header describe STATE, not the
  // per-day schedule window. Friday ("~23h") and Mon–Thu ("halt 05:00–06:00")
  // are both 23h CME sessions — the header should be identical.
  const mk = scheduledDayMarker('2026-08-03')
  assert.equal(mk.glyph, '○')
  assert.equal(mk.text, 'open')
  assert.equal(mk.cls, 'text-dim')
  assert.equal(mk.live, false)
})

test('sessions: scheduledDayMarker for a weekend is the closed glyph', () => {
  const mk = scheduledDayMarker('2026-08-08') // Sat
  assert.equal(mk.glyph, '✕')
  assert.equal(mk.cls, 'text-down')
  assert.equal(mk.live, false)
})

test('sessions: scheduledDayMarker for an early-close day is "◐ early close {hkt} hkt" (DST-aware)', () => {
  const mk = scheduledDayMarker('2026-11-27') // day after Thanksgiving (CST → 03:15 hkt)
  assert.equal(mk.glyph, '◐')
  assert.equal(mk.text, 'early close 03:15 hkt')
  assert.equal(mk.cls, 'text-warn')
})

test('sessions: scheduledDayMarker for early-halt days shows HKT time, DST-aware', () => {
  // The owner trades from Asia and wants these flagged because volume
  // is thin. The header is the at-a-glance state; the live ticker
  // (MarketWidget) shows the live countdown. All early-halts are 12:00 CT
  // — but that is 02:00 HKT in winter (CST) and 01:00 HKT in summer (CDT).
  const mlk = scheduledDayMarker('2027-01-18')       // MLK Day 2027 (winter CST → 02:00 hkt)
  const pres = scheduledDayMarker('2026-02-16')      // Presidents' Day 2026 (winter CST → 02:00 hkt)
  const mem = scheduledDayMarker('2026-05-25')       // Memorial Day 2026 (summer CDT → 01:00 hkt)
  for (const mk of [mlk, pres, mem]) {
    assert.equal(mk.glyph, '◐')
    assert.equal(mk.cls, 'text-warn')
    assert.equal(mk.live, false)
  }
  assert.equal(mlk.text, 'early halt 02:00 hkt')
  assert.equal(pres.text, 'early halt 02:00 hkt')
  assert.equal(mem.text, 'early halt 01:00 hkt')
})

test('sessions: daySessionWindows for early-halt days shows HKT time, DST-aware', () => {
  assert.equal(daySessionWindows('2027-01-18').cme, 'early halt 02:00 hkt') // winter
  assert.equal(daySessionWindows('2026-02-16').cme, 'early halt 02:00 hkt') // winter
  assert.equal(daySessionWindows('2026-05-25').cme, 'early halt 01:00 hkt') // summer
})

test('sessions: daySessionWindows for the Jul 2 2026 early-close shows HKT time', () => {
  // Jul 2 2026 is early close at 12:00 CT (not 13:15 — owner-provided data).
  // July = CDT (UTC-5): 12:00 CT = 17:00 UTC = 01:00 HKT next day.
  assert.equal(daySessionWindows('2026-07-02').cme, 'early close 01:00 hkt')
})

test('sessions: addDaysIso handles month/year boundaries', () => {
  assert.equal(addDaysIso('2026-08-31', 1), '2026-09-01')
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01')
  assert.equal(addDaysIso('2026-01-01', -1), '2025-12-31')
})

test('sessions: scheduledDayMarker is consistent across all of one trading week', () => {
  // All five weekdays are 23h CME sessions — the header must be identical.
  // Mon–Thu and Fri are both "open" with no schedule-window suffix.
  const week = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
  const markers = week.map((d) => scheduledDayMarker(d).text)
  assert.deepEqual(markers, ['open', 'open', 'open', 'open', 'open'])
  const glyphs = week.map((d) => scheduledDayMarker(d).glyph)
  assert.deepEqual(glyphs, ['○', '○', '○', '○', '○'])
})
