import { z } from 'zod'
import { parseCsv, ctToHkt, parseUsd, resolveAlias, stripContract, type AliasProposal, type IngestCtx } from './ingest'
import { todayHkt } from './sessions'
import { round2 } from './utils'

/**
 * Tradovate CSV import — the deterministic Tradovate report pipeline.
 *
 * The captain exports daily CSVs from Tradovate, one export set per account:
 *   Performance (7).csv      — paired round trips (buy/sell fill ids + prices)
 *   Position History.csv     — same round trips + the Account column (the
 *                              trade→account attribution bridge, incl. copies)
 *   Orders (9).csv           — raw fills: order type (Market/Limit/Stop), so a
 *                              recorded protective stop can be recovered
 *   Cash History.csv         — funding/commission only — recognized & skipped
 *
 * Every captured data point earns its place: the schema below is the single
 * source of truth (imported by content.config.ts and the admin apply API so
 * files/collection/API/UI agree).
 *
 * Honesty contract for risk artifacts (the captain cares most about MAE/MFE):
 * the CSVs contain fill prices + order types, NOT true intra-trade excursion
 * (that needs tick data). So:
 *   - `stop`     — a protective Stop order price from Orders, when present.
 *                  Never invented. When absent, `needsStop` stays true and the
 *                  SL prompt asks the owner for the (even mental) SL.
 *   - `mae`      — adverse excursion in points. EXACT only when the position
 *                  was stopped out (the exit fill ends the trade at its worst
 *                  point). Otherwise, for a losing trade it is a proven LOWER
 *                  BOUND (the exit price was traded, so the excursion was
 *                  ≥ |exit − entry|). null when nothing is provable.
 *   - `mfe`      — favorable excursion in points. NEVER exact from CSV; for a
 *                  winning trade it is a proven LOWER BOUND (price traded at
 *                  the exit price). null otherwise.
 *   - `exitType` — where the exit order's type came from (market/limit/stop).
 */

// ---------------------------------------------------------------------------
// Schema — single source of truth (content collection + apply API + UI)
// ---------------------------------------------------------------------------

export const tradovateAccountRowSchema = z.object({
  platformId: z.string().nullable(),
  internalId: z.string().nullable(),
  confirmed: z.boolean().default(false),
  qty: z.number(),
  pnl: z.number(),
})

export const tradovateEntrySchema = z.object({
  key: z.string(),
  positionId: z.string().optional(),
  pairId: z.string().optional(),
  market: z.string().default('MNQ'),
  direction: z.enum(['long', 'short']),
  entry: z.number(),
  exit: z.number(),
  points: z.number(),
  start: z.string().optional(),
  end: z.string().optional(),
  qty: z.number(),
  pnl: z.number(),
  accounts: z.array(tradovateAccountRowSchema).default([]),
  // risk artifacts
  stop: z.number().nullable().default(null),
  stopSource: z.enum(['recorded', 'mental']).nullable().default(null),
  mentalStop: z.number().nullable().default(null),
  needsStop: z.boolean().default(true),
  riskPoints: z.number().nullable().default(null),
  exitType: z.enum(['market', 'limit', 'stop', 'stoplimit', 'unknown']).default('unknown'),
  mae: z.number().nullable().default(null),
  mfe: z.number().nullable().default(null),
  dup: z.boolean().default(false), // transient re-import flag — never meaningful in the stored file
})

export type TradovateAccountRow = z.infer<typeof tradovateAccountRowSchema>
export type TradovateEntry = z.infer<typeof tradovateEntrySchema>
export type ExitType = TradovateEntry['exitType']

// ---------------------------------------------------------------------------
// CSV detection + raw parsers (deterministic, header-based — like ingest.ts)
// ---------------------------------------------------------------------------

export type TradovateCsvKind = 'performance' | 'position' | 'orders' | 'cash' | null

/** Header sniff — the 4 known Tradovate exports (+ null for anything else). */
export function detectTradovateCsv(rows: string[][]): TradovateCsvKind {
  const header = (rows[0] ?? []).join(',').toLowerCase()
  if (header.includes('buyfillid')) return 'performance'
  if (header.includes('position id') || header.includes('pair id')) return 'position'
  if (header.includes('orderid') && header.includes('avgprice')) return 'orders'
  if (header.includes('cash change type')) return 'cash'
  return null
}

