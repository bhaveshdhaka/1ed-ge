import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  detectTradovateCsv,
  parsePerformance,
  parsePositionHistory,
  parseOrders,
  buildTradovateResult,
  parseTradovateCsvText,
  applyMentalStop,
  type TradovateEntry,
  type TradovateOrder,
} from '../src/lib/tradovate'
import { parseCsv, ctToHkt } from '../src/lib/ingest'

const DIR = '/root/tradovate-reports'
const PERF = `${DIR}/Performance (7).csv`
const POS = `${DIR}/Position History.csv`
const ORD = `${DIR}/Orders (9).csv`
const CASH = `${DIR}/Cash History.csv`
const hasDemo = fs.existsSync(PERF) && fs.existsSync(POS) && fs.existsSync(ORD) && fs.existsSync(CASH)

const rowsOf = (f: string) => parseCsv(fs.readFileSync(f, 'utf8'))

/** A long round trip: buy @ 100 10:00 → sell @ 105 10:10 (HKT ISOs). */
function longTrip(over: Partial<Parameters<typeof buildTradovateResult>[0][number]> = {}): Parameters<typeof buildTradovateResult>[0][number] {
  return {
    key: 'b1|s1',
    symbol: 'MNQU6',
    buyPrice: 100,
    sellPrice: 105,
    qty: 1,
    pnl: 10,
    buyTime: '2026-08-14T10:00:00.000Z',
    sellTime: '2026-08-14T10:10:00.000Z',
    platformId: null,
    ...over,
  }
}

// ---------------------------------------------------------------------------
// CSV detection
// ---------------------------------------------------------------------------

test('detectTradovateCsv recognises all four exports', { skip: !hasDemo && 'sample files absent' }, () => {
  assert.equal(detectTradovateCsv(rowsOf(PERF)), 'performance')
  assert.equal(detectTradovateCsv(rowsOf(POS)), 'position')
  assert.equal(detectTradovateCsv(rowsOf(ORD)), 'orders')
  assert.equal(detectTradovateCsv(rowsOf(CASH)), 'cash')
  assert.equal(detectTradovateCsv([['a', 'b'], ['1', '2']]), null)
})

// ---------------------------------------------------------------------------
// Deterministic parsers (real sample, one export set per account)
// ---------------------------------------------------------------------------

test('Performance CSV parses 25 round trips with fill-id pair keys', { skip: !hasDemo && 'sample files absent' }, () => {
  const trips = parsePerformance(rowsOf(PERF))
  assert.equal(trips.length, 25)
  const first = trips[0]
  assert.equal(first.key, '620926680030|620926680012')
  assert.equal(first.symbol, 'MNQU6')
  assert.equal(first.buyPrice, 30152.25)
  assert.equal(first.sellPrice, 30160.25)
  assert.equal(first.pnl, 16)
  assert.equal(first.qty, 1)
  assert.equal(first.platformId, null)
  // CT wall times → HKT ISOs (09:00:50 CT = 22:00:50 HKT same day).
  assert.equal(first.sellTime, '2026-08-14T22:00:50.000Z')
  assert.equal(first.buyTime, '2026-08-14T22:01:27.000Z')
  // '$(6.00)' parens-notation negative parses.
  assert.equal(trips[2].pnl, -6)
})

test('Position History CSV parses 25 round trips with the account column', { skip: !hasDemo && 'sample files absent' }, () => {
  const trips = parsePositionHistory(rowsOf(POS))
  assert.equal(trips.length, 25)
  const first = trips[0]
  assert.equal(first.key, '620926680030|620926680012')
  assert.equal(first.platformId, 'LTF05061295040001')
  assert.equal(first.positionId, '620926680014')
  assert.equal(first.pairId, '620926680032')
  assert.equal(first.pnl, 16)
  // P/L comes as a plain number in this file, not '$'-formatted.
  assert.equal(first.buyPrice, 30152.25)
  assert.equal(first.sellPrice, 30160.25)
})

