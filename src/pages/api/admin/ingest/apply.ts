import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../../lib/auth'
import type { PositionProposal } from '../../../../lib/ingest'
import { listMds, readEntry, writeEntry } from '../../../../lib/content'
import { addChange } from '../../../../lib/changes'

export const prerender = false

/** Approved proposal → a day-record trade (normalizeTrade-compatible shape). */
function importedTrade(p: PositionProposal): Record<string, unknown> {
  return {
    market: String(p.market ?? 'MNQ').toUpperCase(),
    direction: p.direction === 'short' ? 'short' : 'long',
    entry: p.entry,
    exit: p.exit,
    points: p.points,
    // riskPoints is optional-positive in the day schema — 0/null/undefined are omitted.
    ...(p.riskPoints != null && Number.isFinite(p.riskPoints) && p.riskPoints > 0 ? { riskPoints: p.riskPoints } : {}),
    note: 'imported',
    screenshots: [],
    executions:
      p.account && p.account.internalId && Number.isFinite(p.size) && p.size > 0
        ? [{ account: p.account.internalId, size: p.size }]
        : [],
  }
}

/**
 * POST /api/admin/ingest/apply — persist approved proposals + account aliases.
 * Body: {
 *   date: 'YYYY-MM-DD',
 *   positions: PositionProposal[] (approved),
 *   platformLinks: [{ platformId, internalId }],
 * } → { ok, dayFile, linksApplied }.
 *
 * - `positions` are appended to days/<date>.md as trades (existing data + body
 *   preserved; a missing day file gets a minimal `{ date, trades }` record).
 * - `platformLinks` are dedupe-appended onto each account's `platformIds`.
 * - Every mutation queues a pending change (`addChange`) for the RebuildBar.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date (expected YYYY-MM-DD)')
  if (isNaN(Date.parse(date))) return error('invalid date')

  // 1. Persist platform links onto account records (dedupe-append platformIds).
  const platformLinks = Array.isArray(body.platformLinks) ? body.platformLinks : []
  let linksApplied = 0
  for (const link of platformLinks) {
    const platformId = String((link as { platformId?: unknown } | null)?.platformId ?? '')
    const internalId = String((link as { internalId?: unknown } | null)?.internalId ?? '')
    if (!platformId || !internalId || !listMds('accounts').includes(`${internalId}.md`)) continue
    const existing = readEntry('accounts', `${internalId}.md`)
    const data = { ...(existing.data as Record<string, unknown>) }
    const platformIds = Array.isArray(data.platformIds)
      ? (data.platformIds as unknown[]).filter((p): p is string => typeof p === 'string')
      : []
    if (!platformIds.includes(platformId)) {
      platformIds.push(platformId)
      data.platformIds = platformIds
      writeEntry('accounts', `${internalId}.md`, data, existing.body ?? '')
      addChange('account', `alias ${platformId} → ${internalId}`)
      linksApplied++
    }
  }

  // 2. Merge approved positions as trades into days/<date>.md.
  const positions: PositionProposal[] = Array.isArray(body.positions)
    ? (body.positions as PositionProposal[]).filter(
        (p) => Number.isFinite(p?.entry) && Number.isFinite(p?.exit) && Number.isFinite(p?.points),
      )
    : []
  const trades = positions.map(importedTrade)

  if (trades.length) {
    if (listMds('days').includes(`${date}.md`)) {
      const existing = readEntry('days', `${date}.md`)
      const existingTrades = Array.isArray(existing.data.trades) ? (existing.data.trades as unknown[]) : []
      const data = { ...(existing.data as Record<string, unknown>), trades: [...existingTrades, ...trades] }
      writeEntry('days', `${date}.md`, data, existing.body ?? '')
    } else {
      writeEntry('days', `${date}.md`, { date, trades }, '')
    }
    addChange('day', `day ${date}`, `${trades.length} imported trades`)
  }

  return json({ ok: true, dayFile: `${date}.md`, linksApplied })
}
