import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { listMds, readEntry } from '../../../lib/content'
import { nowHkt } from '../../../lib/sessions'
import { fmtDay } from '../../../lib/dates'
import {
  type PeriodType,
  PERIOD_TYPES,
  periodRange,
  periodRangesBetween,
} from '../../../lib/periods'

export const prerender = false

const DAY_MS = 86400000

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function addDays(iso: string, n: number): string {
  return toIso(new Date(parseIso(iso).getTime() + n * DAY_MS))
}
function dayOfWeek(iso: string): number {
  return parseIso(iso).getUTCDay()
}
function isWeekday(iso: string): boolean {
  const d = dayOfWeek(iso)
  return d >= 1 && d <= 5
}
function pastGrace(nowIso: string, dueIso: string): boolean {
  return nowIso.slice(0, 16) >= dueIso.slice(0, 16)
}
function periodDueIso(range: { type: PeriodType; endIso: string }): string {
  const lag = range.type === 'week' ? 3 : 1
  return `${addDays(range.endIso, lag)}T03:00:00`
}

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)

  const nowIso = nowHkt()
  const today = nowIso.slice(0, 10)

  const dayFiles = listMds('days')
  const journalFiles = listMds('journal')
  const reviewFiles = listMds('reviews').filter((f) => !f.endsWith('.cmp.md'))

  const dayDates = dayFiles
    .map((f) => f.replace(/\.mdx?$/, ''))
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
    .sort()

  const journalDates = journalFiles
    .map((f) => {
      const d = readEntry('journal', f).data as Record<string, unknown>
      return typeof d.date === 'string' ? d.date : ''
    })
    .filter(Boolean)

  const reviewAnchors = new Set(
    reviewFiles
      .map((f) => f.replace(/\.mdx?$/, ''))
      .filter((s) => /^\w+-/.test(s))
      .map((s) => {
        const [type, ...rest] = s.split('-')
        return `${type}:${rest.join('-')}`
      }),
  )

  // --- pending daily reflections ---
  const journal = new Set(journalDates)
  const pendingDaily: { date: string; label: string; overdue: boolean }[] = []
  for (const date of dayDates) {
    if (date > today) continue
    if (!isWeekday(date)) continue
    if (journal.has(date)) continue
    const due = `${addDays(date, 1)}T03:00:00`
    const overdue = pastGrace(nowIso, due)
    pendingDaily.push({ date, label: fmtDay(date), overdue })
  }

  // --- pending period reviews ---
  const pendingPeriods: { type: PeriodType; anchor: string; label: string }[] = []
  const horizon = [...dayDates, ...journalDates].sort()[0]
  if (horizon) {
    for (const type of PERIOD_TYPES) {
      for (const range of periodRangesBetween(type, horizon, today)) {
        if (reviewAnchors.has(`${type}:${range.anchor}`)) continue
        if (!pastGrace(nowIso, periodDueIso(range))) continue
        pendingPeriods.push({ type, anchor: range.anchor, label: range.label })
      }
    }
  }

  return json({ ok: true, pendingDaily, pendingPeriods })
}