test('Performance and Position History share the same pair keys (no double count)', { skip: !hasDemo && 'sample files absent' }, () => {
  const perf = parsePerformance(rowsOf(PERF)).map((t) => t.key)
  const pos = parsePositionHistory(rowsOf(POS)).map((t) => t.key)
  assert.deepEqual(new Set(perf), new Set(pos))
  assert.equal(perf.length, 25)
})

test('Orders CSV parses only filled orders with type + stop price', { skip: !hasDemo && 'sample files absent' }, () => {
  const orders = parseOrders(rowsOf(ORD))
  // 40 rows total, 3 canceled → 37 filled.
  assert.equal(orders.length, 37)
  const first = orders[0]
  assert.equal(first.orderId, '620926680007')
  assert.equal(first.platformId, 'LTF05061295040001')
  assert.equal(first.symbol, 'MNQU6')
  assert.equal(first.side, 'sell')
  assert.equal(first.type, 'market')
  assert.equal(first.status, 'filled')
  assert.equal(first.time, '2026-08-14T22:00:50.000Z')
  const limit = orders.find((o) => o.orderId === '620926680023')
  assert.ok(limit)
  assert.equal(limit.type, 'limit')
  assert.equal(limit.side, 'buy')
})

test('ctToHkt: sample timestamps land on HKT day 2026-08-14 (earliest fill)', () => {
  assert.equal(ctToHkt('08/14/2026 09:00:50')?.slice(0, 10), '2026-08-14')
  assert.equal(ctToHkt('08/14/2026 09:00:50')?.slice(11, 16), '22:00')
  assert.equal(ctToHkt('08/14/2026 21:35:01')?.slice(0, 10), '2026-08-15')
})

// ---------------------------------------------------------------------------
// buildTradovateResult — attribution, multi-account, risk artifacts
// ---------------------------------------------------------------------------

test('Position History alone: trades attributed to the account, unlinked → alias proposal', { skip: !hasDemo && 'sample files absent' }, () => {
  const res = buildTradovateResult([], parsePositionHistory(rowsOf(POS)), [], { accounts: [{ id: 'lucid-50k-a' }] })
  assert.equal(res.trades.length, 25)
  assert.equal(res.date, '2026-08-14')
  const t = res.trades[0]
  assert.equal(t.key, '620926680030|620926680012')
  assert.equal(t.direction, 'short') // sell 09:00:50 before buy 09:01:27
  assert.equal(t.entry, 30160.25)
  assert.equal(t.exit, 30152.25)
  assert.equal(t.points, 8)
  assert.equal(t.pnl, 16)
  assert.equal(t.accounts.length, 1)
  assert.equal(t.accounts[0].platformId, 'LTF05061295040001')
  assert.equal(t.accounts[0].internalId, null) // platform id not linked yet
  assert.equal(t.accounts[0].confirmed, false)
  assert.ok(res.unlinkedPlatformIds.includes('LTF05061295040001'))
  assert.ok(res.aliasProposals.some((p) => p.platformId === 'LTF05061295040001' && p.suggested === 'lucid-50k-a'))
})

test('known platform id maps straight to the internal account', { skip: !hasDemo && 'sample files absent' }, () => {
  const res = buildTradovateResult([], parsePositionHistory(rowsOf(POS)), [], {
    accounts: [{ id: 'lucid-50k-a', platformIds: ['LTF05061295040001'] }],
  })
  const t = res.trades[0]
  assert.equal(t.accounts[0].internalId, 'lucid-50k-a')
  assert.equal(t.accounts[0].confirmed, true)
  assert.equal(res.aliasProposals.length, 0)
  assert.equal(res.unlinkedPlatformIds.length, 0)
})

test('same round trip in two accounts merges into ONE trade with two account rows', () => {
  const a = longTrip({ key: 'b1|s1', platformId: 'ACCT-A', qty: 1, pnl: 10 })
  const b = longTrip({ key: 'b1|s1', platformId: 'ACCT-B', qty: 2, pnl: 20 })
  const res = buildTradovateResult([], [a, b], [], {
    accounts: [
      { id: 'a1', platformIds: ['ACCT-A'] },
      { id: 'b1', platformIds: ['ACCT-B'] },
    ],
  })
  assert.equal(res.trades.length, 1)
  const t = res.trades[0]
  assert.equal(t.accounts.length, 2)
  assert.deepEqual(
    t.accounts.map((x) => x.internalId),
    ['a1', 'b1'],
  )
  assert.equal(t.qty, 3)
  assert.equal(t.pnl, 30)
  assert.equal(t.market, 'MNQ')
  assert.equal(t.direction, 'long')
  assert.equal(t.points, 5)
})

