/**
 * copy.ts — the single source of every public-facing message on the site.
 *
 * Owner directive: the language of ALL messages/reminders must be well-thought,
 * consistent, using proper terminologies. Every surface (homepage nudge, admin
 * reminder, period pages, AI comparison labels) imports from here —
 * consistency by construction, the same way `strip.ts` owns market phrases.
 *
 * Locked vocabulary (do not paraphrase):
 * - **trader** — third-person moniker for the owner.
 * - **admin** — the private area (never "cockpit").
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
 * ONE compact line, always: period fragments are aggregated by type with
 * counts instead of listed individually (a year of missed weeks must not
 * render as a wall of text).
 *
 * - `trader has 1 day's pending end of day reflection`
 * - `trader has 2 days' pending end of day reflection`
 * - `1 weekly reflection missing`
 * - Combined: `trader has 2 days' pending end of day reflection · 1 weekly · 1 monthly reflections missing`
 */
export function pendingReflectionsLine(pendingDays: number, pendingPeriods: string[]): string | null {
  const parts: string[] = []
  if (pendingDays > 0) {
    const dayWord = pendingDays === 1 ? "1 day's" : `${pendingDays} days'`
    parts.push(`trader has ${dayWord} pending end of day reflection`)
  }
  const counts = { weekly: 0, monthly: 0, quarterly: 0, 'half-year': 0, yearly: 0 }
  let total = 0
  for (const p of pendingPeriods) {
    if (!p) continue
    total++
    if (p.startsWith('week ')) counts.weekly++
    else if (p === 'month') counts.monthly++
    else if (p === 'quarter') counts.quarterly++
    else if (p === 'half') counts['half-year']++
    else if (p === 'year') counts.yearly++
    else counts.weekly++ // unknown fragment — still counted, don't drop it
  }
  if (total > 0) {
    const agg = Object.entries(counts).filter(([, n]) => n > 0).map(([word, n]) => `${n} ${word}`)
    if (agg.length > 0) parts.push(`${agg.join(' · ')} reflection${total === 1 ? '' : 's'} missing`)
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

export const TAPE = 'the tape'

/** Empty states. */
export const EMPTY_PERIOD = 'no days logged in this period.'

/** `imported N trades` — ingest apply-confirm line (plan-locked, exact string). */
export function importedTrades(n: number): string {
  return `imported ${n} trades`
}

// --- Tradovate CSV import surface (owner plan: CSV-file import, honest
// MAE/MFE from fill data, mental-SL prompt for stop-less positions) ---

/** `imported N tradovate round trips` — tradovate apply-confirm line. */
export function tradovateImported(n: number): string {
  return `imported ${n} tradovate round trip${n === 1 ? '' : 's'}`
}

/** `N updated` — re-import merged into the existing ledger. */
export function tradovateUpdated(n: number): string {
  return `${n} updated`
}

/** `N positions have no recorded stop — set the mental SL.` — the SL prompt banner. */
export function tradovateNeedsStop(n: number): string {
  return `${n} position${n === 1 ? '' : 's'} have no recorded stop — set the mental SL`
}

/** `mental SL set — 3 left` — ledger save-confirm line. */
export function tradovateMentalStopSaved(remaining: number): string {
  return `mental SL set${remaining ? ` — ${remaining} left` : ''}`
}

/** Honesty note for the mae/mfe columns (fills-only data, never invented). */
export const TRADOVATE_EXCURSION_NOTE =
  'mae/mfe from fill data only — exact when stopped out, otherwise a proven bound (≥); true intra-trade excursion needs tick data'
