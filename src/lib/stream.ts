import { moodByValue, sleepByValue } from './emoji-states'

export type MomentType = 'trade' | 'note' | 'quote'

export interface StreamMoment {
  at: string
  type: MomentType
  text?: string
  tradeIdx?: number
  images?: string[]
  author?: string
}

export interface DayTrade {
  market: string
  session?: string
  direction: 'long' | 'short'
  setup?: string
  model?: string
  models?: string[]
  entry: number
  stop?: number
  target?: number
  exit: number
  riskPoints?: number
  points: number
  note?: string
  commentary?: string
  screenshots?: string[]
  executions?: { account: string; size?: number }[]
}

export interface DayData {
  date: string
  mood?: number
  sleep?: { hours?: number; quality?: number }
  habits?: Record<string, boolean | number>
  device?: {
    iphoneHours?: number
    socialHours?: number
    macHours?: number
    notes?: string
    screenshots?: string[]
  }
  trades: DayTrade[]
  stream: StreamMoment[]
}

export interface ResolvedMoment {
  iso: string
  at: string
  type: MomentType
  text?: string
  images?: string[]
  author?: string
  trade: {
    R: number
    direction: 'long' | 'short'
    market: string
    model?: string
    models?: string[]
    setup?: string
    session?: string
    points: number
    entry: number
    exit: number
    stop?: number
    note?: string
    screenshots?: string[]
  } | null
}

export function riskOf(t: DayTrade): number {
  return t.riskPoints ?? (t.stop !== undefined ? Math.abs(t.entry - t.stop) : 1)
}

export function ROf(t: DayTrade): number {
  const r = riskOf(t)
  return r > 0 ? t.points / r : 0
}

/** Order a day's published stream moments by time (earliest first). */
export function resolveMoments(d: DayData): ResolvedMoment[] {
  const sorted = [...(d.stream ?? [])].sort((a, b) => a.at.localeCompare(b.at))
  return sorted.map((m) => {
    const type: MomentType = m.type === 'quote' ? 'quote' : m.type === 'trade' ? 'trade' : 'note'
    const t = m.tradeIdx !== undefined ? d.trades[m.tradeIdx] : undefined
    return {
      iso: d.date,
      at: m.at,
      type,
      text: m.text,
      images: m.images,
      author: m.author,
      trade: t && type === 'trade'
        ? {
            R: ROf(t),
            direction: t.direction,
            market: t.market,
            model: t.model,
            models: t.models ?? (t.model ? [t.model] : []),
            setup: t.setup,
            session: t.session,
            points: t.points,
            entry: t.entry,
            exit: t.exit,
            stop: t.stop,
            note: t.note,
            screenshots: t.screenshots,
          }
        : null,
    }
  })
}

/** All published moments across days, newest day first, time desc within a day. */
export function flattenStream(days: DayData[]): ResolvedMoment[] {
  const out: ResolvedMoment[] = []
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date))
  for (const d of sorted) out.push(...resolveMoments(d).reverse())
  return out
}

export interface MomentMeta {
  glyph: string
  label: string
}

export function momentMeta(type: MomentType): MomentMeta {
  switch (type) {
    case 'trade':
      return { glyph: '▲', label: 'trade' }
    case 'note':
      return { glyph: '·', label: 'note' }
    case 'quote':
      return { glyph: '"', label: 'quote' }
  }
}

export interface FactCell {
  key: string
  label: string
  value: string
  ok: boolean
  up?: boolean
}

/** Facts strip: mood / sleep / screen / mac / habits / trades / R. */
export function dayFacts(d: DayData | null, habitTotal: number): FactCell[] {
  if (!d) return []
  const sumR = d.trades.reduce((s, t) => s + ROf(t), 0)
  const done = d.habits ? Object.values(d.habits).filter((v) => v === true || (typeof v === 'number' && v > 0)).length : 0
  const mood = moodByValue(d.mood)
  const sleepQ = sleepByValue(d.sleep?.quality)
  const hours = d.sleep?.hours
  return [
    { key: 'mood', label: 'mood', value: mood ? `${mood.emoji} ${mood.label}` : d.mood !== undefined ? `${d.mood}/5` : '—', ok: d.mood !== undefined },
    {
      key: 'sleep',
      label: 'sleep',
      value: sleepQ
        ? `${sleepQ.emoji} ${sleepQ.label}${hours !== undefined ? ` · ${hours}h` : ''}`
        : hours !== undefined
          ? `${hours}h`
          : '—',
      ok: hours !== undefined || d.sleep?.quality !== undefined,
    },
    {
      key: 'screen',
      label: 'screen',
      value: d.device?.iphoneHours !== undefined ? `${d.device.iphoneHours}h` : '—',
      ok: d.device?.iphoneHours !== undefined,
    },
    {
      key: 'mac',
      label: 'mac',
      value: d.device?.macHours !== undefined ? `${d.device.macHours}h` : '—',
      ok: d.device?.macHours !== undefined,
    },
    {
      key: 'habits',
      label: 'habits',
      value: habitTotal ? `${done}/${habitTotal}` : String(done),
      ok: habitTotal > 0,
    },
    { key: 'trades', label: 'trades', value: String(d.trades.length), ok: d.trades.length > 0 },
    {
      key: 'r',
      label: 'R',
      value: d.trades.length ? `${sumR > 0 ? '+' : ''}${sumR.toFixed(2)}R` : '—',
      ok: d.trades.length > 0,
      up: sumR > 0 ? true : sumR < 0 ? false : undefined,
    },
  ]
}
