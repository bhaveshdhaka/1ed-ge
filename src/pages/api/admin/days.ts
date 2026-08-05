import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../lib/content'
import { addChange } from '../../../lib/changes'

export const prerender = false

const STAGES = ['eval', 'buffer', 'payout', 'failed', 'paused']
const SESSIONS = ['', 'asia', 'london', 'ny-am', 'ny-pm', 'ny']

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
}

function normalizeTrade(t: Record<string, any>, i: number) {
  const entry = num(t.entry)
  const exit = num(t.exit)
  if (entry === null || exit === null) return null
  const direction = t.direction === 'short' ? 'short' : 'long'
  let riskPoints = num(t.riskPoints)
  const stop = num(t.stop)
  if ((riskPoints === null || riskPoints <= 0) && stop !== null) riskPoints = Math.abs(entry - stop)
  let points = num(t.points)
  if (points === null) points = Math.round((direction === 'long' ? exit - entry : entry - exit) * 10) / 10
  const confidence = num(t.confidence)
  return {
    market: String(t.market ?? 'MNQ').toUpperCase(),
    ...(t.session && SESSIONS.includes(String(t.session)) ? { session: String(t.session) } : {}),
    direction,
    ...(t.setup ? { setup: String(t.setup) } : {}),
    entry,
    ...(stop !== null ? { stop } : {}),
    ...(num(t.target) !== null ? { target: num(t.target) as number } : {}),
    exit,
    ...(riskPoints !== null && riskPoints > 0 ? { riskPoints } : {}),
    points,
    ...(confidence !== null ? { confidence: Math.max(1, Math.min(5, confidence)) } : {}),
    ...(t.note ? { note: String(t.note) } : {}),
    screenshots: Array.isArray(t.screenshots) ? t.screenshots.filter((s: unknown) => typeof s === 'string') : [],
    executions: Array.isArray(t.executions)
      ? t.executions
          .filter((e: any) => e && typeof e.account === 'string' && e.account)
          .map((e: any) => ({
            account: String(e.account),
            ...(num(e.size) !== null ? { size: num(e.size) as number } : {}),
            ...(e.note ? { note: String(e.note) } : {}),
          }))
      : [],
  }
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const accounts = listMds('accounts').map((f) => {
    const data = readEntry('accounts', f).data as Record<string, unknown>
    return { id: data.id ?? f.replace(/\.md$/, ''), firm: data.firm ?? '', sizeLabel: data.sizeLabel ?? '', pointsValue: Number(data.pointsValue ?? 2) }
  })
  const habits = listMds('habits').map((f) => {
    const data = readEntry('habits', f).data as Record<string, unknown>
    return { slug: f.replace(/\.md$/, ''), name: data.name ?? f, emoji: data.emoji ?? '', color: data.color ?? '#4ade80' }
  })
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    let day: Record<string, unknown> | null = null
    if (listMds('days').includes(`${date}.md`)) {
      day = readEntry('days', `${date}.md`).data
    }
    return json({ ok: true, day, accounts, habits })
  }
  const days = listMds('days')
    .map((f) => {
      const data = readEntry('days', f).data as Record<string, unknown>
      return { file: f, date: String(data.date ?? ''), mood: data.mood ?? null, trades: (data.trades as unknown[])?.length ?? 0 }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  return json({ ok: true, days, accounts, habits })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date (expected YYYY-MM-DD)')

  const mood = num(body.mood)
  const sleepHours = num(body.sleep?.hours)
  const sleepQuality = num(body.sleep?.quality)
  const deviceScreens = Array.isArray(body.device?.screenshots) ? body.device.screenshots.filter((s: unknown) => typeof s === 'string') : []
  const iphoneHours = num(body.device?.iphoneHours)
  const socialHours = num(body.device?.socialHours)
  const macHours = num(body.device?.macHours)

  const trades = Array.isArray(body.trades)
    ? body.trades.map(normalizeTrade).filter((t: unknown): t is NonNullable<ReturnType<typeof normalizeTrade>> => t !== null)
    : []

  const data: Record<string, unknown> = {
    date,
    ...(mood !== null ? { mood: Math.max(1, Math.min(5, mood)) } : {}),
    ...(sleepHours !== null || sleepQuality !== null
      ? {
          sleep: {
            ...(sleepHours !== null ? { hours: sleepHours } : {}),
            ...(sleepQuality !== null ? { quality: Math.max(1, Math.min(5, sleepQuality)) } : {}),
          },
        }
      : {}),
    ...(body.habits && typeof body.habits === 'object'
      ? { habits: body.habits as Record<string, boolean> }
      : {}),
    ...(iphoneHours !== null || socialHours !== null || macHours !== null || deviceScreens.length || body.device?.notes
      ? {
          device: {
            ...(iphoneHours !== null ? { iphoneHours } : {}),
            ...(socialHours !== null ? { socialHours } : {}),
            ...(macHours !== null ? { macHours } : {}),
            ...(body.device?.notes ? { notes: String(body.device.notes) } : {}),
            screenshots: deviceScreens,
          },
        }
      : {}),
    trades,
  }

  writeEntry('days', `${date}.md`, data, '')
  const detail = `${trades.length} trade${trades.length === 1 ? '' : 's'}` + (mood !== null ? ` · mood ${mood}` : '') + (deviceScreens.length ? ' · screen-time' : '')
  addChange('day', `day ${date}`, detail)
  return json({ ok: true, file: `${date}.md`, trades: trades.length })
}

export const DELETE: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
  const { deleteEntry } = await import('../../../lib/content')
  deleteEntry('days', `${date}.md`)
  addChange('day', `day ${date} deleted`)
  return json({ ok: true })
}
