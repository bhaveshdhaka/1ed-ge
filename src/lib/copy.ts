/**
 * copy.ts — the single source of every public-facing message on the site.
 *
 * Owner directive: the language of ALL messages/reminders must be well-thought,
 * consistent, using proper terminologies. Every surface (homepage nudge, zen
 * reminder, period pages, /lookback, AI comparison labels) imports from here —
 * consistency by construction, the same way `strip.ts` owns market phrases.
 *
 * Locked vocabulary (do not paraphrase):
 * - **trader** — third-person moniker for the owner.
 * - **zen** — the private area (never "admin"/"cockpit").
 * - **reflection** — the written end-of-period note.
 * - **period review** — the review surface.
 * - **comparison · from verified data** — the AI comparison label.
 * - **week = Mon–Fri trading week.**
 *
 * Voice: factual, terminal-styled, no gyaan, no acrimony, R-centric.
 */
import { fmtDayW } from './dates'

/** A labelled date range — the period a review covers. Structural: any Task-2
 * PeriodRange shape with at least these fields assigns to it. */
export interface PeriodRange {
  label: string
  startIso: string
  endIso: string
}

/** `trader is live` / `trader is offline · last seen {n}d ago`. */
export function liveLine(live: boolean, lastSeenDays: number | null): string {
  if (live) return 'trader is live'
  if (lastSeenDays != null) return `trader is offline · last seen ${lastSeenDays}d ago`
  return 'trader is offline'
}

/**
 * The pending-reflection nudge line, or null when nothing is due.
 *
 * - `trader has 1 day's pending end of day reflection`
 * - `trader has 2 days' pending end of day reflection`
 * - `week 31 reflection missing` / `month reflection missing` / …
 * - Combined: `trader has 2 days' pending end of day reflection · week 31 reflection missing`
 */
export function pendingReflectionsLine(pendingDays: number, pendingPeriods: string[]): string | null {
  const parts: string[] = []
  if (pendingDays > 0) {
    const dayWord = pendingDays === 1 ? "1 day's" : `${pendingDays} days'`
    parts.push(`trader has ${dayWord} pending end of day reflection`)
  }
  for (const p of pendingPeriods) {
    if (p) parts.push(p)
  }
  return parts.length === 0 ? null : parts.join(' · ')
}

/** `week 32 · mon 03-aug → fri 07-aug` — label + fmtDayW of start/end. */
export function periodHeader(range: PeriodRange): string {
  return `${range.label} · ${fmtDayW(range.startIso)} → ${fmtDayW(range.endIso)}`
}

/** Section labels — lowercase, terminal-styled, owner-locked. */
export const REFLECTION = 'reflection'
export const COMPARISON = 'comparison · from verified data'
export const THE_NUMBERS = 'the numbers'
export const TREND = 'trend'
export const VIEW_REVIEW = 'view review →'

/** Empty states. */
export const EMPTY_PERIOD = 'no days logged in this period.'
export const EMPTY_REVIEWS = 'no period reviews yet.'
