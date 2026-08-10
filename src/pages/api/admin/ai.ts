import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import {
  readScreenshot,
  readStatement,
  assist,
  draftReflection,
  dailyBrief,
  type AssistKind,
} from '../../../lib/ai'
import { listMds } from '../../../lib/content'
import { buildBriefSnapshot } from '../../../lib/brief'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  try {
    if (action === 'vision') {
      const result = await readScreenshot(String(body.image ?? ''))
      return json({ ok: true, result })
    }
    if (action === 'statement') {
      const result = await readStatement(String(body.image ?? ''))
      return json({ ok: true, result })
    }
    if (action === 'assist') {
      const kind = (String(body.kind ?? 'polish') as AssistKind) || 'polish'
      const result = await assist(String(body.text ?? ''), kind)
      return json({ ok: true, result })
    }
    if (action === 'draft') {
      const result = await draftReflection(String(body.text ?? ''))
      return json({ ok: true, result })
    }
    if (action === 'brief') {
      const date = String(body.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
      const snapshot = buildBriefSnapshot(date)
      const result = await dailyBrief(snapshot)
      return json({ ok: true, result })
    }
    return error('unknown action')
  } catch (e) {
    return error(e instanceof Error ? e.message : 'ai error', 500)
  }
}
