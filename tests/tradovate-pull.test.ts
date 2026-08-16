import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildEncryptedPassword,
  loadTradovateCreds,
  loadEnvFile,
  pullReportCsv,
  httpFailureClass,
  tradovatePullDisabled,
  pullsRemaining,
  tradovateWindow,
  feedPullIntoLedger,
  mergeTwoStagePull,
  openPositionsFrom,
  TradovatePullError,
} from '../src/lib/tradovate-pull'
import { parseTradovateCsvText, type TradovateEntry } from '../src/lib/tradovate'

// ---------------------------------------------------------------------------
// Credentials — never printed, wrong-file-in-right-place fails kind
// ---------------------------------------------------------------------------

test('loadEnvFile reads bare KEY=VALUE lines', () => {
  const tmp = path.join(os.tmpdir(), `tv-env-${Date.now()}.env`)
  fs.writeFileSync(tmp, 'TRADOVATE_USER=alice\nTRADOVATE_PASS=p@ss\n# comment\n\n')
  const env = loadEnvFile(tmp)
  assert.equal(env.TRADOVATE_USER, 'alice')
  assert.equal(env.TRADOVATE_PASS, 'p@ss')
  assert.equal(env['# comment'], undefined)
  fs.rmSync(tmp, { force: true })
})

test('loadTradovateCreds reads a file and returns a pair (value untouched)', () => {
  const tmp = path.join(os.tmpdir(), `tv-secrets-${Date.now()}.env`)
  fs.writeFileSync(tmp, 'TRADOVATE_USER=alice\nTRADOVATE_PASS=s3cret\n')
  const creds = loadTradovateCreds(tmp)
  assert.ok(creds)
  assert.equal(creds.user, 'alice')
  assert.equal(creds.password, 's3cret')
  fs.rmSync(tmp, { force: true })
})

test('loadTradovateCreds returns null when nothing is configured', () => {
  const absent = path.join(os.tmpdir(), `tv-absent-${Date.now()}.env`)
  assert.equal(loadTradovateCreds(absent), null)
})

test('buildEncryptedPassword is deterministic and matches the web-app rotation', () => {
  // rotation: rotate left by name.length % password.length, reverse, base64.
  const password = 'abcdef'
  const name = 'ab' // name.length(2) % 6 = 2
  // rotate left 2 → 'cdefab'; reverse → 'bafedc'; base64 of latin1
  const expected = Buffer.from('bafedc', 'latin1').toString('base64')
  assert.equal(buildEncryptedPassword(password, name), expected)
})

// ---------------------------------------------------------------------------
// Fail-closed transport classification — no retry on 401/429
// ---------------------------------------------------------------------------

test('httpFailureClass fails closed on 401 (auth) and 429 (rate-limit)', () => {
  assert.equal(httpFailureClass(200), 'ok')
  assert.equal(httpFailureClass(401), 'auth')
  assert.equal(httpFailureClass(429), 'rate-limit')
  assert.equal(httpFailureClass(500), 'other')
})

test('pullReportCsv throws (no retry) on 401 and 429', async () => {
  const orig = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response('{"errorText":"unauth"}', { status: 401 })
  }) as unknown as typeof fetch

  const opts = {
    token: 't', account: 'LTF05061295040001', report: 'Orders' as const,
    startDate: '08/01/2026', endDate: '08/15/2026',
  }
  await assert.rejects(() => pullReportCsv(opts), (e: unknown) => {
    assert.ok(e instanceof TradovatePullError)
    assert.equal((e as TradovatePullError).status, 401)
    return true
  })
  assert.equal(calls, 1, 'fail closed — exactly one attempt, no retry')

  globalThis.fetch = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch
  await assert.rejects(() => pullReportCsv(opts), (e: unknown) => (e as TradovatePullError).status === 429)
  globalThis.fetch = orig
})

// ---------------------------------------------------------------------------
// Stop switch + low-frequency budget
// ---------------------------------------------------------------------------

test('tradovatePullDisabled honors the env stop switch', () => {
  const prev = process.env.TRADOVATE_PULL_DISABLED
  delete process.env.TRADOVATE_PULL_DISABLED
  assert.equal(tradovatePullDisabled().disabled, false)
  process.env.TRADOVATE_PULL_DISABLED = '1'
  assert.equal(tradovatePullDisabled().disabled, true)
  process.env.TRADOVATE_PULL_DISABLED = prev
})

test('pullsRemaining enforces the daily budget', () => {
  const records = [{ date: '2026-08-15', count: 4 }]
  assert.equal(pullsRemaining(records, '2026-08-15', 5), 1)
  assert.equal(pullsRemaining(records, '2026-08-15', 4), 0)
  assert.equal(pullsRemaining(records, '2026-08-14', 5), 5) // different day resets
})

