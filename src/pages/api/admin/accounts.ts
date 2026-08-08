import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry, sanitizeSlug } from '../../../lib/content'
import { addChange } from '../../../lib/changes'

export const prerender = false

const STAGES = ['eval', 'buffer', 'payout', 'failed', 'paused']

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const accounts = listMds('accounts')
    .map((f) => {
      const data = readEntry('accounts', f).data as Record<string, unknown>
      return { file: f, id: data.id ?? f.replace(/\.md$/, ''), ...data }
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
  if (!authorized(request)) return error('unauthorized', 401)
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