interface RawRoundTrip {
  key: string
  positionId?: string
  pairId?: string
  symbol: string // raw contract, e.g. 'MNQU6'
  buyPrice: number | null
  sellPrice: number | null
  qty: number
  pnl: number
  buyTime: string | null // HKT ISO
  sellTime: string | null
  platformId: string | null
}

function pairKey(buyFillId: string | undefined, sellFillId: string | undefined, fallback: string): string {
  if (buyFillId && sellFillId) return `${buyFillId}|${sellFillId}`
  return fallback
}

/**
 * Performance CSV → round trips (no account column). Column mapping validated
 * against the real export (`Performance (7).csv`):
 *   [0] symbol [4] buyFillId [5] sellFillId [6] qty [7] buyPrice [8] sellPrice
 *   [9] pnl [10] boughtTimestamp [11] soldTimestamp
 */
export function parsePerformance(rows: string[][]): RawRoundTrip[] {
  const out: RawRoundTrip[] = []
  for (const r of rows) {
    const [symbol, , , , buyFillId, sellFillId, qty, buyPrice, sellPrice, pnl, boughtTs, soldTs] = r
    if (!symbol || !/^[A-Z]/.test(symbol) || /^symbol$/i.test(symbol)) continue
    out.push({
      key: pairKey(buyFillId, sellFillId, `p|${symbol}|${r.join('|')}`),
      symbol,
      buyPrice: buyPrice ? Number(buyPrice) : null,
      sellPrice: sellPrice ? Number(sellPrice) : null,
      qty: Number(qty) || 1,
      pnl: parseUsd(pnl ?? ''),
      buyTime: boughtTs ? ctToHkt(boughtTs) : null,
      sellTime: soldTs ? ctToHkt(soldTs) : null,
      platformId: null,
    })
  }
  return out
}

/**
 * Position History CSV → round trips WITH the account (the attribution bridge).
 * Column mapping validated against the real export:
 *   [0] Position ID [9] Account [10] Contract [16] Pair ID [17] Buy Fill ID
 *   [18] Sell Fill ID [19] Paired Qty [20] Buy Price [21] Sell Price
 *   [22] P/L [24] Bought Timestamp [25] Sold Timestamp
 */
export function parsePositionHistory(rows: string[][]): RawRoundTrip[] {
  const out: RawRoundTrip[] = []
  for (const r of rows) {
    const [positionId, , , , , , , , , account, contract] = r
    if (!/^[0-9]/.test(positionId ?? '')) continue // data rows start with the numeric Position ID; the header doesn't
    const pairId = r[16]
    const buyFillId = r[17]
    const sellFillId = r[18]
    const qty = Number(r[19]) || 1
    const buyPrice = r[20] ? Number(r[20]) : null
    const sellPrice = r[21] ? Number(r[21]) : null
    const pnl = Number(r[22]) || 0
    const boughtTs = r[24]
    const soldTs = r[25]
    out.push({
      key: pairKey(buyFillId, sellFillId, pairId ? `pid|${pairId}` : `p|${contract}|${r.join('|')}`),
      positionId,
      pairId: pairId || undefined,
      symbol: contract,
      buyPrice: Number.isFinite(buyPrice as number) ? buyPrice : null,
      sellPrice: Number.isFinite(sellPrice as number) ? sellPrice : null,
      qty,
      pnl,
      buyTime: boughtTs ? ctToHkt(boughtTs) : null,
      sellTime: soldTs ? ctToHkt(soldTs) : null,
      platformId: account || null,
    })
  }
  return out
}

export interface TradovateOrder {
  orderId: string
  platformId: string
  symbol: string
  side: 'buy' | 'sell' | ''
  price: number
  qty: number
  time: string | null // HKT ISO (Fill Time)
  status: string
  type: string // trimmed lowercase: market | limit | stop | stop limit
  stopPrice: number | null
}

/**
 * Orders CSV → fills. Column mapping validated against the real export:
 *   [0] orderId [1] Account [3] B/S [4] Contract [7] avgPrice [8] filledQty
 *   [9] Fill Time [11] Status [21] Type [23] Stop Price
 */
