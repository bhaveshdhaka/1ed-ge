import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectDayNumber } from '../src/lib/dates'
import { nowHkt, hktDayNumber } from '../src/lib/sessions'

test('projectDayNumber starts at 1 on day zero', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z')), 1)
})
test('projectDayNumber is NOT capped at 730 (no two-year hardcode)', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z') + 900 * 86400000), 901)
})
test('projectDayNumber floors at 1', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z') - 86400000), 1)
})
test('nowHkt returns the YYYY-MM-DDTHH:MM HKT wall-time shape', () => {
  assert.match(nowHkt(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
})
test('hktDayNumber returns an HKT calendar-day number', () => {
  assert.equal(typeof hktDayNumber('2026-08-08T12:00:00Z'), 'number')
  assert.ok(Number.isInteger(hktDayNumber('2026-08-08T12:00:00Z')))
  // A UTC timestamp after 16:00 shifts into the next HKT day (+8h).
  assert.equal(hktDayNumber('2026-08-07T16:01:00Z'), hktDayNumber('2026-08-08T00:00:00Z'))
  assert.notEqual(hktDayNumber('2026-08-07T15:59:00Z'), hktDayNumber('2026-08-07T16:01:00Z'))
})
