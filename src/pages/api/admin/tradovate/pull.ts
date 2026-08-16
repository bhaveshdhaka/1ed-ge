import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'
import { requireSession, json, error } from '../../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../../lib/content'
import { addChange } from '../../../../lib/changes'
import { todayHkt } from '../../../../lib/sessions'
import { DATA_DIR } from '../../../../lib/paths'
import {
  pullTradovateReports,
  feedPullIntoLedger,
  mergeTwoStagePull,
  tradovatePullDisabled,
  pullsRemaining,
  TRADOVATE_PULL_DAILY_MAX_DEFAULT,
  tradovateWindow,
  TradovatePullError,
} from '../../../../lib/tradovate-pull'
import type { TradovateEntry } from '../../../../lib/tradovate'

export const prerender = false

const BUDGET_FILE = path.join(DATA_DIR, 'tradovate-pulls.json')

interface BudgetRecord {
  date: string
  count: number
}

function readBudget(): BudgetRecord[] {
  try {
    return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')) as BudgetRecord[]
  } catch {
    return []
  }
}

function writeBudget(records: BudgetRecord[], date: string) {
  const norm = records.filter((r) => r.date && Number.isFinite(r.count)).slice(-60)
  const rec = norm.find((r) => r.date === date)
  if (rec) rec.count += 1
  else norm.push({ date, count: 1 })
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(norm))
  } catch {
    /* best-effort budget bookkeeping */
  }
}

/** Internal accounts for attribution (id + platformIds) — mirrors tradovate.ts API. */
function listAccountCtx(): { id: string; platformIds: string[] }[] {
  return listMds('accounts').map((f) => {
    const data = readEntry('accounts', f).data as Record<string, unknown>
    return {
      id: String(data.id ?? f.replace(/\.md$/, '')),
      platformIds: Array.isArray(data.platformIds)
        ? (data.platformIds as unknown[]).filter((p): p is string => typeof p === 'string')
        : [],
    }
  })
}

/** Keys already stored in the day's private draft.tradovate (re-import dup flags). */
function existingKeys(date: string): string[] {
  if (!listMds('days').includes(`${date}.md`)) return []
  const data = readEntry('days', `${date}.md`).data as Record<string, unknown>
  const draft = (data.draft as Record<string, unknown> | undefined) ?? {}
  const tv = draft.tradovate
  return Array.isArray(tv) ? (tv as { key?: unknown }[]).map((t) => String(t?.key ?? '')).filter(Boolean) : []
}

function storedLedger(date: string): TradovateEntry[] {
  if (!listMds('days').includes(`${date}.md`)) return []
  const data = readEntry('days', `${date}.md`).data as Record<string, unknown>
  const draft = (data.draft as Record<string, unknown> | undefined) ?? {}
  const tv = draft.tradovate
  if (!Array.isArray(tv)) return []
  return (tv as TradovateEntry[]).filter((t) => t && typeof t.key === 'string')
}

/**
 * POST /api/admin/tradovate/pull — the on-demand Tradovate report puller.
 * One trigger fetches BOTH Lucid accounts' three kept reports (Performance /
 * Position History / Orders) for a window ending on `date`, parses them with the
 * CSV-MVP ledger parsers, and merges straight into that day's private
 * `draft.tradovate` (replace-by-key) — so stage-1 (in-trade) and stage-2
 * (post-trade) pulls update the SAME trade entry for the day, never a duplicate.
 *
 * Body: { date: "YYYY-MM-DD", days?: number (window width, default 7), timezone?: number }
 * → { ok, date, imported, updated, needsStop, open, accounts, disabled }
 *
 * Guardrails: stop switch (409), per-day budget (429), fail-closed on 401/429,
 * read-only — no order/position endpoints are ever touched. Manual CSV upload
 * (`/api/admin/tradovate`) is untouched and stays the fallback.
 */
export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? todayHkt())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return error('invalid date (expected YYYY-MM-DD)')

  const stop = tradovatePullDisabled()
  if (stop.disabled) return error(stop.reason, 409)

  const max = Number(process.env.TRADOVATE_PULL_DAILY_MAX ?? TRADOVATE_PULL_DAILY_MAX_DEFAULT)
  const records = readBudget()
  const budgetDate = todayHkt()
  if (pullsRemaining(records, budgetDate, max) < 1) {
    return error(`daily on-demand pull budget reached (${max}/day) — use manual CSV upload or raise TRADOVATE_PULL_DAILY_MAX`, 429)
  }

  try {
    const { startDate, endDate } = tradovateWindow(date, Math.max(1, Math.min(64, Number(body.days ?? 7))))
    const outcome = await pullTradovateReports({
      startDate,
      endDate,
      timezone: body.timezone != null ? Number(body.timezone) : 8,
    })
    writeBudget(records, budgetDate)
    const budgetLeft = Math.max(0, pullsRemaining(readBudget(), budgetDate, max))

    // Feed into the SAME ledger model as the CSV MVP, then merge into the day.
    const ctx = { accounts: listAccountCtx(), existingKeys: existingKeys(date) }
    const built = feedPullIntoLedger(outcome.perf, outcome.pos, outcome.orders, ctx)
    const stored = storedLedger(date)
    const { merged, fresh, updated, needsStop } = mergeTwoStagePull(stored, built.trades)

    // Persist the merged ledger back into the day's private draft (never public).
    const existingData: Record<string, unknown> = listMds('days').includes(`${date}.md`)
      ? { ...(readEntry('days', `${date}.md`).data as Record<string, unknown>) }
      : { date }
    const draft = (existingData.draft as Record<string, unknown> | undefined) ?? {}
    existingData.draft = { ...draft, tradovate: merged }
    const bodyText = listMds('days').includes(`${date}.md`) ? readEntry('days', `${date}.md`).body ?? '' : ''
    writeEntry('days', `${date}.md`, existingData, bodyText)

    const detail = [
      `pulled from tradovate`,
      fresh ? `${fresh} new` : '',
      updated ? `${updated} updated` : '',
      needsStop ? `${needsStop} need mental SL` : '',
      outcome.openPositions.length ? `${outcome.openPositions.length} open` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    addChange('day', `day ${date}`, detail)

    return json({
      ok: true,
      date,
      dayFile: `${date}.md`,
      imported: fresh,
      updated,
      needsStop,
      stored: merged.length,
      dupeCount: built.dupeCount,
      open: outcome.openPositions,
      accounts: outcome.accounts,
      aliasProposals: built.aliasProposals,
      window: { startDate, endDate },
      budgetLeft,
      budgetMax: max,
    })
  } catch (e) {
    if (e instanceof TradovatePullError && (e.status === 401 || e.status === 429)) {
      return error(e.message, e.status)
    }
    const msg = e instanceof Error ? e.message : 'tradovate pull failed'
    return error(msg, 502)
  }
}
