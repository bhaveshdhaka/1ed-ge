import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../lib/content'
import { addChange } from '../../../lib/changes'
import {
  type PeriodType,
  PERIOD_TYPES,
  periodAnchor,
  periodRange,
  isoFromAnchor,
} from '../../../lib/periods'

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

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
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
  if (!listMds('reviews').includes(file)) {
    return json({ ok: true, review: null })
  }
  const e = readEntry('reviews', file)
  return json({ ok: true, review: { file, data: e.data, body: e.body } })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const type = body.type
  const anchor = String(body.anchor ?? '')
  if (!isType(type) || !validAnchor(type, anchor)) {
    return error('invalid type or anchor (expected type in week|month|quarter|half|year, anchor like 2026-32)')
  }

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
