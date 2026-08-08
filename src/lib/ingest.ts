import { env } from './env'
import { orChat } from './ai'
import { round2 } from './utils'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * Ingest pipeline — PDF / CSV / screenshot → trade proposals.
 *
 * Core pure pipeline (this module): decode → parse → attribute → group → dedupe.
 * The only side effects are pdftotext (exec) and the OpenRouter calls in the
 * LLM parsers. All exported types are the single source of truth for the
 * admin UI (Tasks 3/4 consume them verbatim).
 */

// ---------------------------------------------------------------------------
// Exported types (Tasks 3/4 rely on these exactly)
// ---------------------------------------------------------------------------

export interface IngestFile {
  /** File name — used for type detection fallback. */
  name: string
  /** base64 data URL (e.g. data:image/png;base64,…) */
  dataUrl: string
}

export interface Fill {
  symbol: string // e.g. 'MNQU6'
  qty: number
  buyPrice: number | null
  sellPrice: number | null
  buyTime: string | null // ISO (converted to HKT): 'YYYY-MM-DDTHH:mm:ss.000Z'
  sellTime: string | null
  pnl: number // dollars (signed)
  buyFillId?: string
  sellFillId?: string
  platformId?: string // from an Orders file / attribution
}

export interface PositionProposal {
  market: string // 'MNQ' — contract suffix stripped
  direction: 'long' | 'short'
  entry: number
  exit: number
  points: number // price points: long exit−entry, short entry−exit
  size: number // total contracts
  start: string // HKT ISO
  end: string
  fillCount: number
  fingerprint: string // per-account dedup key
  dup: boolean // matches an existing day-record trade
  account: { internalId: string | null; platformId: string | null; confirmed: boolean }
}

export interface AliasProposal {
  platformId: string // '' for a fully unattributed group
  candidates: string[]
  suggested: string | null
}

export interface IngestResult {
  date: string // HKT date (YYYY-MM-DD) of the fills
  proposals: PositionProposal[]
  dupes: number
  aliasProposal: AliasProposal | null
  platformIdsSeen: string[]
}

export interface IngestCtx {
  accounts: { id: string; contract?: string; size?: number; platformIds?: string[] }[]
  existingTrades?: { market: string; direction: string; entry: number; exit: number }[]
}

// ---------------------------------------------------------------------------
// Step 1: base helpers
// ---------------------------------------------------------------------------

