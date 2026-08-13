import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../../lib/content'
import type { Kind } from '../../../../lib/content'

export const prerender = false

const MAP: Record<string, Kind> = {
  quiet: 'pQuiet',
  nature: 'pNature',
  exercise: 'pExercise',
  rewiring: 'pRewiring',
  '21': 'p21',
}

export const GET: APIRoute = async ({ request, params }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const feature = params.feature
  const kind = feature ? MAP[feature] : undefined
  if (!kind) return error('unknown feature', 404)
  const files = listMds(kind).sort().reverse()
  const records = files.map((f) => {
    const e = readEntry(kind, f)
    return { file: f, data: e.data, text: e.body?.trim() ?? '' }
  })
  return json({ ok: true, feature, count: records.length, records })
}

export const POST: APIRoute = async ({ request, params }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const feature = params.feature
  const kind = feature ? MAP[feature] : undefined
  if (!kind) return error('unknown feature', 404)
  try {
    const body = await request.json()
    const data = (body.data ?? {}) as Record<string, unknown>
    const text = String(body.text ?? body.body ?? '')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${feature}-${stamp}.md`
    writeEntry(kind, filename, data, text)
    return json({ ok: true, file: filename })
  } catch (e: any) {
    return error(e?.message ?? 'failed to save', 500)
  }
}
