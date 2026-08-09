import type { CollectionEntry } from 'astro:content'
import { ROf } from './stream'

export interface ModelTradeRow {
  iso: string
  market: string
  direction: 'long' | 'short'
  session?: string
  setup?: string
  entry: number
  exit: number
  stop?: number
  points: number
  R: number
  note?: string
}

export interface ModelStat {
  slug: string
  name: string
  premise?: string
  status: 'active' | 'paused' | 'retired'
  order: number
  rules: string[]
  trades: ModelTradeRow[]
  count: number
  sumR: number
  avgR: number
  winRate: number // 0..1
  bestR: number
  worstR: number
  lastIso: string | null
}

type DayEntry = CollectionEntry<'days'>
type ModelEntry = CollectionEntry<'models'>

export function buildModelStats(days: DayEntry[], models: ModelEntry[]): ModelStat[] {
  return models
    .map((m) => {
      const rows: ModelTradeRow[] = []
      for (const day of days) {
        for (const t of day.data.trades ?? []) {
          const models = t.models ?? (t.model ? [t.model] : [])
          if (!models.includes(m.id)) continue
          rows.push({
            iso: day.data.date,
            market: t.market ?? 'MNQ',
            direction: t.direction,
            session: t.session,
            setup: t.setup,
            entry: t.entry,
            exit: t.exit,
            stop: t.stop,
            points: t.points,
            R: ROf(t),
            note: t.note,
          })
        }
      }
      const count = rows.length
      const sumR = rows.reduce((s, r) => s + r.R, 0)
      const wins = rows.filter((r) => r.R > 0).length
      const be = rows.filter((r) => r.R === 0).length
      return {
        slug: m.id,
        name: m.data.name ?? m.id,
        premise: m.data.premise,
        status: m.data.status ?? 'active',
        order: m.data.order ?? 0,
        rules: m.data.rules ?? [],
        trades: rows,
        count,
        sumR,
        avgR: count > 0 ? sumR / count : 0,
        // Break-even (R === 0) is excluded from the denominator.
        winRate: count - be > 0 ? wins / (count - be) : 0,
        bestR: count > 0 ? Math.max(...rows.map((r) => r.R)) : 0,
        worstR: count > 0 ? Math.min(...rows.map((r) => r.R)) : 0,
        lastIso: count > 0 ? rows[rows.length - 1].iso : null,
      }
    })
    .sort((a, b) => a.order - b.order)
}
