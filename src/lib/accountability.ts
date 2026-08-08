// Accountability engine — pending end-of-day + period reflections.
// Pure and deterministic: `nowIso` is injected (HKT wall-clock time).
//
// Owner-locked rules (2026-08-07):
//   - EVERY Mon–Fri day requires an end-of-day journal post — a writing habit,
//     even on zero-trade days. Sat/Sun are relaxed: no day reflection due, only
//     the week review is the weekend duty.
//   - Grace = STRICT 3 hours after midnight HKT, no more. Day X is due by
//     03:00 HKT on day X+1; after that it counts as pending.
//   - A COMPLETED period (week/month/quarter/half/year) with no review note is
//     pending past its grace: a week is due Mon 03:00 HKT after the Mon–Fri
//     trading week; month/quarter/half/year are due 03:00 HKT the day after the
//     period ends. In-progress periods never count.
//
// Time convention: `nowIso` and the due boundaries are compared on their
// `YYYY-MM-DDTHH:MM` prefix — zero-padded, so lexicographic order is
// chronological (no TZ math; all dates are plain HKT dates). A bare
// `YYYY-MM-DD` nowIso reads as midnight HKT that day. The 03:00 HKT grace is
// modelled as `YYYY-MM-DDT03:00:00` and a period/day is due when
// `nowIso >= dueIso` (minute granularity).

import type { DayData } from './stream'
import type { PeriodType, PeriodRange } from './periods'
import { periodRangesBetween } from './periods'

export interface AccountabilityStatus {
  pendingDays: number
  pendingPeriods: string[]
}

const DAY_MS = 86400000

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function toIso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(iso: string, n: number): string { return toIso(new Date(parseIso(iso).getTime() + n * DAY_MS)) }

/** 0 = Sun … 6 = Sat, computed on the UTC representation of the plain date. */
function dayOfWeek(iso: string): number { return parseIso(iso).getUTCDay() }
function isWeekday(iso: string): boolean { const d = dayOfWeek(iso); return d >= 1 && d <= 5 }

/**
 * `nowIso` ≥ a `YYYY-MM-DDT03:00:00` boundary, compared on the `YYYY-MM-DDTHH:MM`
 * prefix. At exactly 03:00 the item IS due (`>=`), a second before it is not.
 */
function pastGrace(nowIso: string, dueIso: string): boolean {
  return nowIso.slice(0, 16) >= dueIso.slice(0, 16)
}

/** A completed period's grace boundary: week → Mon 03:00 after the Mon–Fri week (endIso + 3d); others → day after end at 03:00 (endIso + 1d). */
function periodDueIso(range: PeriodRange): string {
  const lag = range.type === 'week' ? 3 : 1
  return `${addDays(range.endIso, lag)}T03:00:00`
}

/** Data horizon = earliest day/journal date; bounds the periods we ever consider (no hardcoded 2-year/730 cap, no pre-history phantom periods). */
function earliestIso(days: DayData[], journalDates: string[]): string | null {
  let min: string | null = null
  for (const d of days) if (min === null || d.date < min) min = d.date
  for (const j of journalDates) if (min === null || j < min) min = j
  return min
}

/**
 * Facts only: how much reflection is overdue right now.
 *
 * - `pendingDays`: Mon–Fri days (from the given day records — a day is due even
 *   with zero trades) that are past their 03:00-HKT-next-day grace with no
 *   journal post for that date.
 * - `pendingPeriods`: completed week/month/quarter/half/year periods past their
 *   grace with no review note, as display strings — `week 32` for weeks (the
 *   range label), `month`/`quarter`/`half`/`year` (the type name) otherwise.
 *   One entry per pending period, in period order (weeks, then months, then
 *   quarters, then halves, then years). Week labels are year-less by design
 *   (matching the copy fragments); the consumer renders them as-is.
 */
export function accountabilityStatus(
  days: DayData[],
  journalDates: string[],
  reviews: { type: string; anchor: string }[],
  nowIso: string,
): AccountabilityStatus {
  const today = nowIso.slice(0, 10)
  const journal = new Set(journalDates)
  const notes = new Set(reviews.map((r) => `${r.type}:${r.anchor}`))

  // --- pending days ---
  let pendingDays = 0
  for (const day of days) {
    if (day.date > today) continue      // future day records can't be due
    if (!isWeekday(day.date)) continue  // Sat/Sun relaxed
    if (journal.has(day.date)) continue // reflection posted
    const due = `${addDays(day.date, 1)}T03:00:00` // day X due 03:00 HKT on X+1
    if (pastGrace(nowIso, due)) pendingDays++
  }

  // --- pending periods ---
  const pendingPeriods: string[] = []
  const horizon = earliestIso(days, journalDates)
  if (horizon) {
    const types: PeriodType[] = ['week', 'month', 'quarter', 'half', 'year']
    for (const type of types) {
      for (const range of periodRangesBetween(type, horizon, today)) {
        if (notes.has(`${type}:${range.anchor}`)) continue         // review note exists
        if (!pastGrace(nowIso, periodDueIso(range))) continue      // not completed / still in grace
        pendingPeriods.push(type === 'week' ? range.label : type)
      }
    }
  }

  return { pendingDays, pendingPeriods }
}
