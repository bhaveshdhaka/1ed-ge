import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  parseCsv,
  parseUsd,
  parsePerformanceCsv,
  parseOrdersCsv,
  ctToHkt,
  groupFillsToPositions,
  resolveAlias,
  ingestFiles,
} from '../src/lib/ingest'

const DEMO = '/tmp/opencode/import-demo'
const PERF4 = `${DEMO}/mshwf7m4-Performance_4_.csv`
const ORD6 = `${DEMO}/mshwf7pi-Orders_6_.csv`
const hasDemo = fs.existsSync(PERF4) && fs.existsSync(ORD6)

function dataUrl(mime: string, file: string): string {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

test('parseCsv handles quotes and CRLF', () => {
  const rows = parseCsv('a,"b,c",d\r\ne,f,g\n')
  assert.deepEqual(rows, [
    ['a', 'b,c', 'd'],
    ['e', 'f', 'g'],
  ])
})

test('parseCsv handles escaped quotes and blank lines', () => {
  const rows = parseCsv('a,"b""c",d\n\nx,y\n')
  assert.deepEqual(rows, [
    ['a', 'b"c', 'd'],
    ['x', 'y'],
  ])
})

test('parseUsd handles parens-notation negatives', () => {
  assert.equal(parseUsd('$0.50'), 0.5)
  assert.equal(parseUsd('$(29.00)'), -29)
  assert.equal(parseUsd('$32.00'), 32)
})

test('ctToHkt converts the demo Chicago timestamp to HKT (summer DST)', () => {
  const iso = ctToHkt('08/06/2026 21:33:00')
  assert.ok(iso, 'expected an ISO string')
  assert.equal(iso.slice(0, 10), '2026-08-07')
  assert.equal(iso.slice(11, 16), '10:33')
})

test('ctToHkt honors winter DST (CST = UTC-6)', () => {
  const iso = ctToHkt('01/15/2026 12:00:00')
  assert.ok(iso, 'expected an ISO string')
  assert.equal(iso.slice(0, 10), '2026-01-16')
  assert.equal(iso.slice(11, 16), '02:00')
})

test('ctToHkt returns null for malformed input', () => {
  assert.equal(ctToHkt('nope'), null)
  assert.equal(ctToHkt(''), null)
})

test('demo Performance CSV parses to 30 fills', { skip: !hasDemo && 'demo files absent' }, () => {
  const text = fs.readFileSync(PERF4, 'utf8')
  const fills = parsePerformanceCsv(parseCsv(text))
  assert.equal(fills.length, 30)
  assert.ok(fills[0].buyFillId && fills[0].sellFillId)
  assert.equal(fills[0].symbol, 'MNQU6')
  assert.equal(fills[0].pnl, 0.5)
  // Real column mapping: pnl is col 9, times are cols 10/11.
  assert.equal(fills[0].buyTime?.slice(0, 10), '2026-08-07')
  assert.equal(fills[0].buyTime?.slice(11, 16), '10:33')
})

test('demo Orders CSV parses rows with the real column mapping', { skip: !hasDemo && 'demo files absent' }, () => {
  const text = fs.readFileSync(ORD6, 'utf8')
  const rows = parseOrdersCsv(parseCsv(text))
  assert.ok(rows.length >= 30, `expected ~35 rows, got ${rows.length}`)
  const first = rows[0]
  assert.equal(first.orderId, '611527630004')
  assert.equal(first.platformId, 'LTE05061295040002')
  assert.equal(first.symbol, 'MNQU6')
  assert.equal(first.side, 'buy')
  assert.equal(first.price, 29260.75)
  assert.equal(first.qty, 1)
  assert.equal(first.time?.slice(0, 10), '2026-08-07')
  assert.equal(first.time?.slice(11, 16), '10:33')
})

test('demo fills group to a small number of positions', { skip: !hasDemo && 'demo files absent' }, () => {
  const text = fs.readFileSync(PERF4, 'utf8')
  const fills = parsePerformanceCsv(parseCsv(text))
  const positions = groupFillsToPositions(fills, {
    internalId: 'x',
    platformId: 'LTE05061295040002',
    confirmed: true,
  })
  assert.ok(positions.length >= 1 && positions.length <= 8, `expected ~4 positions, got ${positions.length}`)
  assert.equal(positions[0].market, 'MNQ')
  assert.ok(positions[0].size > 0 && positions[0].points !== 0)
  assert.ok(positions[0].start && positions[0].end, 'start/end HKT ISOs set')
  assert.ok(positions[0].fingerprint.includes('MNQ|'))
})

test('groupFillsToPositions clusters by 10-minute gaps', () => {
  const base = { buyTime: null, sellTime: null, pnl: 0, buyPrice: null, sellPrice: null }
  const fills = [
    { ...base, symbol: 'MNQU6', qty: 1, buyPrice: 100, sellPrice: 101, buyTime: '2026-08-07T10:00:00.000Z', sellTime: '2026-08-07T10:01:00.000Z' },
    { ...base, symbol: 'MNQU6', qty: 1, buyPrice: 101, sellPrice: 102, buyTime: '2026-08-07T10:02:00.000Z', sellTime: '2026-08-07T10:03:00.000Z' },
    { ...base, symbol: 'MNQU6', qty: 1, buyPrice: 200, sellPrice: 201, buyTime: '2026-08-07T11:00:00.000Z', sellTime: '2026-08-07T11:01:00.000Z' },
  ]
  const positions = groupFillsToPositions(fills, { internalId: null, platformId: null, confirmed: false })
  assert.equal(positions.length, 2)
  assert.equal(positions[0].fillCount, 2)
  assert.equal(positions[0].direction, 'long')
  assert.equal(positions[1].fillCount, 1)
})

test('resolveAlias maps known platform ids and suggests for unknown', () => {
  const accounts = [{ id: 'lucid-50k-a', platformIds: ['LTE05061295040002'] }, { id: 'tpt-25k-a' }]
  assert.deepEqual(resolveAlias('LTE05061295040002', accounts), { internalId: 'lucid-50k-a', candidates: [], suggested: null })
  const unknown = resolveAlias('LTE099999', accounts)
  assert.equal(unknown.internalId, null)
  assert.deepEqual(unknown.candidates, ['lucid-50k-a', 'tpt-25k-a'])
  assert.equal(unknown.suggested, 'lucid-50k-a')
})

test('ingestFiles attributes, groups and flags dups end-to-end (demo CSVs)', { skip: !hasDemo && 'demo files absent' }, async () => {
  const res = await ingestFiles(
    [
      { name: 'Performance_4_.csv', dataUrl: dataUrl('text/csv', PERF4) },
      { name: 'Orders_6_.csv', dataUrl: dataUrl('text/csv', ORD6) },
    ],
    {
      accounts: [{ id: 'lucid-50k-a' }],
    },
  )
  // Both files are same-day fills → one HKT date.
  assert.equal(res.date, '2026-08-07')
  assert.ok(res.proposals.length >= 1 && res.proposals.length <= 8)
  assert.ok(res.platformIdsSeen.includes('LTE05061295040002'), 'orders platform id collected')
  // Fill-ids are a different ID space than order-ids on the demo files, so the
  // fills stay unattributed → one alias proposal for the owner to confirm.
  assert.ok(res.aliasProposal, 'expected an alias proposal for unattributed fills')
  assert.equal(res.aliasProposal!.suggested, 'lucid-50k-a')
})

test('ingestFiles marks dups against existing trades', { skip: !hasDemo && 'demo files absent' }, async () => {
  const res = await ingestFiles([{ name: 'Performance_4_.csv', dataUrl: dataUrl('text/csv', PERF4) }], {
    accounts: [{ id: 'lucid-50k-a' }],
    existingTrades: [{ market: 'MNQ', direction: 'long', entry: 29252.88, exit: 29261 }],
  })
  assert.ok(res.dupes >= 1, `expected ≥1 dup against existingTrades, got ${res.dupes}`)
  const dup = res.proposals.find((p) => p.dup)
  assert.ok(dup, 'a proposal should be flagged dup')
})