test('Performance-only exports stay unattributed and surface one alias proposal', () => {
  const res = buildTradovateResult([longTrip()], [], [], { accounts: [{ id: 'lucid-50k-a' }] })
  assert.equal(res.trades.length, 1)
  const t = res.trades[0]
  assert.equal(t.accounts[0].platformId, null)
  assert.equal(t.accounts[0].internalId, null)
  assert.ok(res.aliasProposals.some((p) => p.platformId === '' && p.suggested === 'lucid-50k-a'))
})

test('Performance + Position History of the same day do not double-count', { skip: !hasDemo && 'sample files absent' }, () => {
  const res = buildTradovateResult(parsePerformance(rowsOf(PERF)), parsePositionHistory(rowsOf(POS)), [], {
    accounts: [],
  })
  assert.equal(res.trades.length, 25)
})

// ---------------------------------------------------------------------------
// Orders enrichment — exit type + recorded stop + honest mae/mfe
// ---------------------------------------------------------------------------

function order(over: Partial<TradovateOrder> = {}): TradovateOrder {
  return {
    orderId: 'o1',
    platformId: 'ACCT-A',
    symbol: 'MNQU6',
    side: 'sell',
    price: 100,
    qty: 1,
    time: '2026-08-14T10:05:00.000Z',
    status: 'filled',
    type: 'market',
    stopPrice: null,
    ...over,
  }
}

test('no stop orders → needsStop true, stop null (the SL prompt target)', { skip: !hasDemo && 'sample files absent' }, () => {
  const res = buildTradovateResult([], parsePositionHistory(rowsOf(POS)), parseOrders(rowsOf(ORD)), {
    accounts: [{ id: 'lucid-50k-a', platformIds: ['LTF05061295040001'] }],
  })
  assert.equal(res.trades.length, 25)
  assert.ok(res.trades.every((t) => t.needsStop === true))
  assert.ok(res.trades.every((t) => t.stop === null && t.stopSource === null))
  assert.ok(res.trades.every((t) => t.riskPoints === null))
})

test('closing limit order → exitType limit, mfe floor on winners, mae on losers', () => {
  const orders = [
    // entry sell (short) + closing buy limit at target
    order({ orderId: 'e1', side: 'sell', price: 30160.25, time: '2026-08-14T22:00:50.000Z', type: 'market' }),
    order({ orderId: 'c1', side: 'buy', price: 30152.25, time: '2026-08-14T22:01:27.000Z', type: 'limit' }),
  ]
  const trips = [
    { key: 'b1|s1', symbol: 'MNQU6', buyPrice: 30152.25, sellPrice: 30160.25, qty: 1, pnl: 16, buyTime: '2026-08-14T22:01:27.000Z', sellTime: '2026-08-14T22:00:50.000Z', platformId: 'ACCT-A' },
  ]
  const res = buildTradovateResult([], trips, orders, { accounts: [{ id: 'a1', platformIds: ['ACCT-A'] }] })
  const t = res.trades[0]
  assert.equal(t.direction, 'short')
  assert.equal(t.exitType, 'limit')
  assert.equal(t.mfe, 8) // proven bound: price traded at the exit price
  assert.equal(t.mae, null) // winner → no adverse excursion provable
  assert.equal(t.points, 8)
})

test('recorded stop from a Stop order → riskPoints derived, needsStop false', () => {
  const orders = [
    order({ orderId: 's1', side: 'buy', price: 99, time: '2026-08-14T10:05:00.000Z', type: 'stop', stopPrice: 99 }),
    order({ orderId: 'x1', side: 'sell', price: 104, time: '2026-08-14T10:10:00.000Z', type: 'market' }),
  ]
  const res = buildTradovateResult([], [longTrip({ platformId: 'ACCT-A' })], orders, {
    accounts: [{ id: 'a1', platformIds: ['ACCT-A'] }],
  })
  const t = res.trades[0]
  assert.equal(t.stop, 99)
  assert.equal(t.stopSource, 'recorded')
  assert.equal(t.needsStop, false)
  assert.equal(t.riskPoints, 1)
})

