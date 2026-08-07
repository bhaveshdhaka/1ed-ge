import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmtHuman, segmentAt, type StripSegment } from '../src/lib/strip'

test('fmtHuman: sub-15min values render as mm:ss chronograph', () => {
  assert.equal(fmtHuman(0), '00:00')
  assert.equal(fmtHuman(5), '00:05')
  assert.equal(fmtHuman(272), '04:32')
  assert.equal(fmtHuman(899), '14:59')
})

test('fmtHuman: 15min and above render as duration', () => {
  assert.equal(fmtHuman(900), '15m')
  assert.equal(fmtHuman(3600), '1h')
  assert.equal(fmtHuman(5740), '1h 35m')
  assert.equal(fmtHuman(86400), '1d')
  assert.equal(fmtHuman(90000), '1d 1h')
})

test('fmtHuman: clamps negatives and rounds', () => {
  assert.equal(fmtHuman(-5), '00:00')
  assert.equal(fmtHuman(5.6), '00:06')
  assert.equal(fmtHuman(899.6), '15m')
})

function seg(at: number, until: number): StripSegment {
  return { market: 'cme', at, until, text: 'open · closes in', cls: 'up' }
}

test('segmentAt: returns the segment containing now', () => {
  const segs = [seg(1000, 2000), seg(2000, 3000)]
  assert.deepEqual(segmentAt(segs, 2500), segs[1])
  assert.deepEqual(segmentAt(segs, 1000), segs[0])
  // inclusive start, exclusive end
  assert.deepEqual(segmentAt(segs, 1999), segs[0])
  assert.deepEqual(segmentAt(segs, 2000), segs[1])
})

test('segmentAt: null when now is past the last segment or no segments', () => {
  const segs = [seg(1000, 2000)]
  assert.equal(segmentAt(segs, 2000), null)
  assert.equal(segmentAt(segs, 5000), null)
  assert.equal(segmentAt([], 100), null)
})
