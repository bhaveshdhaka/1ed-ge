import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { structureTradeNotes, readScreenshot, assist, type AssistKind } from '../../../lib/ai'
import { listMds } from '../../../lib/content'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  try {
    if (action === 'structure') {
      const accounts = listMds('accounts').map((f) => f.replace(/\.md$/, ''))
      const result = await structureTradeNotes(String(body.text ?? ''), accounts)
      return json({ ok: true, result })
    }
    if (action === 'vision') {
      const result = await readScreenshot(String(body.image ?? ''))
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
