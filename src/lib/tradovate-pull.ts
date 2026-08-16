import fs from 'node:fs'
import crypto from 'node:crypto'
import { parseTradovateCsvText, buildTradovateResult, mergeTradovateEntries, type RawRoundTrip, type TradovateOrder, type TradovateEntry } from './tradovate'
import type { IngestCtx } from './ingest'

/**
 * Tradovate on-demand report puller — the captain's Option 2.
 *
 * Thin, read-only, low-frequency, on-demand. This module repeats the browser's
 * own session handshake (~40 lines of HMAC-signed login) to pull the three kept
 * reports (Performance / Position History / Orders) for both Lucid accounts on
 * the demo environment, then feeds the SAME ledger parsers the CSV MVP uses
 * (`src/lib/tradovate.ts`) — no parallel storage.
 *
 * Guardrails (the ToS/lockout risk is policy, not engineering):
 *   - READ-ONLY: login + report GET/POST only. Never touches order/position-
 *     mutating endpoints. One careful login per pull; token used immediately.
 *   - UA SPOOF: every request carries a human-like browser User-Agent so the
 *     pull is indistinguishable in logs from the captain opening the Reports tab.
 *   - FAIL CLOSED: HTTP 401 (expired/locked) and 429 (rate-limited) THROW and
 *     abort the whole pull — never retry login, never hammer. A bad login is
 *     surfaced loudly so the captain falls back to manual CSV upload.
 *   - STOP SWITCH: `TRADOVATE_PULL_DISABLED=1` kills pulls site-wide (returns
 *     `disabled { reason }`). A per-day budget (`TRADOVATE_PULL_DAILY_MAX`,
 *     default 5) fails closed once exceeded.
 *   - HK EGRESS: the puller issues its requests from whatever box this code
 *     runs on. The admin API ships inside the HK-routed 1ed.ge deployment (the
 *     Coolify app behind an HK/hk03 host + Cloudflare), so by construction the
 *     egress IP is HK — same as how the site is served. Do not run this puller
 *     from a non-HK host, or Tradovate sees a foreign IP.
 *
 * Never print/commit credentials. `loadTradovateCreds` reads an env file
 * (default `/root/.secrets/tradovate.env`, mode 600, `TRADOVATE_USER` /
 * `TRADOVATE_PASS`) or the process env, and never logs them.
 */

export const TRADOVATE_ACCOUNTS = ['LTF05061295040001', 'LTF05061295040002'] as const
export type TradovateAccountName = (typeof TRADOVATE_ACCOUNTS)[number]

export const TRADOVATE_REPORTS = ['Performance', 'Position History', 'Orders'] as const
export type TradovateReportName = (typeof TRADOVATE_REPORTS)[number]

/** Human-like browser UA — the same fingerprint the web app's reports tab uses. */
export const TRADOVATE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// Values recovered from the trader.tradovate.com web bundle (see the
// option2-report-scout). They change only when Tradovate ships a new build.
const HMAC_KEY = '035a1259-11e7-485a-aeae-9b6016579351'
const APP_ID = 'tradovate_trader(web)'
const APP_VERSION = '3.260814.0'
const AUTH_HOST = 'https://live.tradovateapi.com/v1'
const RPT_HOST = 'https://rpt-demo.tradovateapi.com/v1'

export interface TradovateCreds {
  user: string
  password: string
}

export class TradovatePullError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TradovatePullError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Credentials (never printed)
// ---------------------------------------------------------------------------

/** Parse a KEY=VALUE env file (no comment/`export` handling — ours is bare). */
export function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
      if (m) out[m[1]] = m[2]
    }
  } catch {
    /* missing file → empty object */
  }
  return out
}

/**
 * Read Tradovate credentials. Priority: `TRADOVATE_SECRETS` env var → default
 * `/root/.secrets/tradovate.env` → process env (`TRADOVATE_USER`/`TRADOVATE_PASS`).
 * Returns null when the credentials aren't configured anywhere (the captain can
 * then fall back to manual CSV upload). Throws a typed error if only half a pair
 * is present. Never returns/prints the password value.
 */
export function loadTradovateCreds(envFile?: string): TradovateCreds | null {
  const filePath = envFile ?? process.env.TRADOVATE_SECRETS ?? '/root/.secrets/tradovate.env'
  const file = loadEnvFile(filePath)
  const user = file.TRADOVATE_USER || process.env.TRADOVATE_USER
  const password = file.TRADOVATE_PASS || process.env.TRADOVATE_PASS
  if (!user && !password) return null
  if (!user || !password) throw new TradovatePullError('tradovate creds incomplete — set both TRADOVATE_USER and TRADOVATE_PASS')
  return { user, password }
}