/** Tiny deterministic CSV parser: handles quoted fields, commas, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

export function decodeDataUrl(dataUrl: string): { mime: string; buf: Buffer } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('expected a base64 data URL')
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') }
}

/** pdftotext -layout; throws a clear error if poppler is missing. */
export function pdfToText(buf: Buffer): string {
  const tmp = path.join(os.tmpdir(), `ingest-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
  fs.writeFileSync(tmp, buf)
  try {
    return execFileSync('pdftotext', ['-layout', tmp, '-'], { encoding: 'utf8' })
  } catch {
    throw new Error('pdftotext failed — is poppler-utils installed in the container?')
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

// ---------------------------------------------------------------------------
// Step 2: HKT time conversion
// ---------------------------------------------------------------------------

/**
 * Tradovate timestamps are America/Chicago (`MM/DD/YYYY HH:mm:ss`); the site's
 * day clock is HKT. Convert with Intl (DST-aware).
 *
 * The digits are treated as the Chicago *wall time*: parse them as UTC
 * (`wallAsUtc`), ask Intl what instant that is when rendered in
 * America/Chicago (`renderedAsUtc`); their difference is the Chicago offset
 * (negative in CDT/CST). The true UTC instant is `wallAsUtc - offsetMs`.
 * Adding +8h then toISOString() yields the codebase's naive-HKT convention
 * (`todayHkt()`/`nowIso` use the same +8h trick): the digits are the HKT wall
 * time with a `Z` suffix.
 */
export function ctToHkt(ct: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(ct)
  if (!m) return null
  const [, mo, d, y, h, mi, s] = m
  const wallAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) % 24, Number(mi), Number(s))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(wallAsUtc))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const renderedAsUtc = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')) % 24,
    Number(get('minute')),
    Number(get('second')),
  )
  const offsetMs = renderedAsUtc - wallAsUtc // negative in CDT/CST
  const instantUtc = wallAsUtc - offsetMs // true UTC instant
  return new Date(instantUtc + 8 * 3600 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Step 3: Tradovate deterministic parsers
// ---------------------------------------------------------------------------

/**
 * Performance CSV → fills. Column mapping validated against the real demo file
 * `mshwf7m4-Performance_4_.csv`:
 *   [0] symbol  [1] _priceFormat  [2] _priceFormatType  [3] _tickSize
 *   [4] buyFillId  [5] sellFillId  [6] qty  [7] buyPrice  [8] sellPrice
 *   [9] pnl  [10] boughtTimestamp  [11] soldTimestamp  [12] duration
 */
export function parsePerformanceCsv(rows: string[][]): Fill[] {
  const out: Fill[] = []
  for (const r of rows) {
    const [symbol, , , , buyFillId, sellFillId, qty, buyPrice, sellPrice, pnl, boughtTs, soldTs] = r
    if (!symbol || !/^[A-Z]/.test(symbol)) continue
    out.push({
      symbol,
      qty: Number(qty) || 1,
      buyPrice: buyPrice ? Number(buyPrice) : null,
      sellPrice: sellPrice ? Number(sellPrice) : null,
      buyTime: boughtTs ? ctToHkt(boughtTs) : null,
      sellTime: soldTs ? ctToHkt(soldTs) : null,
      pnl: parseUsd(pnl),
      buyFillId: buyFillId || undefined,
      sellFillId: sellFillId || undefined,
    })
  }
  return out
}

/** '$(29.00)' / '$0.50' → signed number. */
export function parseUsd(s: string): number {
  const neg = /\(/.test(s)
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return (Number.isFinite(n) ? n : 0) * (neg ? -1 : 1)
}

export interface OrderRow {
  orderId: string
  platformId: string
  symbol: string
  price: number
  qty: number
  time: string | null
  side?: string
}

/**
 * Orders CSV → account-keyed rows. Column mapping validated against the real
 * demo files `mshwf7pi-Orders_6_.csv` / `mshwf7sz-Orders_7_.csv`:
 *   [0] orderId  [1] Account  [2] Order ID  [3] B/S  [4] Contract
 *   [5] Product  [6] Product Description  [7] avgPrice  [8] filledQty
 *   [9] Fill Time …
 * 'Account' carries the platform id (e.g. `LTE05061295040002`); B/S carries a
 * leading space (" Buy") — trimmed and lowercased here.
 */
export function parseOrdersCsv(rows: string[][]): OrderRow[] {
  const out: OrderRow[] = []
  for (const r of rows) {
    const [orderId, account, , side, contract] = r
    if (!orderId || !/^[A-Z0-9]/.test(orderId)) continue
    const price = r[7] ? Number(r[7]) : null // avgPrice
    const qty = r[8] ? Number(r[8]) : 1 // filledQty
    const time = r[9] ? ctToHkt(r[9]) : null // Fill Time
    if (!account || !price) continue
    out.push({ orderId, platformId: account, symbol: contract, price, qty, time, side: side?.trim().toLowerCase() })
  }
  return out
}

// ---------------------------------------------------------------------------
// Step 4: LLM parsers (PDF text + image + unknown CSV)
// ---------------------------------------------------------------------------

const FILLS_SYSTEM = `You extract per-fill trade rows from a trader's Tradovate export.
Output a JSON object: { "fills": [ { "symbol": "MNQU6", "qty": 1, "buyPrice": 29260.75, "sellPrice": 29261.0, "pnl": 0.5, "buyTime": "08/06/2026 21:33:00", "sellTime": "08/06/2026 21:33:23" } ] }
One entry per row. Numbers as numbers, pnl signed (negative allowed), times verbatim "MM/DD/YYYY HH:MM:SS". No prose, JSON only.`

const ORDERS_SYSTEM = `You extract order-fill rows from a Tradovate Orders export.
Output a JSON object: { "orders": [ { "orderId": "611527630004", "account": "LTE05061295040002", "symbol": "MNQU6", "side": "Buy", "price": 29260.75, "qty": 1, "time": "08/06/2026 21:33:00" } ] }
One entry per row. Times verbatim "MM/DD/YYYY HH:MM:SS". No prose, JSON only.`

async function llmJson<T>(system: string, userText: string, model: string, maxTokens = 2000): Promise<T | null> {
  const raw = await orChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
    model,
    true,
    maxTokens,
  )
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

/** Performance PDF text → fills (cheap model, owner-directed). */
export async function parsePerformancePdfText(text: string): Promise<Fill[]> {
  const j = await llmJson<{ fills?: Record<string, unknown>[] }>(FILLS_SYSTEM, text, env.modelIngest())
  if (!j?.fills) return []
  return j.fills
    .map((f) => ({
      symbol: String(f.symbol ?? ''),
      qty: Number(f.qty) || 1,
      buyPrice: f.buyPrice != null ? Number(f.buyPrice) : null,
      sellPrice: f.sellPrice != null ? Number(f.sellPrice) : null,
      buyTime: f.buyTime ? ctToHkt(String(f.buyTime)) : null,
      sellTime: f.sellTime ? ctToHkt(String(f.sellTime)) : null,
      pnl: Number(f.pnl) || 0,
    }))
    .filter((f) => f.symbol)
}

/** Orders PDF text → orders rows (cheap model). */
export async function parseOrdersPdfText(text: string): Promise<OrderRow[]> {
  const j = await llmJson<{ orders?: Record<string, unknown>[] }>(ORDERS_SYSTEM, text, env.modelIngest())
  if (!j?.orders) return []
  return j.orders
    .map((o) => ({
      orderId: String(o.orderId ?? ''),
      platformId: String(o.account ?? ''),
      symbol: String(o.symbol ?? ''),
      price: Number(o.price) || 0,
      qty: Number(o.qty) || 1,
      time: o.time ? ctToHkt(String(o.time)) : null,
    }))
    .filter((o) => o.orderId && o.platformId)
}

/** Unknown CSV → fills via the cheap model (column mapping). */
export async function parseUnknownCsv(text: string): Promise<Fill[]> {
  return parsePerformancePdfText(
    `The following is a CSV export of trades. Map its columns and extract one fill per row:\n\n${text.slice(0, 12_000)}`,
  )
}

/** Image (screenshot of a statement/table) → fills via the VISION model. */
export async function parseImage(dataUrl: string): Promise<Fill[]> {
  const raw = await orChat(
    [
      { role: 'system', content: FILLS_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the trade rows from this screenshot.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ] as never,
      },
    ],
    env.modelVision(),
    true,
    2000,
  )
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    const j = JSON.parse(cleaned) as { fills?: Record<string, unknown>[] }
    return (j.fills ?? [])
      .map((f) => ({
        symbol: String(f.symbol ?? ''),
        qty: Number(f.qty) || 1,
        buyPrice: f.buyPrice != null ? Number(f.buyPrice) : null,
        sellPrice: f.sellPrice != null ? Number(f.sellPrice) : null,
        buyTime: f.buyTime ? ctToHkt(String(f.buyTime)) : null,
        sellTime: f.sellTime ? ctToHkt(String(f.sellTime)) : null,
        pnl: Number(f.pnl) || 0,
      }))
      .filter((f) => f.symbol)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Step 5: attribution + alias resolution
// ---------------------------------------------------------------------------

/** 'MNQU6' → 'MNQ' (strips the delivery code: month letter + 1–2 digit year). */
function stripContract(symbol: string): string {
  return symbol.replace(/[A-Z][0-9]{1,2}$/, '').toUpperCase() || symbol.toUpperCase()
}

export function resolveAlias(
  platformId: string,
  accounts: IngestCtx['accounts'],
): { internalId: string | null; candidates: string[]; suggested: string | null } {
  const known = accounts.find((a) => a.platformIds?.includes(platformId))
  if (known) return { internalId: known.id, candidates: [], suggested: null }
  const candidates = accounts.map((a) => a.id)
  return { internalId: null, candidates, suggested: candidates[0] ?? null }
}

// ---------------------------------------------------------------------------
// Step 6: group fills → positions (deterministic time clustering)
// ---------------------------------------------------------------------------

const CLUSTER_GAP_MS = 10 * 60 * 1000 // 10 min gap starts a new position

export function groupFillsToPositions(
  fills: Fill[],
  account: { internalId: string | null; platformId: string | null; confirmed: boolean },
): PositionProposal[] {
  const sorted = [...fills].sort((a, b) =>
    (a.buyTime ?? a.sellTime ?? '').localeCompare(b.buyTime ?? b.sellTime ?? ''),
  )
  const clusters: Fill[][] = []
  let cur: Fill[] = []
  let prev: string | null = null
  for (const f of sorted) {
    const t = f.buyTime ?? f.sellTime
    if (!t) {
      cur.push(f)
      continue
    }
    if (prev && Date.parse(t) - Date.parse(prev) > CLUSTER_GAP_MS) {
      if (cur.length) clusters.push(cur)
      cur = []
    }
    cur.push(f)
    prev = t
  }
  if (cur.length) clusters.push(cur)
  return clusters.map((c) => {
    const totalQty = c.reduce((s, f) => s + f.qty, 0)
    const buys = c.filter((f) => f.buyPrice != null)
    const sells = c.filter((f) => f.sellPrice != null)
    const entry = buys.length ? buys.reduce((s, f) => s + (f.buyPrice ?? 0) * f.qty, 0) / buys.reduce((s, f) => s + f.qty, 0) : 0
    const exit = sells.length ? sells.reduce((s, f) => s + (f.sellPrice ?? 0) * f.qty, 0) / sells.reduce((s, f) => s + f.qty, 0) : entry
    const direction: 'long' | 'short' = entry <= exit ? 'long' : 'short'
    const points = direction === 'long' ? exit - entry : entry - exit
    const start = c.find((f) => f.buyTime ?? f.sellTime)?.buyTime ?? c[0]?.sellTime ?? ''
    const end = [...c].reverse().find((f) => f.sellTime ?? f.buyTime)?.sellTime ?? start
    return {
      market: stripContract(c[0]?.symbol ?? ''),
      direction,
      entry: round2(entry),
      exit: round2(exit),
      points: round2(points),
      size: totalQty,
      start,
      end,
      fillCount: c.length,
      fingerprint: `${stripContract(c[0]?.symbol ?? '')}|${direction}|${round2(entry)}|${round2(exit)}`,
      dup: false,
      account,
    }
  })
}

// ---------------------------------------------------------------------------
// Step 7: dedup + `ingestFiles` orchestration
// ---------------------------------------------------------------------------

function hktToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export async function ingestFiles(files: IngestFile[], ctx: IngestCtx): Promise<IngestResult> {
  const ordersRows: OrderRow[] = []
  const perfFills: Fill[] = []

  for (const file of files) {
    const { mime, buf } = decodeDataUrl(file.dataUrl)
    const name = file.name.toLowerCase()

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const text = pdfToText(buf)
      const orders = await parseOrdersPdfText(text)
      if (orders.length) ordersRows.push(...orders)
      else perfFills.push(...(await parsePerformancePdfText(text)))
    } else if (mime.startsWith('image/')) {
      perfFills.push(...(await parseImage(file.dataUrl)))
    } else {
      // CSV / text
      const text = buf.toString('utf8')
      const rows = parseCsv(text)
      const header = (rows[0] ?? []).join(',').toLowerCase()
      if (header.includes('buyfillid')) perfFills.push(...parsePerformanceCsv(rows))
      else if (header.includes('orderid') && header.includes('avgprice')) ordersRows.push(...parseOrdersCsv(rows))
      else perfFills.push(...(await parseUnknownCsv(text)))
    }
  }

  // Attribution: orderId → platformId map; join performance fills via fill ids.
  // Note: on the real demo files buy/sell fill ids live in a different ID space
  // than order ids (zero overlap), so the join is best-effort — unattributed
  // fills fall to the alias-confirm path below.
  const orderPlatform = new Map<string, string>()
  for (const o of ordersRows) orderPlatform.set(o.orderId, o.platformId)

  const platformIdsSeen: string[] = []
  for (const f of perfFills) {
    if (!f.platformId) {
      const viaBuy = f.buyFillId ? orderPlatform.get(f.buyFillId) : undefined
      const viaSell = f.sellFillId ? orderPlatform.get(f.sellFillId) : undefined
      if (viaBuy) f.platformId = viaBuy
      else if (viaSell) f.platformId = viaSell
    }
    if (f.platformId && !platformIdsSeen.includes(f.platformId)) platformIdsSeen.push(f.platformId)
  }
  for (const o of ordersRows) {
    if (!platformIdsSeen.includes(o.platformId)) platformIdsSeen.push(o.platformId)
  }

  // Group fills per platformId; unattributed fills form one '' (unknown) group.
  const groups = new Map<string, Fill[]>()
  for (const f of perfFills) {
    const key = f.platformId ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  const proposals: PositionProposal[] = []
  let aliasProposal: AliasProposal | null = null

  for (const [pid, fills] of groups) {
    if (pid === '') {
      // Unattributed batch → single alias-confirm proposal (owner picks account).
      proposals.push(...groupFillsToPositions(fills, { internalId: null, platformId: null, confirmed: false }))
      if (!aliasProposal) {
        aliasProposal = {
          platformId: '',
          candidates: ctx.accounts.map((a) => a.id),
          suggested: ctx.accounts[0]?.id ?? null,
        }
      }
    } else {
      const alias = resolveAlias(pid, ctx.accounts)
      proposals.push(
        ...groupFillsToPositions(fills, { internalId: alias.internalId, platformId: pid, confirmed: alias.internalId !== null }),
      )
      if (alias.internalId === null && !aliasProposal) {
        aliasProposal = { platformId: pid, candidates: alias.candidates, suggested: alias.suggested }
      }
    }
  }

  // Dedup: per-account fingerprints within the batch + against existing trades.
  const seen = new Set<string>()
  let dupes = 0
  for (const p of proposals) {
    const acctKey = p.account.internalId ?? p.account.platformId ?? 'unknown'
    const key = `${acctKey}|${p.fingerprint}`
    if (seen.has(key)) p.dup = true
    seen.add(key)
    if (
      !p.dup &&
      ctx.existingTrades?.some(
        (t) =>
          t.market === p.market &&
          t.direction === p.direction &&
          round2(t.entry) === round2(p.entry) &&
          round2(t.exit) === round2(p.exit),
      )
    ) {
      p.dup = true
    }
    if (p.dup) dupes++
  }

  // date = HKT date of the earliest fill; falls back to today's HKT date.
  const earliest = proposals.length ? [...proposals].sort((a, b) => a.start.localeCompare(b.start))[0].start : ''
  const date = earliest ? earliest.slice(0, 10) : hktToday()

  return { date, proposals, dupes, aliasProposal, platformIdsSeen }
}
