import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry, nextTradeSlug } from '../../../lib/content'

export const prerender = false

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
}

function readTrades() {
  return listMds('trades')
    .map((f) => {
      const e = readEntry('trades', f)
      return { file: f, slug: f.replace(/\.(md|mdx)$/, ''), data: e.data }
    })
    .sort((a, b) => b.slug.localeCompare(a.slug))
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const trades = readTrades()
  const accounts = listMds('accounts').map((f) => {
    const e = readEntry('accounts', f)
    return { id: f.replace(/\.md$/, ''), ...e.data }
  })
  return json({ ok: true, trades, accounts })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const t = body.trade ?? body
  const oldFile = typeof body.oldFile === 'string' ? body.oldFile : undefined

  const date = String(t.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date (expected YYYY-MM-DD)')
  const account = String(t.account ?? '')
  if (!account) return error('account is required')
  const entry = num(t.entry)
  const exit = num(t.exit)
  if (entry === null || exit === null) return error('entry and exit are required')
  const direction = t.direction === 'short' ? 'short' : 'long'

  let riskPoints = num(t.riskPoints)
  const stop = num(t.stop)
  if ((riskPoints === null || riskPoints <= 0) && stop !== null) {
    riskPoints = Math.abs(entry - stop)
  }
  if (riskPoints === null || riskPoints <= 0) return error('riskPoints (or stop) is required')

  let points = num(t.points)
  if (points === null) points = Math.round((direction === 'long' ? exit - entry : entry - exit) * 10) / 10

  const confidence = num(t.confidence)
  const data = {
    date,
    account,
    market: String(t.market ?? 'MNQ').toUpperCase(),
    ...(t.session ? { session: String(t.session) } : {}),
    direction,
    ...(t.setup ? { setup: String(t.setup) } : {}),
    entry,
    ...(stop !== null ? { stop } : {}),
    ...(num(t.target) !== null ? { target: num(t.target) as number } : {}),
    exit,
    riskPoints,
    points,
    ...(confidence !== null ? { confidence: Math.max(1, Math.min(5, confidence)) } : {}),
    screenshots: Array.isArray(t.screenshots) ? t.screenshots.filter((s: unknown) => typeof s === 'string') : [],
    ...(t.note ? { note: String(t.note) } : {}),
  }

  const file = oldFile ?? nextTradeSlug(date)
  writeEntry('trades', file, data, '')
  return json({ ok: true, file, slug: file.replace(/\.(md|mdx)$/, '') })
}

export const DELETE: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const file = String(body.file ?? '')
  if (!file || !/^[\w.-]+\.mdx?$/.test(file)) return error('invalid file')
  deleteEntry('trades', file)
  return json({ ok: true })
}