// ---------------------------------------------------------------------------
// Session handshake (mirrors the browser exactly — see scout report §3.2)
// ---------------------------------------------------------------------------

export function buildEncryptedPassword(password: string, name: string): string {
  const o = name.length % password.length
  const rotated = password.slice(o) + password.slice(0, o)
  return Buffer.from(rotated.split('').reverse().join(''), 'latin1').toString('base64')
}

export function newDeviceId(): string {
  const h = () => Math.floor(65536 * (1 + Math.random())).toString(16).substring(1)
  return `${h()}${h()}-${h()}-${h()}-${h()}-${h()}${h()}${h()}`
}

export interface LoginResult {
  accessToken: string
  userId: number
  expirationTime: number
  deviceId: string
}

/** One careful login. Throws TradovatePullError on any failure (no retry loop). */
export async function tradovateLogin(
  creds: TradovateCreds,
  opts: { deviceId?: string; userAgent?: string } = {},
): Promise<LoginResult> {
  const deviceId = opts.deviceId ?? newDeviceId()
  const ua = opts.userAgent ?? TRADOVATE_UA
  const appId = APP_ID
  const chl = String(Date.now() - 1581e9)
  const sec = crypto
    .createHmac('sha256', HMAC_KEY)
    .update([chl, deviceId, creds.user, creds.password, appId].join(''))
    .digest('hex')
  const encPw = buildEncryptedPassword(creds.password, creds.user)

  const res = await fetch(`${AUTH_HOST}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': ua },
    body: JSON.stringify({
      name: creds.user,
      password: encPw,
      enc: true,
      cid: '1',
      chl,
      sec,
      deviceId,
      appId,
      appVersion: APP_VERSION,
    }),
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) throw new TradovatePullError(`tradovate login HTTP ${res.status}`, res.status)
  if (!j || typeof j.accessToken !== 'string' || !j.accessToken) {
    const err = j && typeof j.errorText === 'string' ? j.errorText : 'unknown login error'
    throw new TradovatePullError(`tradovate login failed: ${err}`)
  }
  return {
    accessToken: j.accessToken,
    userId: Number(j.userId ?? 0),
    expirationTime: Number(j.expirationTime ?? 0),
    deviceId,
  }
}

// ---------------------------------------------------------------------------
// Report transport — fail closed on 401/429
// ---------------------------------------------------------------------------

/**
 * HTTP status → puller disposition. 401 = session dead (locked/expired),
 * 429 = rate-limited — BOTH fail closed: the caller aborts, never retries,
 * never hammers. Other non-200s surface as loud errors.
 */
export function httpFailureClass(status: number): 'ok' | 'auth' | 'rate-limit' | 'other' {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401) return 'auth'
  if (status === 429) return 'rate-limit'
  return 'other'
}

export interface ReportCallOpts {
  token: string
  account: string
  report: TradovateReportName
  startDate: string // MM/DD/YYYY
  endDate: string // MM/DD/YYYY
  timezone?: number // UTC offset that shifts the CSV timestamps (site uses +8/HKT)
  userAgent?: string
}

/** One report call. Returns the CSV text. Throws (fail closed) on auth/rate-limit. */
export async function pullReportCsv(opts: ReportCallOpts): Promise<string> {
  const ua = opts.userAgent ?? TRADOVATE_UA
  const payload: Record<string, unknown> = {
    name: opts.report,
    params: [
      { name: 'startDate', value: opts.startDate },
      { name: 'endDate', value: opts.endDate },
      { name: 'account', value: opts.account },
    ],
    representationType: 'csv',
    timezone: opts.timezone ?? 8,
  }
  // template is added only for Performance (matches the UI's own builder).
  if (opts.report === 'Performance') payload.template = 'Flex.html'

  const res = await fetch(`${RPT_HOST}/reports/requestreport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${opts.token}`,
      'User-Agent': ua,
    },
    body: JSON.stringify(payload),
  })
  const cls = httpFailureClass(res.status)
  if (cls === 'auth') throw new TradovatePullError('tradovate session expired/locked (401) — aborting, not retrying', res.status)
  if (cls === 'rate-limit') throw new TradovatePullError('tradovate rate-limited (429) — aborting, not retrying', res.status)
  if (cls === 'other') throw new TradovatePullError(`tradovate report HTTP ${res.status}`, res.status)

  const j = await res.json().catch(() => null)
  if (!j || typeof j.data !== 'string') {
    const err = j && typeof j.errorText === 'string' ? j.errorText : 'no CSV in response'
    throw new TradovatePullError(`tradovate ${opts.report} failed: ${err}`)
  }
  return j.data
}

// ---------------------------------------------------------------------------
// Stop switch + low-frequency budget (pure, unit-testable)
// ---------------------------------------------------------------------------

/** Env stop switch — `TRADOVATE_PULL_DISABLED=1` (any truthy) kills the puller. */
export function tradovatePullDisabled(): { disabled: boolean; reason: string } {
  const v = process.env.TRADOVATE_PULL_DISABLED
  if (v && v !== '0' && v !== 'false' && v !== '') {
    return { disabled: true, reason: 'TRADOVATE_PULL_DISABLED is set — on-demand pull is switched off; use manual CSV upload' }
  }
  return { disabled: false, reason: '' }
}

/** Default per-day pull budget (low frequency: a trade day rarely needs more). */
export const TRADOVATE_PULL_DAILY_MAX_DEFAULT = 5

export interface PullBudgetRecord {
  date: string // HKT YYYY-MM-DD
  count: number
}

/** Pulls remaining today AFTER this one — negative means already over the budget. */
export function pullsRemaining(records: PullBudgetRecord[], date: string, max: number): number {
  const rec = records.find((r) => r.date === date)
  return max - (rec?.count ?? 0)
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface PullReportStatus {
  report: TradovateReportName
  rows: number
  ok: boolean
  error?: string
}

export interface AccountPull {
  account: TradovateAccountName
  reports: PullReportStatus[]
}

export interface PullOutcome {
  accounts: AccountPull[]
  /** Flat CSV text per report/account (for staging/debug; not persisted by the API). */
  csvs: Record<string, string>
  /** The raw parsed rows, aggregated across both accounts — feeds buildTradovateResult. */
  perf: RawRoundTrip[]
  pos: RawRoundTrip[]
  orders: TradovateOrder[]
  openPositions: OpenPosition[]
}

export interface OpenPosition {
  positionId: string
  market: string
  direction: 'long' | 'short'
  entry: number | null
  qty: number
  platformId: string | null
}

/** Open positions (stage-1 in-trade) from the Position History rows — a position
 * that hasn't closed yet (one side unfilled). Surfaces "you're live in this" so
 * the captain knows a later pull will complete it under the same position id. */
export function openPositionsFrom(pos: RawRoundTrip[]): OpenPosition[] {
  const out: OpenPosition[] = []
  for (const r of pos) {
    // A closed round trip has both sides filled; an open one is missing one.
    const bothFilled = r.buyPrice != null && r.sellPrice != null
    if (bothFilled) continue
    if (!r.positionId) continue
    const direction: 'long' | 'short' = r.buyPrice != null ? 'long' : 'short'
    out.push({
      positionId: r.positionId,
      market: (r.symbol?.replace(/[A-Z][0-9]{1,2}$/, '') || 'MNQ').toUpperCase(),
      direction,
      entry: r.buyPrice != null ? r.buyPrice : r.sellPrice,
      qty: r.qty,
      platformId: r.platformId,
    })
  }
  if (!out.length) return out
  return out.sort((a, b) => a.positionId.localeCompare(b.positionId))
}

/** The `MM/DD/YYYY` window for a pull: `wholeDays` (incl. the end date) up to today. */
export function tradovateWindow(endIso: string, wholeDays = 7): { startDate: string; endDate: string } {
  const end = new Date(endIso)
  if (Number.isNaN(end.getTime())) end.setTime(Date.now())
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  const start = new Date(end.getTime() - (wholeDays - 1) * 864e5)
  return { startDate: fmt(start), endDate: fmt(end) }
}

/**
 * The on-demand pull: check stop switch → load creds → ONE login → for both
 * accounts × the three kept reports, request the CSV (human-like UA) → parse
 * with the existing ledger parsers. Fails closed on any 401/429 and on a failed
 * login — never retries in a loop. A single report returning HTTP 200 with an
 * `errorText` (e.g. "Too long range") is recorded per-report (not a hard abort);
 * if EVERY report for the window errors, that's a hard failure.
 */
export async function pullTradovateReports(opts: {
  accounts?: readonly TradovateAccountName[]
  startDate: string // MM/DD/YYYY
  endDate: string // MM/DD/YYYY
  timezone?: number
  envFile?: string
  userAgent?: string
}): Promise<PullOutcome> {
  const stop = tradovatePullDisabled()
  if (stop.disabled) throw new TradovatePullError(stop.reason)

  const creds = loadTradovateCreds(opts.envFile)
  if (!creds) {
    throw new TradovatePullError(
      'tradovate creds not configured (TRADOVATE_SECRETS / /root/.secrets/tradovate.env / env) — use manual CSV upload',
    )
  }

  const { accessToken } = await tradovateLogin(creds, { userAgent: opts.userAgent })
  const accounts = (opts.accounts ?? TRADOVATE_ACCOUNTS) as readonly TradovateAccountName[]

  const perf: RawRoundTrip[] = []
  const pos: RawRoundTrip[] = []
  const orders: TradovateOrder[] = []
  const csvs: Record<string, string> = {}
  const accountPulls: AccountPull[] = []
  let hardErrors = 0
  let calls = 0

  for (const account of accounts) {
    const reports: PullReportStatus[] = []
    for (const report of TRADOVATE_REPORTS) {
      calls++
      try {
        const csv = await pullReportCsv({
          token: accessToken,
          account,
          report,
          startDate: opts.startDate,
          endDate: opts.endDate,
          timezone: opts.timezone ?? 8,
          userAgent: opts.userAgent,
        })
        csvs[`${account}:${report}`] = csv
        const parsed = parseTradovateCsvText(csv)
        if (parsed.kind === 'performance') perf.push(...parsed.perf)
        else if (parsed.kind === 'position') pos.push(...parsed.pos)
        else if (parsed.kind === 'orders') orders.push(...parsed.orders)
        reports.push({ report, rows: parsed.perf.length + parsed.pos.length + parsed.orders.length, ok: true })
      } catch (e) {
        // Fail-closed errors (401/429/auth) throw out of the whole pull.
        if (e instanceof TradovatePullError && (e.status === 401 || e.status === 429)) throw e
        const msg = e instanceof Error ? e.message : 'report failed'
        reports.push({ report, rows: 0, ok: false, error: msg })
        hardErrors++
      }
    }
    accountPulls.push({ account, reports })
  }

  if (hardErrors >= accounts.length * TRADOVATE_REPORTS.length) {
    throw new TradovatePullError(`tradovate pull failed for every report (${hardErrors} errors)`)
  }
  if (!calls) throw new TradovatePullError('tradovate pull made no report calls')

  return { accounts: accountPulls, csvs, perf, pos, orders, openPositions: openPositionsFrom(pos) }
}

// ---------------------------------------------------------------------------
// Ledger feeding — the CSV-MVP merge, reused verbatim (no parallel storage)
// ---------------------------------------------------------------------------

/**
 * Turn a pulled batch → the Tradeovate ledger entries (the SAME model the CSV
 * import writes). Uses buildTradovateResult (per-account attribution, copies
 * across accounts, honest MAE/MFE, recorded-stop recovery from Orders) and then
 * mergeTradovateEntries (replace-by-key) — so a second pull of the same day /
 * same trade UPDATES the existing entry in place instead of adding a duplicate.
 * `existingKeys` = the day's current draft.tradovate keys (re-import dup flags).
 */
export function feedPullIntoLedger(
  perf: RawRoundTrip[],
  pos: RawRoundTrip[],
  orders: TradovateOrder[],
  ctx: { accounts: IngestCtx['accounts']; existingKeys?: string[] },
): ReturnType<typeof buildTradovateResult> {
  return buildTradovateResult(perf, pos, orders, { accounts: ctx.accounts, existingKeys: ctx.existingKeys ?? [] })
}

/**
 * The two-stage single-trade/day link. Both stages of a pull land in the same
 * day's private ledger and merge by key (stable fill-pair / position identity),
 * so the captain publishing stage-1 then stage-2 gets ONE trade entry that the
 * later pull completes in place — never a duplicate day or trade.
 */
export function mergeTwoStagePull(
  stored: TradovateEntry[],
  incoming: TradovateEntry[],
): { merged: TradovateEntry[]; fresh: number; updated: number; needsStop: number } {
  return mergeTradovateEntries(stored, incoming)
}
