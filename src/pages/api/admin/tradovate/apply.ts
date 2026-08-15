import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../../lib/content'
import { addChange } from '../../../../lib/changes'
import { tradovateEntrySchema, applyMentalStop, mergeTradovateEntries, type TradovateEntry } from '../../../../lib/tradovate'

export const prerender = false

/** Validate + sanitise one incoming trade (tight — every field earns its place). */
function sanitize(t: unknown): TradovateEntry | null {
  const parsed = tradovateEntrySchema.safeParse(t)
  if (!parsed.success) return null
  const e = parsed.data
  // Never trust derived fields computed on the client — recompute the risk
  // artifacts from the raw stop/mentalStop so the file can't drift.
  return applyMentalStop(e, e.mentalStop)
}

/**
 * POST /api/admin/tradovate/apply — persist approved round trips into the
 * day's private `draft.tradovate` (never public), plus platform-id → account
 * links. Merge semantics: same-key entries are replaced in place, and an
 * already-stored mental SL is carried over on re-import (the SL prompt's
 * answer is never lost). Body:
 *   { date, trades: TradovateEntry[], platformLinks?: [{platformId, internalId}] }
 * → { ok, dayFile, imported, updated, linksApplied }.
 */
export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return error('invalid date (expected YYYY-MM-DD)')

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

  // 2. Merge approved trades into the day's private draft.tradovate.
  const incoming = Array.isArray(body.trades)
    ? (body.trades as unknown[]).map(sanitize).filter((t): t is TradovateEntry => t !== null)
    : []
  if (!incoming.length) return error('no valid trades to import')

  const existingData: Record<string, unknown> = listMds('days').includes(`${date}.md`)
    ? { ...(readEntry('days', `${date}.md`).data as Record<string, unknown>) }
    : { date }
  const existingDraft = (existingData.draft as Record<string, unknown> | undefined) ?? {}
  const stored = Array.isArray(existingDraft.tradovate)
    ? (existingDraft.tradovate as TradovateEntry[]).filter((t) => t && typeof t.key === 'string')
    : []

  const { merged, fresh, updated, needsStop } = mergeTradovateEntries(stored, incoming)

  existingData.draft = {
    ...existingDraft,
    tradovate: merged,
  }
  const bodyText = listMds('days').includes(`${date}.md`) ? readEntry('days', `${date}.md`).body ?? '' : ''
  writeEntry('days', `${date}.md`, existingData, bodyText)
  addChange('day', `day ${date}`, `${fresh} imported · ${updated} updated tradovate trades${needsStop ? ` · ${needsStop} need mental SL` : ''}`)

  return json({ ok: true, dayFile: `${date}.md`, imported: fresh, updated, linksApplied, stored: merged.length })
}
