// AI factual comparison for period reviews. The AI is a FORMATTER over
// verified numbers (no gyaan): current vs previous deltas + the trend series
// read in order, rendered as bullet-point markdown. The owner writes the
// reflection; this writes the numbers only.
//
// On model failure the CALLER falls back to renderComparisonFallback (pure
// code, same bullets) so the page is never blank.

import { orChat } from './ai'
import { env } from './env'
import { periodDelta, type PeriodStats, type TrendPoint } from './period-stats'

// --- finite-safe formatting (never "NaN") ---

/** Finite-safe number formatting: finite → up to 2dp, otherwise '∞'. */
export function formatNum(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '∞'
}

/** Finite-safe percent formatting for a fraction (0.6 → '60%'). null → '—' (no previous baseline). */
export function formatPct(p: number | null): string {
  if (p === null) return '—'
  return Number.isFinite(p) ? `${Math.round(p * 1000) / 10}%` : '∞'
}

function signed(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  const v = Math.round(n * 100) / 100
  return v > 0 ? `+${v}` : String(v)
}

// The six headline fields compared across periods (matches periodDelta).
const COMPARE_FIELDS: { key: keyof Pick<PeriodStats, 'sumR' | 'expectancyR' | 'winRate' | 'profitFactor' | 'trades' | 'tradedDays'>; label: string }[] = [
  { key: 'sumR', label: 'sumR' },
  { key: 'expectancyR', label: 'expectancyR' },
  { key: 'winRate', label: 'winRate' },
  { key: 'profitFactor', label: 'profitFactor' },
  { key: 'trades', label: 'trades' },
  { key: 'tradedDays', label: 'tradedDays' },
]

function statsTable(s: PeriodStats): string {
  return COMPARE_FIELDS.map(({ key, label }) => {
    const v = s[key] as number
    return `${label} ${key === 'winRate' ? formatPct(v) : formatNum(v)}`
  }).join(' | ')
}

function trendLines(trend: TrendPoint[]): string {
  if (trend.length === 0) return '(no trend periods)'
  return trend.map((p) => `${p.label}: sumR ${formatNum(p.sumR)} | winRate ${formatPct(p.winRate)} | trades ${formatNum(p.trades)}`).join('\n')
}

const SYSTEM_PROMPT = `You compare two trading periods from verified data. You are a FORMATTER over numbers, nothing else.
Rules:
- Bullet points ONLY. No headings, no prose, no advice, no speculation.
- State the numbers exactly as given: for each field, "field: cur vs prev (delta, pct)".
- Read the trend series IN ORDER (oldest to newest) and list each period's numbers.
- End with exactly ONE bullet "- trend: …" summarizing the series direction from the numbers (up/down/flat and by roughly how much).
- NEVER add a number that is not present in the input. NEVER interpret, advise or judge.
- Omit the pct when it is marked "—" (no previous baseline).`

/**
 * The AI writes the comparison bullets. Pass ONLY the numbers (compact
 * current/previous tables + the trend series as lines); deltas/pct come from
 * those numbers. Throws on model failure — the caller falls back to
 * `renderComparisonFallback`.
 */
export async function comparePeriods(prev: PeriodStats, cur: PeriodStats, trend: TrendPoint[]): Promise<string> {
  const input = `CURRENT period:\n${statsTable(cur)}\n\nPREVIOUS period:\n${statsTable(prev)}\n\nTREND (oldest → newest):\n${trendLines(trend)}`
  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: input },
  ]
  const raw = await orChat(messages, env.modelIngest(), false, 800)
  const out = raw.trim().replace(/^```(?:markdown)?\s*/i, '').replace(/```$/, '').trim()
  if (!out) throw new Error('empty comparison from model')
  return out
}

/**
 * Pure-code fallback: the same bullets WITHOUT the AI — exact deltas (via
 * periodDelta) + the trend series read in order + one direction bullet.
 * Non-finite values render as '∞', never NaN.
 */
export function renderComparisonFallback(prev: PeriodStats, cur: PeriodStats, trend: TrendPoint[]): string {
  const lines: string[] = []
  for (const d of periodDelta(prev, cur)) {
    if (d.field === 'winRate') {
      // winRate renders in percent everywhere; the delta is in percentage
      // points (pp) and the trailing figure is the relative change (%).
      lines.push(`- winRate: ${formatPct(d.cur)} vs ${formatPct(d.prev)} (${signed(d.delta * 100)}pp · ${formatPct(d.pct)})`)
    } else {
      lines.push(`- ${d.field}: ${formatNum(d.cur)} vs ${formatNum(d.prev)} (${signed(d.delta)}, ${formatPct(d.pct)})`)
    }
  }
  if (trend.length > 0) {
    lines.push('')
    lines.push('trend:')
    for (const p of trend) {
      lines.push(`- ${p.label}: sumR ${formatNum(p.sumR)} | winRate ${formatPct(p.winRate)} | trades ${formatNum(p.trades)}`)
    }
    const first = trend[0].sumR
    const last = trend[trend.length - 1].sumR
    const dir = last > first ? 'up' : last < first ? 'down' : 'flat'
    lines.push(`- trend: ${dir} (${formatNum(first)} → ${formatNum(last)})`)
  }
  return lines.join('\n')
}