test('stopped out → exitType stop and mae EXACT (never a bound)', () => {
  const orders = [
    // short: entry sell @ 100, protective buy stop @ 101.5, filled there
    order({ orderId: 'e1', side: 'sell', price: 100, time: '2026-08-14T10:00:00.000Z', type: 'market' }),
    order({ orderId: 's1', side: 'buy', price: 101.5, time: '2026-08-14T10:05:00.000Z', type: 'stop', stopPrice: 101.5 }),
  ]
  const trips = [
    { key: 'b1|s1', symbol: 'MNQU6', buyPrice: 101.5, sellPrice: 100, qty: 1, pnl: -3, buyTime: '2026-08-14T10:05:00.000Z', sellTime: '2026-08-14T10:00:00.000Z', platformId: 'ACCT-A' },
  ]
  const res = buildTradovateResult([], trips, orders, { accounts: [{ id: 'a1', platformIds: ['ACCT-A'] }] })
  const t = res.trades[0]
  assert.equal(t.direction, 'short')
  assert.equal(t.exitType, 'stop')
  assert.equal(t.mae, 1.5) // exact: the stop-out fill ends the trade at its worst
  assert.equal(t.mfe, null)
  assert.equal(t.stop, 101.5)
  assert.equal(t.riskPoints, 1.5)
})

test('a market exit that breached the recorded stop counts as a stop-out', () => {
  const orders = [
    order({ orderId: 's1', side: 'buy', price: 101.5, time: '2026-08-14T10:04:00.000Z', type: 'stop', stopPrice: 101.5 }),
    order({ orderId: 'x1', side: 'buy', price: 102, time: '2026-08-14T10:05:00.000Z', type: 'market' }),
  ]
  const trips = [
    { key: 'b1|s1', symbol: 'MNQU6', buyPrice: 102, sellPrice: 100, qty: 1, pnl: -4, buyTime: '2026-08-14T10:05:00.000Z', sellTime: '2026-08-14T10:00:00.000Z', platformId: 'ACCT-A' },
  ]
  const res = buildTradovateResult([], trips, orders, { accounts: [{ id: 'a1', platformIds: ['ACCT-A'] }] })
  assert.equal(res.trades[0].exitType, 'stop')
  assert.equal(res.trades[0].mae, 2)
})

test('losers carry a proven mae floor when not stopped out', () => {
  const orders = [
    order({ orderId: 'x1', side: 'sell', price: 96, time: '2026-08-14T10:10:00.000Z', type: 'market' }),
  ]
  // losing long: buy 100 → sell 96
  const res = buildTradovateResult(
    [],
    [longTrip({ platformId: 'ACCT-A', sellPrice: 96, pnl: -8 })],
    orders,
    { accounts: [{ id: 'a1', platformIds: ['ACCT-A'] }] },
  )
  const t = res.trades[0]
  assert.equal(t.points, -4)
  assert.equal(t.exitType, 'market')
  assert.equal(t.mae, 4) // loss → adverse excursion ≥ |exit − entry|
  assert.equal(t.mfe, null)
})

test('existing keys are flagged dup for re-imports', () => {
  const res = buildTradovateResult([], [longTrip({ platformId: 'ACCT-A' })], [], {
    accounts: [{ id: 'a1', platformIds: ['ACCT-A'] }],
    existingKeys: ['b1|s1'],
  })
  assert.equal(res.trades[0].dup, true)
  assert.equal(res.dupeCount, 1)
})

