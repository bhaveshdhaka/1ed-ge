import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../lib/content'
import { addChange } from '../../../lib/changes'
import {
  type PeriodType,
  PERIOD_TYPES,
  periodAnchor,
  periodRange,
  isoFromAnchor,
} from '../../../lib/periods'
import { aggregatePeriod, trendSeries, type PeriodStatsCtx } from '../../../lib/period-stats'
import { comparePeriods, renderComparisonFallback } from '../../../lib/review-compare'
import type { DayData, DayTrade } from '../../../lib/stream'

export const prerender = false

const ANCHOR_RE: Record<PeriodType, RegExp> = {
  week: /^\d{4}-((0[1-9]|[1-4]\d)|5[0-3])$/,
  month: /^\d{4}-(0[1-9]|1[0-2])$/,
  quarter: /^\d{4}-q[1-4]$/,
  half: /^\d{4}-h[12]$/,
  year: /^\d{4}$/,
}

function isType(t: unknown): t is PeriodType {
  return typeof t === 'string' && (PERIOD_TYPES as string[]).includes(t)
}

function validAnchor(type: PeriodType, anchor: string): boolean {
  return ANCHOR_RE[type].test(anchor)
}

const fileOf = (type: PeriodType, anchor: string) => `${type}-${anchor}.md`
const cmpFileOf = (type: PeriodType, anchor: string) => `${type}-${anchor}.cmp.md`

/** Periods that actually have day data — derived from day files, no fixed horizon. */
function availablePeriods(): Record<PeriodType, { anchor: string; label: string }[]> {
  const dates = listMds('days')
    .map((f) => f.replace(/\.mdx?$/, ''))
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
    .sort()
  const out: Record<PeriodType, { anchor: string; label: string }[]> = {
    week: [],
    month: [],
    quarter: [],
    half: [],
    year: [],
  }
  for (const iso of dates) {
    for (const type of PERIOD_TYPES) {
      const anchor = periodAnchor(type, iso)
      const list = out[type]
      if (!list.some((p) => p.anchor === anchor)) {
        list.push({ anchor, label: periodRange(type, iso).label })
      }
    }
  }
  for (const type of PERIOD_TYPES) out[type].sort((a, b) => b.anchor.localeCompare(a.anchor))
  return out
}

/** Coerce a day-file frontmatter record into the DayData shape aggregatePeriod expects. */
function toDayData(raw: Record<string, unknown>): DayData {
  const num = (v: unknown): number | undefined => {
    const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
    return Number.isFinite(x) ? x : undefined
  }
  const trades: DayTrade[] = Array.isArray(raw.trades)
    ? raw.trades
        .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
        .map((t) => {
          const stop = num(t.stop)
          const riskPoints = num(t.riskPoints)
          const executions = Array.isArray(t.executions)
            ? t.executions
                .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof e.account === 'string')
                .map((e) => {
                  const size = num(e.size)
                  const row: { account: string; size?: number } = { account: String(e.account) }
                  if (size !== undefined) row.size = size
                  return row
                })
            : []
          const trade: DayTrade = {
            market: typeof t.market === 'string' ? t.market.toUpperCase() : 'MNQ',
            direction: t.direction === 'short' ? 'short' : 'long',
            entry: num(t.entry) ?? 0,
            exit: num(t.exit) ?? 0,
            points: num(t.points) ?? 0,
          }
          if (typeof t.session === 'string' && t.session) trade.session = t.session
          if (typeof t.setup === 'string' && t.setup) trade.setup = t.setup
          if (typeof t.model === 'string' && t.model) trade.model = t.model
          if (stop !== undefined) trade.stop = stop
          if (riskPoints !== undefined) trade.riskPoints = riskPoints
          if (typeof t.note === 'string' && t.note) trade.note = t.note
          if (typeof t.commentary === 'string' && t.commentary) trade.commentary = t.commentary
          const screenshots = Array.isArray(t.screenshots) ? t.screenshots.filter((s): s is string => typeof s === 'string') : []
          if (screenshots.length) trade.screenshots = screenshots
          if (executions.length) trade.executions = executions
          return trade
        })
    : []
  const day: DayData = {
    date: typeof raw.date === 'string' ? raw.date : '',
    trades,
    stream: Array.isArray(raw.stream) ? (raw.stream as DayData['stream']) : [],
  }
  if (typeof raw.mood === 'number') day.mood = raw.mood
  if (raw.sleep && typeof raw.sleep === 'object') day.sleep = raw.sleep as DayData['sleep']
  if (raw.habits && typeof raw.habits === 'object') day.habits = raw.habits as DayData['habits']
  if (raw.device && typeof raw.device === 'object') day.device = raw.device as DayData['device']
  return day
}

