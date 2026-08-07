import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectDayNumber } from '../src/lib/dates'

test('projectDayNumber starts at 1 on day zero', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z')), 1)
})
test('projectDayNumber is NOT capped at 730 (no two-year hardcode)', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z') + 900 * 86400000), 901)
})
test('projectDayNumber floors at 1', () => {
  assert.equal(projectDayNumber(Date.parse('2026-08-05T00:00:00Z') - 86400000), 1)
})
