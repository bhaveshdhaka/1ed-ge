import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry, sanitizeSlug } from '../../../lib/content'
import { addChange } from '../../../lib/changes'
import { buildStats, flatten } from '../../../lib/stats'
import { accountRuleStatus, type AccountLike } from '../../../lib/account-rules'
import { todayHkt } from '../../../lib/sessions'

export const prerender = false

const STAGES = ['eval', 'funded', 'buffer', 'payout', 'failed', 'paused']

/** Owner-dictated rules pass-through — only the six known fields survive; empty → dropped. */
function rulesFrom(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const dll = Number(body.dailyLossLimit)
  if (Number.isFinite(dll) && dll > 0) out.dailyLossLimit = dll
  const pt = Number(body.profitTarget)
  if (Number.isFinite(pt) && pt > 0) out.profitTarget = pt
  const cp = Number(body.consistencyPct)
  if (Number.isFinite(cp) && cp >= 0 && cp <= 100) out.consistencyPct = cp
  const bb = Number(body.bufferBalance)
  if (Number.isFinite(bb) && bb > 0) out.bufferBalance = bb
  const dm = String(body.drawdownMode ?? '')
  if (['eod', 'intraday', 'intraday-to-eod'].includes(dm)) out.drawdownMode = dm
  const ps = Number(body.payoutSplit)
  if (Number.isFinite(ps) && ps >= 0 && ps <= 100) out.payoutSplit = ps
  return out
}

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)

  // fs reads skip content-collection defaults — default trades/executions +
  // stages so flatten()/buildStats() stay safe on hand-written/legacy files.
  const dayEntries = listMds('days').map((f) => {
    const data = readEntry('days', f).data as Record<string, unknown>
    const trades = Array.isArray(data.trades)
      ? (data.trades as Record<string, unknown>[]).map((t) => ({ executions: [], ...t }))
      : []
    return { id: f, collection: 'days', data: { ...data, trades } } as never
  })
  const accountEntries = listMds('accounts').map((f) => {
    const data = readEntry('accounts', f).data as Record<string, unknown>
    return { id: f, collection: 'accounts', data: { stages: [], ...data } } as never
  })
  const payoutEntries = listMds('payouts').map((f) => {
    const data = readEntry('payouts', f).data as Record<string, unknown>
    return { id: f, collection: 'payouts', data } as never
  })

  const { executions } = flatten(dayEntries, accountEntries)
  const stats = buildStats(dayEntries, accountEntries, payoutEntries)
  const today = todayHkt()

  const accounts = listMds('accounts')
    .map((f) => {
      const data = readEntry('accounts', f).data as Record<string, unknown>
      const id = String(data.id ?? f.replace(/\.md$/, ''))
      const stat = stats.perAccount.find((s) => s.id === id)
      return {
        file: f,
        id,
        ...data,
        status: accountRuleStatus(data as unknown as AccountLike, stat, executions, today),
      }
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const payouts = listMds('payouts')
    .map((f) => {
      const data = readEntry('payouts', f).data as Record<string, unknown>
      return { file: f, date: String(data.date ?? ''), ...data }
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return json({ ok: true, accounts, payouts })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')

  if (action === 'save') {
    const id = sanitizeSlug(String(body.id ?? ''))
    if (!id) return error('account id required (e.g. lucid-50k-b)')
    const stage = STAGES.includes(String(body.stage)) ? String(body.stage) : 'eval'
    const stages = Array.isArray(body.stages) ? body.stages : []
    const data = {
      id,
      firm: String(body.firm ?? ''),
      size: Number(body.size ?? 50000),
      sizeLabel: String(body.sizeLabel ?? `${Math.round(Number(body.size ?? 50000) / 1000)}k`),
      drawdownLimit: Number(body.drawdownLimit ?? 2000),
      trailing: body.trailing !== false,
      contract: String(body.contract ?? 'MNQ'),
      pointsValue: Number(body.pointsValue ?? 2),
      riskPerTrade: Number(body.riskPerTrade ?? 200),
      stage,
      stages: stages.map((s: any) => ({
        stage: STAGES.includes(String(s?.stage)) ? String(s.stage) : 'eval',
        from: String(s?.from ?? ''),
        ...(s?.to ? { to: String(s.to) } : {}),
        ...(s?.note ? { note: String(s.note) } : {}),
      })),
      ...(body.note ? { note: String(body.note) } : {}),
      platformIds: Array.isArray(body.platformIds) ? body.platformIds.filter((p: unknown) => typeof p === 'string') : [],
      ...(body.rules && typeof body.rules === 'object' ? rulesFrom(body.rules as Record<string, unknown>) : {}),
    }
    writeEntry('accounts', `${id}.md`, data, '')
    addChange('account', `account ${id}`, `${data.firm} ${data.sizeLabel} → ${stage}`)
    return json({ ok: true, id })
  }

  if (action === 'payout') {
    const date = String(body.date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
    const account = String(body.account ?? '')
    const amount = Number(body.amount)
    if (!account || !Number.isFinite(amount) || amount <= 0) return error('account and positive amount required')
    const data = {
      date,
      account,
      amount: Math.round(amount * 100) / 100,
      status: body.status === 'pending' ? 'pending' : 'paid',
      ...(body.note ? { note: String(body.note) } : {}),
    }
    const file = `${date}-${sanitizeSlug(account)}.md`
    writeEntry('payouts', file, data, '')
    addChange('payout', `payout ${account}`, `$${Math.round(amount).toLocaleString()} (${data.status})`)
    return json({ ok: true, file })
  }

  if (action === 'deletePayout') {
    const file = String(body.file ?? '')
    if (!/^[\w.-]+\.md$/.test(file)) return error('invalid file')
    deleteEntry('payouts', file)
    addChange('payout', `payout deleted`, file)
    return json({ ok: true })
  }

  if (action === 'delete') {
    const id = sanitizeSlug(String(body.id ?? ''))
    if (!id) return error('invalid id')
    deleteEntry('accounts', `${id}.md`)
    addChange('account', `account ${id} deleted`)
    return json({ ok: true })
  }

  return error('unknown action')
}
