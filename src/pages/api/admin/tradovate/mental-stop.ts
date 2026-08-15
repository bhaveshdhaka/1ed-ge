import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../../lib/content'
import { addChange } from '../../../../lib/changes'
import { applyMentalStop, type TradovateEntry } from '../../../../lib/tradovate'

export const prerender = false

/**
 * POST /api/admin/tradovate/mental-stop — the SL-prompt answer: store the
 * owner's (even mental) stop for one imported trade.
 * Body: { date, key, mentalStop } → { ok, needsStop }.
 * Recomputes stop/stopSource/riskPoints/needsStop from the mental stop so the
 * file can never drift from the UI.
 */
export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  const key = String(body.key ?? '')
  const mentalStop = typeof body.mentalStop === 'number' && Number.isFinite(body.mentalStop) ? body.mentalStop : null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return error('invalid date (expected YYYY-MM-DD)')
  if (!key || !listMds('days').includes(`${date}.md`)) return error('no imported trades for that day')

  const day = readEntry('days', `${date}.md`)
  const data = { ...(day.data as Record<string, unknown>) }
  const draft = (data.draft as Record<string, unknown> | undefined) ?? {}
  const stored = Array.isArray(draft.tradovate) ? (draft.tradovate as TradovateEntry[]) : []
  const idx = stored.findIndex((t) => t?.key === key)
  if (idx < 0) return error('trade not found in the day ledger')

  const updated = applyMentalStop(stored[idx], mentalStop)
  stored[idx] = updated
  draft.tradovate = stored
  data.draft = { ...draft }
  writeEntry('days', `${date}.md`, data, day.body ?? '')
  addChange('day', `day ${date}`, `mental SL ${mentalStop ?? 'cleared'} → ${key}`)

  return json({ ok: true, needsStop: updated.needsStop, riskPoints: updated.riskPoints })
}
