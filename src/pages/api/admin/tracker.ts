import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry, sanitizeSlug } from '../../../lib/content'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const habits = listMds('habits').map((f) => {
    const e = readEntry('habits', f)
    return { slug: f.replace(/\.md$/, ''), ...(e.data as Record<string, unknown>) }
  })
  const logs = listMds('habitLog')
    .map((f) => {
      const e = readEntry('habitLog', f)
      return { file: f, date: (e.data as { date?: string }).date ?? f.replace(/\.md$/, ''), ...e.data }
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return json({ ok: true, habits, logs })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')

  if (action === 'saveLog') {
    const date = String(body.date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
    const values = body.values && typeof body.values === 'object' ? body.values : {}
    const data: Record<string, unknown> = {
      date,
      ...(body.note ? { note: String(body.note) } : {}),
      values,
    }
    writeEntry('habitLog', `${date}.md`, data, '')
    return json({ ok: true, file: `${date}.md` })
  }

  if (action === 'saveHabit') {
    const name = String(body.name ?? '').trim()
    if (!name) return error('habit name required')
    const slug = body.slug ? sanitizeSlug(String(body.slug)) : sanitizeSlug(name)
    if (!slug) return error('invalid slug')
    const data: Record<string, unknown> = {
      name,
      ...(body.emoji ? { emoji: String(body.emoji) } : {}),
      color: String(body.color ?? '#4ade80'),
      ...(body.description ? { description: String(body.description) } : {}),
    }
    writeEntry('habits', `${slug}.md`, data, '')
    return json({ ok: true, slug })
  }

  if (action === 'deleteHabit') {
    const slug = sanitizeSlug(String(body.slug ?? ''))
    if (!slug) return error('invalid slug')
    deleteEntry('habits', `${slug}.md`)
    return json({ ok: true })
  }

  if (action === 'deleteLog') {
    const date = String(body.date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
    deleteEntry('habitLog', `${date}.md`)
    return json({ ok: true })
  }

  return error('unknown action')
}
