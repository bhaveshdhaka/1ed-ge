import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { structureDayFull, readScreenshot, readScreenTime, assist, type AssistKind } from '../../../lib/ai'
import { listMds } from '../../../lib/content'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  try {
    if (action === 'day' || action === 'structure') {
      const accounts = listMds('accounts').map((f) => f.replace(/\.md$/, ''))
      const habits = listMds('habits').map((f) => f.replace(/\.md$/, ''))
      const images = Array.isArray(body.images)
        ? body.images.filter((s: unknown): s is string => typeof s === 'string' && s.startsWith('data:image'))
        : []
      const result = await structureDayFull(String(body.text ?? ''), images, { accounts, habits })
      return json({ ok: true, result })
    }
    if (action === 'vision') {
      const result = await readScreenshot(String(body.image ?? ''))
      return json({ ok: true, result })
    }
    if (action === 'screentime') {
      const result = await readScreenTime(String(body.image ?? ''))
      return json({ ok: true, result })
    }
    if (action === 'assist') {
      const kind = (String(body.kind ?? 'polish') as AssistKind) || 'polish'
      const result = await assist(String(body.text ?? ''), kind)
      return json({ ok: true, result })
    }
    return error('unknown action')
  } catch (e) {
    return error(e instanceof Error ? e.message : 'ai error', 500)
  }
}
