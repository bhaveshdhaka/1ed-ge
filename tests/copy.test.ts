import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  liveLine,
  pendingReflectionsLine,
  periodHeader,
  REFLECTION,
  COMPARISON,
  THE_NUMBERS,
  TREND,
  EMPTY_PERIOD,
} from '../src/lib/copy'

test('liveLine: live → trader is live', () => {
  assert.equal(liveLine(true, null), 'trader is live')
  assert.equal(liveLine(true, 3), 'trader is live')
})

test('liveLine: offline with lastSeenDays → trader is offline · last seen {n}d ago', () => {
  assert.equal(liveLine(false, 0), 'trader is offline · last seen 0d ago')
  assert.equal(liveLine(false, 1), 'trader is offline · last seen 1d ago')
  assert.equal(liveLine(false, 14), 'trader is offline · last seen 14d ago')
})

test('liveLine: offline with no last-seen data → trader is offline', () => {
  assert.equal(liveLine(false, null), 'trader is offline')
})

test('pendingReflectionsLine: null when nothing pending', () => {
  assert.equal(pendingReflectionsLine(0, []), null)
  assert.equal(pendingReflectionsLine(0, ['']), null)
})

test('pendingReflectionsLine: singular day → 1 day\'s', () => {
  assert.equal(
    pendingReflectionsLine(1, []),
    "trader has 1 day's pending end of day reflection",
  )
})

test('pendingReflectionsLine: plural days → {n} days\'', () => {
  assert.equal(
    pendingReflectionsLine(2, []),
    "trader has 2 days' pending end of day reflection",
  )
  assert.equal(
    pendingReflectionsLine(5, []),
    "trader has 5 days' pending end of day reflection",
  )
})

test('pendingReflectionsLine: period fragments only, joined with · and "reflection missing" suffix', () => {
  assert.equal(
    pendingReflectionsLine(0, ['week 31']),
    'week 31 reflection missing',
  )
  assert.equal(
    pendingReflectionsLine(0, ['week 31', 'month']),
    'week 31 reflection missing · month reflection missing',
  )
  assert.equal(
    pendingReflectionsLine(0, ['month', 'quarter', 'half', 'year']),
    'month reflection missing · quarter reflection missing · half reflection missing · year reflection missing',
  )
})

test('pendingReflectionsLine: combined days + period fragments', () => {
  assert.equal(
    pendingReflectionsLine(2, ['week 31']),
    "trader has 2 days' pending end of day reflection · week 31 reflection missing",
  )
  assert.equal(
    pendingReflectionsLine(1, ['week 31', 'month']),
    "trader has 1 day's pending end of day reflection · week 31 reflection missing · month reflection missing",
  )
})

test('periodHeader: {label} · {fmtDayW(startIso)} → {fmtDayW(endIso)}', () => {
  assert.equal(
    periodHeader({ label: 'week 32', startIso: '2026-08-03', endIso: '2026-08-07' }),
    'week 32 · mon | 03-aug-2026 → fri | 07-aug-2026',
  )
  assert.equal(
    periodHeader({ label: 'month', startIso: '2026-08-01', endIso: '2026-08-31' }),
    'month · sat | 01-aug-2026 → mon | 31-aug-2026',
  )
  assert.equal(
    periodHeader({ label: 'year', startIso: '2026-01-01', endIso: '2026-12-31' }),
    'year · thu | 01-jan-2026 → thu | 31-dec-2026',
  )
})

test('section labels are owner-locked strings', () => {
  assert.equal(REFLECTION, 'reflection')
  assert.equal(COMPARISON, 'comparison · from verified data')
  assert.equal(THE_NUMBERS, 'the numbers')
  assert.equal(TREND, 'trend')
})

test('empty states are owner-locked strings', () => {
  assert.equal(EMPTY_PERIOD, 'no days logged in this period.')
})