test('tradovateWindow builds an MM/DD/YYYY window ending at the date', () => {
  const { startDate, endDate } = tradovateWindow('2026-08-15', 7)
  assert.equal(endDate, '08/15/2026')
  assert.equal(startDate, '08/09/2026')
})

// ---------------------------------------------------------------------------
// Pulled CSV text → ledger entries (the CSV-MVP reuse, via the puller)
// ---------------------------------------------------------------------------

const PERF_HEADER = 'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration'
const POS_HEADER =
  'Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp'
const ORD_HEADER =
  'orderId,Account,Order ID,B/S,Contract,Product,Product Description,avgPrice,filledQty,Fill Time,lastCommandId,Status,_priceFormat,_priceFormatType,_tickSize,spreadDefinitionId,Version ID,Timestamp,Date,Quantity,Text,Type,Limit Price,Stop Price'

const ACCOUNTS = [{ id: 'lucid-50k-a', platformIds: ['LTF05061295040001'] }]

/** A performance CSV row for one long MNQ round trip (buy→sell, P/L +$10). */
function perfRow(buyId: string, sellId: string, qty = 1): string {
  return `MNQU6,-2,0,0.25,${buyId},${sellId},${qty},100,105,$${(10 * qty).toFixed(2)},08/14/2026 10:00:00,08/14/2026 10:10:00,10min`
}

/** A position-history row for the same round trip (carries the Account). Passing
 * `sell=''`/`sellTs=''` leaves it an OPEN position (entry only, not yet closed). */
function posRow(positionId: string, buyId: string, sellId: string, account: string, qty = 1, sell = '105', sellTs = '08/14/2026 10:10:00'): string {
  const cols = new Array<string>(26).fill('')
  cols[0] = positionId
  cols[9] = account // Account
  cols[10] = 'MNQU6' // Contract
  cols[16] = `${positionId}-pair` // Pair ID
  cols[17] = buyId // Buy Fill ID
  cols[18] = sellId // Sell Fill ID
  cols[19] = String(qty) // Paired Qty
  cols[20] = '100' // Buy Price
  cols[21] = sell // Sell Price
  cols[22] = String(10 * qty) // P/L
  cols[24] = '08/14/2026 10:00:00' // Bought Timestamp
  cols[25] = sellTs // Sold Timestamp
  return cols.join(',')
}

/** An orders row — a filled Market sell that closes the round trip. Indices
 * follow the real export: [11] Status, [21] Type, [23] Stop Price. */
function orderRow(account: string, stopPrice = ''): string {
  const type = stopPrice ? 'STOP LIMIT' : 'Market'
  const cols = new Array<string>(24).fill('')
  cols[0] = '620000000001' // orderId
  cols[1] = account // Account
  cols[2] = '620000000001' // Order ID
  cols[3] = ' Sell' // B/S (leading space, as real)
  cols[4] = 'MNQU6' // Contract
  cols[5] = 'MNQ'
  cols[6] = 'Micro E-mini NASDAQ-100'
  cols[7] = '105' // avgPrice
  cols[8] = '1' // filledQty
  cols[9] = '08/14/2026 10:10:00' // Fill Time
  cols[10] = '620000000001' // lastCommandId
  cols[11] = ' Filled' // Status
  cols[16] = '620000000001' // Version ID
  cols[17] = '08/14/2026 10:09:59' // Timestamp
  cols[18] = '8/14/26' // Date
  cols[19] = '1' // Quantity
  cols[20] = 'Chart' // Text
  cols[21] = type // Type
  cols[23] = stopPrice // Stop Price
  return cols.join(',')
}

function csv(text: string) {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').join('\n')
}

test('feedPullIntoLedger turns pulled CSV text into trade ledger entries via the parsers', () => {
  const perf = csv(`${PERF_HEADER}\n${perfRow('B1', 'S1')}`)
  const pos = csv(`${POS_HEADER}\n${posRow('9001', 'B1', 'S1', 'LTF05061295040001')}`)
  const orders = csv(`${ORD_HEADER}\n${orderRow('LTF05061295040001')}`)

  const parsed = [perf, pos, orders].map((t) => parseTradovateCsvText(t))
  const perfRows = parsed[0].perf
  const posRows = parsed[1].pos
  const orderRows = parsed[2].orders

  assert.equal(perfRows.length, 1)
  assert.equal(posRows.length, 1)
  assert.equal(orderRows.length, 1)

  const built = feedPullIntoLedger(perfRows, posRows, orderRows, { accounts: ACCOUNTS })
  assert.equal(built.trades.length, 1)
  const t = built.trades[0]
  assert.equal(t.market, 'MNQ')
  assert.equal(t.direction, 'long')
  assert.equal(t.entry, 100)
  assert.equal(t.exit, 105)
  assert.equal(t.points, 5)
  // Same round trip appears in BOTH the Performance and Position History exports —
  // the merge groups them by shared fill ids into ONE trade; qty/pnl sum across
  // the two source rows (this is the cross-file, cross-account dedup working).
  assert.equal(t.qty, 2)
  assert.equal(t.pnl, 20)
  assert.equal(t.accounts.length, 2)
  assert.equal(t.accounts[0].internalId, 'lucid-50k-a') // Position History attributed it
  assert.equal(t.accounts[0].confirmed, true)
  assert.equal(t.accounts[1].platformId, null) // Performance-only row stays unattributed
  // Orders enriched the exit type (Market, no stop price → no recorded stop).
  assert.equal(t.exitType, 'market')
  assert.equal(t.stop, null)
  assert.equal(t.needsStop, true)
})