export function parseOrders(rows: string[][]): TradovateOrder[] {
  const out: TradovateOrder[] = []
  for (const r of rows) {
    const [orderId, account, , side, contract] = r
    if (!orderId || !/^[A-Z0-9]/.test(orderId)) continue
    const status = (r[11] ?? '').trim().toLowerCase()
    if (!status.startsWith('filled')) continue // unfilled orders produced no fill
    const price = Number(r[7])
    const qty = Number(r[8])
    const time = r[9] ? ctToHkt(r[9]) : null
    const type = (r[21] ?? '').trim().toLowerCase()
    const stopPrice = Number(r[23])
    if (!account || !Number.isFinite(price)) continue
    out.push({
      orderId,
      platformId: account,
      symbol: contract,
      side: side?.trim().toLowerCase() === 'sell' ? 'sell' : side?.trim().toLowerCase() === 'buy' ? 'buy' : '',
      price,
      qty: Number.isFinite(qty) ? qty : 1,
      time,
      status,
      type,
      stopPrice: Number.isFinite(stopPrice) ? stopPrice : null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Round-trip → trade normalisation
// ---------------------------------------------------------------------------

/**
 * A round trip is two fills; the EARLIER one is the entry (so a sell-then-buy
 * pair is a short, even though the CSV calls the fills buy/sell). Prices and
 * points follow the site convention: points = exit − entry for long, entry −
 * exit for short.
 */
function rawToBase(raw: RawRoundTrip): { market: string; direction: 'long' | 'short'; entry: number; exit: number; points: number; start: string; end: string } | null {
  const t = raw.buyTime ?? raw.sellTime
  const t2 = raw.sellTime ?? raw.buyTime
  if (!t || !t2) return null
  const buyFirst = t <= t2
  const entry = buyFirst ? raw.buyPrice : raw.sellPrice
  const exit = buyFirst ? raw.sellPrice : raw.buyPrice
  if (entry == null || exit == null || !Number.isFinite(entry) || !Number.isFinite(exit)) return null
  const direction: 'long' | 'short' = buyFirst ? 'long' : 'short'
  return {
    market: stripContract(raw.symbol) || 'MNQ',
    direction,
    entry,
    exit,
    points: round2(direction === 'long' ? exit - entry : entry - exit),
    start: buyFirst ? t : t2,
    end: buyFirst ? t2 : t,
  }
}

// ---------------------------------------------------------------------------
// Order enrichment — exit type + recorded protective stop
// ---------------------------------------------------------------------------

const MATCH_SLACK_MS = 30_000

function inWindow(time: string | null, start: string, end: string): boolean {
  if (!time) return false
  const t = Date.parse(time)
  const s = Date.parse(start) - MATCH_SLACK_MS
  const e = Date.parse(end) + MATCH_SLACK_MS
  return Number.isFinite(t) && t >= s && t <= e
}

/**
 * Recover what the CSV allows: the exit order type (market/limit/stop) and any
 * protective Stop order price, from the account's Orders rows whose fills fall
 * inside the round trip's window. Matching is by account+contract+window only
 * (fill ids live in a different ID space than order ids on real exports) — so
 * a stop is only ever recorded when a real Stop order existed on the same
 * account+contract with a price on the adverse side of the entry. Never
 * invented.
 */
export function enrichWithOrders(base: { entry: number; start: string; end: string; market: string; direction: 'long' | 'short' }, orders: TradovateOrder[], platformId: string | null): { exitType: ExitType; stop: number | null } {
  const rel = orders.filter(
    (o) =>
      o.status === 'filled' &&
      o.time != null &&
      (platformId == null || o.platformId === platformId) &&
      inWindow(o.time, base.start, base.end),
  )
  const closingSide: 'buy' | 'sell' = base.direction === 'long' ? 'sell' : 'buy'
  const closing = rel.filter((o) => o.side === closingSide).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const exitOrder = closing[closing.length - 1] ?? null
  const exitType: ExitType = exitOrder
    ? exitOrder.type === 'stop limit'
      ? 'stoplimit'
      : exitOrder.type === 'stop'
        ? 'stop'
        : exitOrder.type === 'limit'
          ? 'limit'
          : exitOrder.type === 'market'
            ? 'market'
            : 'unknown'
    : 'unknown'

  // Protective stop: a filled Stop/Stop Limit order on the adverse side of the
  // entry, closest to entry wins (that's the one that would trigger first).
  let stop: number | null = null
  let bestDist = Infinity
  for (const o of rel) {
    if (o.type !== 'stop' && o.type !== 'stop limit') continue
    if (o.stopPrice == null) continue
    const adverse = base.direction === 'long' ? o.stopPrice < base.entry : o.stopPrice > base.entry
    if (!adverse) continue
    const d = Math.abs(o.stopPrice - base.entry)
    if (d < bestDist) {
      bestDist = d
      stop = o.stopPrice
    }
  }
  return { exitType, stop }
}

/** A stop-triggered exit is often reported as a Market fill — treat an exit
 * that breached the recorded stop price as a stop-out (exact MAE). */
function effectiveExitType(exitType: ExitType, stop: number | null, base: { direction: 'long' | 'short'; entry: number; exit: number }): ExitType {
  if (exitType === 'stop' || exitType === 'stoplimit') return 'stop'
  if (stop == null) return exitType
  const breached =
    base.direction === 'long' ? base.exit <= stop : base.exit >= stop
  return breached ? 'stop' : exitType
}

// ---------------------------------------------------------------------------
// Orchestration — merge round trips across files/accounts + risk artifacts
// ---------------------------------------------------------------------------

export interface TradovateCtx {
  accounts: IngestCtx['accounts']
  /** keys already stored in the day's draft.tradovate (re-import dup flags). */
  existingKeys?: string[]
}

export interface TradovateImportResult {
  date: string
  trades: TradovateEntry[]
  /** unlinked platform ids (incl. '' for Performance-only round trips). */
  aliasProposals: AliasProposal[]
  unlinkedPlatformIds: string[]
  /** recognized-but-ignored / unrecognised files (e.g. Cash History). */
  skippedFiles: string[]
  dupeCount: number
}

/**
 * Build the day's import from any subset of the 3 kept CSVs (per-account
 * exports tolerated). Position History rows carry the account; the same round
 * trip copied across accounts shares its buy/sell fill ids → one trade, many
 * account rows. Performance-only round trips stay unattributed ('' platform)
 * and surface an alias proposal instead of guessing.
 */
export function buildTradovateResult(
  perf: RawRoundTrip[],
  pos: RawRoundTrip[],
  orders: TradovateOrder[],
  ctx: TradovateCtx,
): TradovateImportResult {
  const byKey = new Map<string, RawRoundTrip[]>()
  // Position History first (has the account) — a matching Performance row is
  // the same round trip (same fill ids) and must not double-count.
  const push = (t: RawRoundTrip) => {
    if (!t.key) return
    if (!byKey.has(t.key)) byKey.set(t.key, [])
    byKey.get(t.key)!.push(t)
  }
  for (const t of pos) push(t)
  for (const t of perf) push(t)

  const trades: TradovateEntry[] = []
  const unlinkedSet = new Set<string>()
  for (const [, rows] of byKey) {
    const base = rawToBase(rows[0])
    if (!base) continue
    // Per-account rows: same key from N accounts = the trade was copied.
    const accounts: TradovateAccountRow[] = []
    let qty = 0
    let pnl = 0
    for (const r of rows) {
      qty += r.qty
      pnl += r.pnl
      const alias = r.platformId ? resolveAlias(r.platformId, ctx.accounts) : { internalId: null, candidates: [] }
      if (r.platformId && alias.internalId === null) unlinkedSet.add(r.platformId)
      accounts.push({
        platformId: r.platformId,
        internalId: alias.internalId,
        confirmed: alias.internalId !== null,
        qty: r.qty,
        pnl: round2(r.pnl),
      })
    }
    // Enrich: consider every account's orders; prefer the most specific exit
    // type and the closest protective stop found anywhere.
    let exitType: ExitType = 'unknown'
    let stop: number | null = null
    for (const r of rows) {
      const en = enrichWithOrders(base, orders, r.platformId)
      const eff = effectiveExitType(en.exitType, en.stop, base)
      const specificity = { stop: 3, stoplimit: 3, limit: 2, market: 1, unknown: 0 } as const
      if (specificity[eff] > specificity[exitType]) exitType = eff
      if (en.stop != null && (stop == null || Math.abs(en.stop - base.entry) < Math.abs(stop - base.entry))) stop = en.stop
    }
    const stoppedOut = exitType === 'stop'
    const loss = base.points < 0
    const win = base.points > 0
    const riskPoints = stop != null ? round2(Math.abs(base.entry - stop)) : null
    trades.push({
      key: rows[0].key,
      ...(rows[0].positionId ? { positionId: rows[0].positionId } : {}),
      ...(rows[0].pairId ? { pairId: rows[0].pairId } : {}),
      market: base.market,
      direction: base.direction,
      entry: base.entry,
      exit: base.exit,
      points: base.points,
      start: base.start,
      end: base.end,
      qty,
      pnl: round2(pnl),
      accounts,
      stop,
      stopSource: stop != null ? 'recorded' : null,
      mentalStop: null,
      needsStop: stop == null,
      riskPoints,
      exitType,
      // Honest excursion: exact only when stopped out; otherwise a proven
      // bound on the traded side (the exit price was traded).
      mae: stoppedOut || loss ? round2(Math.abs(base.entry - base.exit)) : null,
      mfe: win ? round2(Math.abs(base.entry - base.exit)) : null,
      dup: false,
    })
  }

  const existing = new Set(ctx.existingKeys ?? [])
  let dupeCount = 0
  for (const t of trades) {
    if (existing.has(t.key)) {
      t.dup = true
      dupeCount++
    }
  }

  const aliasProposals: AliasProposal[] = []
  const unlinkedPlatformIds = Array.from(unlinkedSet).sort()
  // One proposal per unknown platform id; Performance-only (unattributed)
  // round trips share a single '' proposal like the generic ingest path.
  if (trades.some((t) => t.accounts.some((a) => a.platformId === null))) {
    aliasProposals.push({
      platformId: '',
      candidates: ctx.accounts.map((a) => a.id),
      suggested: ctx.accounts[0]?.id ?? null,
    })
  }
  for (const pid of unlinkedPlatformIds) {
    const alias = resolveAlias(pid, ctx.accounts)
    aliasProposals.push({ platformId: pid, candidates: alias.candidates, suggested: alias.suggested })
  }

  const earliest = trades.length ? [...trades].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))[0].start ?? '' : ''
  const date = earliest ? earliest.slice(0, 10) : todayHkt()

  return { date, trades, aliasProposals, unlinkedPlatformIds, skippedFiles: [], dupeCount }
}

/**
 * Parse one CSV file's text → raw rows for buildTradovateResult. Returns the
 * kind + parsed rows; cash/unknown kinds are skipped (recorded for the UI).
 */
export function parseTradovateCsvText(
  text: string,
): { kind: TradovateCsvKind; perf: RawRoundTrip[]; pos: RawRoundTrip[]; orders: TradovateOrder[] } {
  const rows = parseCsv(text)
  const kind = detectTradovateCsv(rows)
  if (kind === 'performance') return { kind, perf: parsePerformance(rows), pos: [], orders: [] }
  if (kind === 'position') return { kind, perf: [], pos: parsePositionHistory(rows), orders: [] }
  if (kind === 'orders') return { kind, perf: [], pos: [], orders: parseOrders(rows) }
  return { kind, perf: [], pos: [], orders: [] }
}

/** Merge a mental SL into an entry (the SL-prompt store step). Passing null
 * clears a mental SL: a mental stop was the only stop, so the position goes
 * back to needing the prompt (a recorded stop survives the clear). */
export function applyMentalStop(t: TradovateEntry, mentalStop: number | null): TradovateEntry {
  if (mentalStop == null || !Number.isFinite(mentalStop)) {
    const stop = t.stopSource === 'recorded' ? t.stop : null
    return {
      ...t,
      mentalStop: null,
      stop,
      stopSource: stop != null ? 'recorded' : null,
      needsStop: stop == null,
      riskPoints: stop != null ? round2(Math.abs(t.entry - stop)) : null,
    }
  }
  const stop = mentalStop
  return {
    ...t,
    mentalStop,
    stop,
    stopSource: 'mental',
    needsStop: false,
    riskPoints: round2(Math.abs(t.entry - stop)),
  }
}

/**
 * Merge an incoming approved batch into the stored ledger (replace-by-key,
 * append-new). An already-stored mental SL is carried over on re-import — the
 * SL prompt's answer is never lost. Returns the merged ledger + counts.
 */
export function mergeTradovateEntries(
  stored: TradovateEntry[],
  incoming: TradovateEntry[],
): { merged: TradovateEntry[]; fresh: number; updated: number; needsStop: number } {
  const storedByKey = new Map(stored.map((t) => [t.key, t]))
  const merged: TradovateEntry[] = [...stored]
  let fresh = 0
  let updated = 0
  for (const raw of incoming) {
    const t: TradovateEntry = { ...raw, dup: false }
    const prev = storedByKey.get(t.key)
    const carried = prev?.mentalStop != null && t.mentalStop == null ? prev.mentalStop : t.mentalStop
    const entry = carried != null ? applyMentalStop(t, carried) : t
    const idx = merged.findIndex((m) => m.key === entry.key)
    if (idx >= 0) {
      merged[idx] = entry
      updated++
    } else {
      merged.push(entry)
      fresh++
    }
  }
  return { merged, fresh, updated, needsStop: merged.filter((t) => t.needsStop).length }
}