test('parseTradovateCsvText routes each file kind (cash skipped)', { skip: !hasDemo && 'sample files absent' }, () => {
  const perf = parseTradovateCsvText(fs.readFileSync(PERF, 'utf8'))
  assert.equal(perf.kind, 'performance')
  assert.equal(perf.perf.length, 25)
  const pos = parseTradovateCsvText(fs.readFileSync(POS, 'utf8'))
  assert.equal(pos.kind, 'position')
  assert.equal(pos.pos.length, 25)
  const ord = parseTradovateCsvText(fs.readFileSync(ORD, 'utf8'))
  assert.equal(ord.kind, 'orders')
  assert.equal(ord.orders.length, 37)
  const cash = parseTradovateCsvText(fs.readFileSync(CASH, 'utf8'))
  assert.equal(cash.kind, 'cash')
  assert.equal(cash.perf.length + cash.pos.length + cash.orders.length, 0)
})

// ---------------------------------------------------------------------------
// Mental SL prompt flow
// ---------------------------------------------------------------------------

test('applyMentalStop stores the mental stop and derives riskPoints', () => {
  const t: TradovateEntry = {
    key: 'k',
    market: 'MNQ',
    direction: 'long',
    entry: 100,
    exit: 105,
    points: 5,
    qty: 1,
    pnl: 10,
    accounts: [{ platformId: 'ACCT-A', internalId: 'a1', confirmed: true, qty: 1, pnl: 10 }],
    stop: null,
    stopSource: null,
    mentalStop: null,
    needsStop: true,
    riskPoints: null,
    exitType: 'market',
    mae: null,
    mfe: 5,
    dup: false,
  }
  const withStop = applyMentalStop(t, 99.5)
  assert.equal(withStop.mentalStop, 99.5)
  assert.equal(withStop.stop, 99.5)
  assert.equal(withStop.stopSource, 'mental')
  assert.equal(withStop.needsStop, false)
  assert.equal(withStop.riskPoints, 0.5)
})

test('applyMentalStop clears a mental stop back to needing the prompt', () => {
  const t = applyMentalStop(
    { ...({} as TradovateEntry), key: 'k', market: 'MNQ', direction: 'long', entry: 100, exit: 105, points: 5, qty: 1, pnl: 10, accounts: [], stop: null, stopSource: null, mentalStop: null, needsStop: true, riskPoints: null, exitType: 'unknown', mae: null, mfe: 5 },
    99.5,
  )
  const cleared = applyMentalStop(t, null)
  assert.equal(cleared.mentalStop, null)
  assert.equal(cleared.stop, null)
  assert.equal(cleared.needsStop, true)
  assert.equal(cleared.riskPoints, null)
})

test('the full sample end-to-end: 25 trades, all need the mental SL, honest bounds', { skip: !hasDemo && 'sample files absent' }, () => {
  const res = buildTradovateResult(
    parsePerformance(rowsOf(PERF)),
    parsePositionHistory(rowsOf(POS)),
    parseOrders(rowsOf(ORD)),
    { accounts: [{ id: 'lucid-50k-a', platformIds: ['LTF05061295040001'] }] },
  )
  assert.equal(res.trades.length, 25)
  assert.equal(res.date, '2026-08-14')
  // Every sample trade lacks a stop order → the prompt applies to all.
  assert.equal(res.trades.filter((t) => t.needsStop).length, 25)
  // Winners carry an mfe floor; losers a mae floor; nothing is invented.
  const wins = res.trades.filter((t) => t.points > 0)
  const losses = res.trades.filter((t) => t.points < 0)
  assert.ok(wins.length > 0 && losses.length > 0)
  assert.ok(wins.every((t) => t.mfe != null && t.mfe === Math.abs(t.entry - t.exit)))
  assert.ok(losses.every((t) => t.mae != null && t.mae === Math.abs(t.entry - t.exit)))
  // mae/mfe never both null, never both set on the same side.
  for (const t of res.trades) assert.ok(t.mae == null || t.mfe == null)
  // per-account pnl sums to the day's total across the batch.
  const sumPnl = res.trades.reduce((s, t) => s + t.pnl, 0)
  const sumAcc = res.trades.reduce((s, t) => s + t.accounts.reduce((x, a) => x + a.pnl, 0), 0)
  assert.equal(Math.round(sumPnl), Math.round(sumAcc))
})