// ---------------------------------------------------------------------------
// Two-stage single-trade/day link — NEVER a duplicate entry
// ---------------------------------------------------------------------------

test('two-stage pull: same trade pulled twice merges to ONE entry (updated, not fresh)', () => {
  const perf = csv(`${PERF_HEADER}\n${perfRow('B1', 'S1')}`)
  const pos = csv(`${POS_HEADER}\n${posRow('9001', 'B1', 'S1', 'LTF05061295040001')}`)
  const parsed = parseTradovateCsvText(perf)
  const parsedPos = parseTradovateCsvText(pos)

  // Stage 1 — the first pull of the day.
  const s1 = feedPullIntoLedger(parsed.perf, parsedPos.pos, [], { accounts: ACCOUNTS })
  const ledger: TradovateEntry[] = []
  let merge = mergeTwoStagePull(ledger, s1.trades)
  assert.equal(merge.fresh, 1)
  assert.equal(merge.updated, 0)
  assert.equal(merge.merged.length, 1)

  // Stage 2 — the captain pulls again (still same day, same trade).
  const s2 = feedPullIntoLedger(parsed.perf, parsedPos.pos, [], { accounts: ACCOUNTS })
  merge = mergeTwoStagePull(merge.merged, s2.trades)
  assert.equal(merge.fresh, 0, 'stage 2 must not add a new entry')
  assert.equal(merge.updated, 1, 'stage 2 updates the SAME trade in place')
  assert.equal(merge.merged.length, 1, 'still exactly one trade for the day')

  const only = merge.merged[0]
  assert.equal(only.key, 'B1|S1')
  assert.equal(only.market, 'MNQ')
})

test('two-stage pull: in-trade open position → post-trade close lands as ONE trade', () => {
  // Stage 1 — captain is LIVE in the trade: Position History shows the OPEN
  // position (entry filled, no sell side yet) → surfaced as open, no phantom
  // closed entry (the ledger honestly holds nothing until the round trip closes).
  const openPos = posRow('9002', 'B2', '', 'LTF05061295040001', 1, '', '')
  const parsedOpen = parseTradovateCsvText(csv(`${POS_HEADER}\n${openPos}`))
  assert.equal(parsedOpen.pos.length, 1)
  const openInfo = openPositionsFrom(parsedOpen.pos)
  assert.equal(openInfo.length, 1)
  assert.equal(openInfo[0].positionId, '9002')
  assert.equal(openInfo[0].direction, 'long')
  assert.equal(openInfo[0].entry, 100)

  const stage1Ledger = mergeTwoStagePull([], feedPullIntoLedger(parsedOpen.perf, parsedOpen.pos, [], { accounts: ACCOUNTS }).trades)
  assert.equal(stage1Ledger.merged.length, 0, 'open position creates no closed round trip yet')

  // Stage 2 — captain closed the trade: the same positionId now has the paired
  // sell fill → the puller produces the full round trip under the SAME position.
  const closedPos = posRow('9002', 'B2', 'S2', 'LTF05061295040001')
  const parsedClosed = parseTradovateCsvText(csv(`${POS_HEADER}\n${closedPos}`))
  const s2 = feedPullIntoLedger(parsedClosed.perf, parsedClosed.pos, [], { accounts: ACCOUNTS })
  const stage2Ledger = mergeTwoStagePull(stage1Ledger.merged, s2.trades)
  assert.equal(stage2Ledger.merged.length, 1, 'one trade for the whole day, never duplicated across stages')
  assert.equal(stage2Ledger.merged[0].positionId, '9002')
  assert.equal(stage2Ledger.merged[0].entry, 100)
  assert.equal(stage2Ledger.merged[0].exit, 105)
})

test('openPositionsFrom skips closed round trips', () => {
  const closed = posRow('9010', 'B9', 'S9', 'LTF05061295040001')
  const out = openPositionsFrom(parseTradovateCsvText(csv(`${POS_HEADER}\n${closed}`)).pos)
  assert.equal(out.length, 0)
})