/** Habits + accounts context for period aggregation, straight from the files. */
function statsCtx(): PeriodStatsCtx {
  const habits = listMds('habits').map((f) => {
    const d = readEntry('habits', f).data as Record<string, unknown>
    return {
      id: f.replace(/\.mdx?$/, ''),
      kind: d.kind === 'count' ? ('count' as const) : ('bool' as const),
      ...(typeof d.target === 'number' ? { target: d.target } : {}),
    }
  })
  const accounts = listMds('accounts').map((f) => {
    const d = readEntry('accounts', f).data as Record<string, unknown>
    return { id: String(d.id ?? f.replace(/\.mdx?$/, '')), pointsValue: Number(d.pointsValue ?? 2) }
  })
  return { habits, accounts }
}

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const url = new URL(request.url)
  const typeRaw = url.searchParams.get('type')
  const anchorRaw = url.searchParams.get('anchor')

  // No params → the list of periods that have day data (drives the picker).
  if (!typeRaw && !anchorRaw) {
    return json({ ok: true, periods: availablePeriods() })
  }

  if (!isType(typeRaw) || !anchorRaw || !validAnchor(typeRaw, anchorRaw)) {
    return error('invalid type or anchor (expected type in week|month|quarter|half|year, anchor like 2026-32)')
  }
  const file = fileOf(typeRaw, anchorRaw)
  const cmpFile = cmpFileOf(typeRaw, anchorRaw)
  const files = listMds('reviews')
  const review = files.includes(file) ? readEntry('reviews', file) : null
  const comparison = files.includes(cmpFile) ? readEntry('reviews', cmpFile).body : null
  return json({
    ok: true,
    review: review ? { file, data: review.data, body: review.body } : null,
    comparison,
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const type = body.type
  const anchor = String(body.anchor ?? '')
  if (!isType(type) || !validAnchor(type, anchor)) {
    return error('invalid type or anchor (expected type in week|month|quarter|half|year, anchor like 2026-32)')
  }

  // --- AI comparison: aggregate current + previous + trend → comparePeriods
  // (code-rendered fallback on model failure) → store .cmp.md. Never blank. ---
  if (body.action === 'compare') {
    const days = listMds('days').map((f) => toDayData(readEntry('days', f).data as Record<string, unknown>))
    const ctx = statsCtx()
    const curRange = periodRange(type, isoFromAnchor(type, anchor))
    const prevStats = aggregatePeriod(days, curRange.prev, ctx)
    const curStats = aggregatePeriod(days, curRange, ctx)
    const trend = trendSeries(type, days, 6, ctx)
    let comparison: string
    try {
      comparison = await comparePeriods(prevStats, curStats, trend)
    } catch {
      comparison = renderComparisonFallback(prevStats, curStats, trend)
    }
    const cmpFile = cmpFileOf(type, anchor)
    writeEntry('reviews', cmpFile, {}, comparison)
    addChange('review', `review comparison ${cmpFile}`)
    return json({ ok: true, comparison })
  }

  // --- Direct save of an edited comparison (no regeneration). ---
  if (body.action === 'compare-save') {
    const comparison = String(body.comparison ?? '')
    const cmpFile = cmpFileOf(type, anchor)
    writeEntry('reviews', cmpFile, {}, comparison)
    addChange('review', `review comparison ${cmpFile}`)
    return json({ ok: true, comparison })
  }

  // --- The review note itself. ---
  const date = isoFromAnchor(type, anchor) // representative iso for the period
  const data: Record<string, unknown> = {
    type,
    anchor,
    date,
    ...(body.title && String(body.title).trim() ? { title: String(body.title).trim() } : {}),
  }
  const file = fileOf(type, anchor)
  writeEntry('reviews', file, data, String(body.body ?? ''))
  addChange('review', `review ${file}`)
  return json({ ok: true, file })
}
