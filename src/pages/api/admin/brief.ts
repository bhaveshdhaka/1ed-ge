import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { readBrief, saveBrief } from '../../../lib/brief'
import { addChange } from '../../../lib/changes'
import { cmeToday } from '../../../lib/sessions'

export const prerender = false

export const GET: APIRoute = async ({ request, url }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const date = url.searchParams.get('date') ?? cmeToday()
  return json({ ok: true, date, brief: readBrief(date) })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
  const text = String(body.text ?? '').trim()
  if (!text) return error('brief is empty')
  saveBrief(date, text)
  addChange('brief', `brief ${date}`)
  return json({ ok: true, date })
}
