import type { DayEntry } from './stats'
import { flatten, type AccountEntry, type ExecutionRow } from './stats'
import { round2 } from './utils'

export interface DayStat {
  date: string
  trades: number
  wins: number
  sumR: number
  sumPnl: number
  winRate: number | null
  mood?: number
  sleepHours?: number
  habitsDone?: number
}

export interface TrendSnapshot {
  generatedAt: string
  windows: {
    label: string
    days: number
    trades: number
    winRate: number | null
    sumR: number
    avgR: number
    expectancy: number
    tradesPerDay: number
    sumPnl: number
  }[]
  months: { month: string; trades: number; sumR: number; sumPnl: number; winRate: number | null }[]
  correlations: {
    sleep: { key: string; trades: number; sumR: number; avgR: number; winRate: number | null }[]
    mood: { bucket: string; days: number; trades: number; sumR: number; avgR: number; winRate: number | null }[]
    habits: { bucket: string; days: number; trades: number; sumR: number; avgR: number; winRate: number | null }[]
    screen: { bucket: string; days: number; trades: number; sumR: number; avgR: number; winRate: number | null }[]
    session: { key: string; trades: number; sumR: number; avgR: number; winRate: number | null }[]
    setup: { key: string; trades: number; sumR: number; avgR: number; winRate: number | null }[]
  }
  flags: string[]
}

function bucketStat(days: DayStat[], tradesByDay: Map<string, ExecutionRow[]>, buckets: string[]) {
  const map = new Map<string, { days: number; trades: number; sumR: number; wins: number }>()
  for (const b of buckets) map.set(b, { days: 0, trades: 0, sumR: 0, wins: 0 })
  for (const d of days) {
    const key = d.mood === undefined ? 'n/a' : d.mood <= 2 ? '1-2 (low)' : d.mood === 3 ? '3 (neutral)' : '4-5 (high)'
    const e = map.get(key)
    if (!e) continue
    const list = tradesByDay.get(d.date) ?? []
    e.days++
    e.trades += list.length
    e.sumR += list.reduce((s, t) => s + t.R, 0)
    e.wins += list.filter((t) => t.win).length
  }
  return [...map.entries()].map(([bucket, v]) => ({
    bucket,
    days: v.days,
    trades: v.trades,
    sumR: round2(v.sumR),
    avgR: v.trades ? round2(v.sumR / v.trades) : 0,
    winRate: v.trades ? round2((v.wins / v.trades) * 100) : null,
  }))
}

export function buildTrends(days: DayEntry[], accounts: AccountEntry[]): TrendSnapshot {
  const { executions, trades } = flatten(days, accounts)
  const tradesByDay = new Map<string, ExecutionRow[]>()
  for (const ex of executions) {
    if (!tradesByDay.has(ex.day)) tradesByDay.set(ex.day, [])
    tradesByDay.get(ex.day)!.push(ex)
  }

  const dayStats: DayStat[] = [...days]
    .sort((a, b) => a.data.date.localeCompare(b.data.date))
    .map((d) => {
      const list = tradesByDay.get(d.data.date) ?? []
      const wins = list.filter((t) => t.win).length
      const sumR = list.reduce((s, t) => s + t.R, 0)
      const sumPnl = list.reduce((s, t) => s + t.pnl, 0)
      const habitsDone = d.data.habits ? Object.values(d.data.habits).filter(Boolean).length : undefined
      return {
        date: d.data.date,
        trades: list.length,
        wins,
        sumR: round2(sumR),
        sumPnl: round2(sumPnl),
        winRate: list.length ? round2((wins / list.length) * 100) : null,
        mood: d.data.mood,
        sleepHours: d.data.sleep?.hours,
        habitsDone,
      }
    })

  const windowStat = (label: string, daysBack: number) => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - daysBack)
    const cutoffKey = cutoff.toISOString().slice(0, 10)
    const inWin = dayStats.filter((d) => d.date >= cutoffKey)
    const n = inWin.length
    const tradesN = inWin.reduce((s, d) => s + d.trades, 0)
    const wins = inWin.reduce((s, d) => s + d.wins, 0)
    const sumR = inWin.reduce((s, d) => s + d.sumR, 0)
    const sumPnl = inWin.reduce((s, d) => s + d.sumPnl, 0)
    return {
      label,
      days: n,
      trades: tradesN,
      winRate: tradesN ? round2((wins / tradesN) * 100) : null,
      sumR: round2(sumR),
      avgR: tradesN ? round2(sumR / tradesN) : 0,
      expectancy: tradesN ? round2(sumR / tradesN) : 0,
      tradesPerDay: n ? round2(tradesN / n) : 0,
      sumPnl: round2(sumPnl),
    }
  }

  const monthMap = new Map<string, { trades: number; sumR: number; sumPnl: number; wins: number }>()
  for (const d of dayStats) {
    const key = d.date.slice(0, 7)
    if (!monthMap.has(key)) monthMap.set(key, { trades: 0, sumR: 0, sumPnl: 0, wins: 0 })
    const e = monthMap.get(key)!
    e.trades += d.trades
    e.sumR += d.sumR
    e.sumPnl += d.sumPnl
    e.wins += d.wins
  }
  const months = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      trades: v.trades,
      sumR: round2(v.sumR),
      sumPnl: round2(v.sumPnl),
      winRate: v.trades ? round2((v.wins / v.trades) * 100) : null,
    }))

  const byKey = (rows: ExecutionRow[], key: (t: ExecutionRow) => string | undefined) => {
    const m = new Map<string, { trades: number; sumR: number; wins: number }>()
    for (const t of rows) {
      const k = key(t)
      if (!k) continue
      if (!m.has(k)) m.set(k, { trades: 0, sumR: 0, wins: 0 })
      const e = m.get(k)!
      e.trades++
      e.sumR += t.R
      if (t.win) e.wins++
    }
    return [...m.entries()]
      .map(([key, v]) => ({
        key,
        trades: v.trades,
        sumR: round2(v.sumR),
        avgR: round2(v.sumR / v.trades),
        winRate: round2((v.wins / v.trades) * 100),
      }))
      .filter((x) => x.trades >= 1)
      .sort((a, b) => b.sumR - a.sumR)
  }

  const sleepBucket = (t: ExecutionRow) => {
    const d = dayStats.find((x) => x.date === t.day)
    const h = d?.sleepHours
    if (h === undefined) return undefined
    return h < 6 ? 'sleep <6h' : h < 7 ? 'sleep 6-7h' : 'sleep 7h+'
  }

  const screenByDay = new Map<string, number>()
  for (const d of days) {
    const h = d.data.device?.iphoneHours
    if (h !== undefined) screenByDay.set(d.data.date, h)
  }
  const screenBuckets = ['screen <3h', 'screen 3-5h', 'screen 5h+']
  const screenCorr: { bucket: string; days: number; trades: number; sumR: number; wins: number }[] =
    screenBuckets.map((b) => ({ bucket: b, days: 0, trades: 0, sumR: 0, wins: 0 }))
  for (const d of dayStats) {
    const h = screenByDay.get(d.date)
    if (h === undefined) continue
    const bucket = h < 3 ? 'screen <3h' : h < 5 ? 'screen 3-5h' : 'screen 5h+'
    const e = screenCorr.find((x) => x.bucket === bucket)!
    const list = tradesByDay.get(d.date) ?? []
    e.days++
    e.trades += list.length
    e.sumR += list.reduce((s, t) => s + t.R, 0)
    e.wins += list.filter((t) => t.win).length
  }
  const screen = screenCorr
    .map((v) => ({
      bucket: v.bucket,
      days: v.days,
      trades: v.trades,
      sumR: round2(v.sumR),
      avgR: v.trades ? round2(v.sumR / v.trades) : 0,
      winRate: v.trades ? round2((v.wins / v.trades) * 100) : null,
    }))
    .filter((x) => x.days > 0)

  const flags: string[] = []
  const overtrade = dayStats.find((d) => d.trades >= 6 && d.sumR < 0)
  if (overtrade) flags.push(`overtrading flag: ${overtrade.date} had ${overtrade.trades} trades for ${overtrade.sumR}R (negative).`)
  const bestSession = byKey(trades, (t) => t.session)[0]
  if (bestSession) flags.push(`best session: ${bestSession.key} (${bestSession.avgR}R avg over ${bestSession.trades}).`)
  const worstSession = [...byKey(trades, (t) => t.session)].at(-1)
  if (worstSession && worstSession.avgR < 0)
    flags.push(`worst session: ${worstSession.key} (${worstSession.avgR}R avg over ${worstSession.trades}).`)
  const lowMood = bucketStat(dayStats, tradesByDay, ['1-2 (low)', '3 (neutral)', '4-5 (high)'])[0]
  if (lowMood && lowMood.trades >= 5 && lowMood.avgR < 0)
    flags.push(`low-mood days are negative: ${lowMood.avgR}R avg across ${lowMood.trades} trades.`)
  if (!dayStats.some((d) => d.mood !== undefined))
    flags.push('no mood data yet — start logging mood daily for signal.')
  const hiScreen = screen.find((x) => x.bucket === 'screen 5h+' && x.trades >= 5 && x.avgR < 0)
  if (hiScreen)
    flags.push(`heavy screen-time days are negative: ${hiScreen.avgR}R avg across ${hiScreen.trades} trades.`)
  if (!dayStats.some((d) => screenByDay.has(d.date)))
    flags.push('no screen-time data yet — paste your Screen Time screenshot daily for signal.')

  return {
    generatedAt: new Date().toISOString(),
    windows: [windowStat('7d', 7), windowStat('30d', 30), windowStat('90d', 90)],
    months,
    correlations: {
      sleep: byKey(trades, sleepBucket),
      mood: bucketStat(dayStats, tradesByDay, ['1-2 (low)', '3 (neutral)', '4-5 (high)']),
      screen,
      habits: (() => {
        const map = new Map<string, { days: number; trades: number; sumR: number; wins: number }>()
        for (const d of dayStats) {
          const h = d.habitsDone
          if (h === undefined) continue
          const key = h <= 2 ? '0-2 habits' : h <= 4 ? '3-4 habits' : '5-6 habits'
          if (!map.has(key)) map.set(key, { days: 0, trades: 0, sumR: 0, wins: 0 })
          const e = map.get(key)!
          const list = tradesByDay.get(d.date) ?? []
          e.days++
          e.trades += list.length
          e.sumR += list.reduce((s, t) => s + t.R, 0)
          e.wins += list.filter((t) => t.win).length
        }
        return [...map.entries()].map(([bucket, v]) => ({
          bucket,
          days: v.days,
          trades: v.trades,
          sumR: round2(v.sumR),
          avgR: v.trades ? round2(v.sumR / v.trades) : 0,
          winRate: v.trades ? round2((v.wins / v.trades) * 100) : null,
        }))
      })(),
      session: byKey(trades, (t) => t.session),
      setup: byKey(trades, (t) => t.setup),
    },
    flags,
  }
}

export function trendsForLLM(s: TrendSnapshot): string {
  const w = s.windows
    .map((x) => `${x.label}: ${x.trades} trades, ${x.winRate ?? '—'}% WR, ${x.sumR}R, ${x.avgR}R avg, ${x.tradesPerDay}/day`)
    .join('\n')
  const corr = (title: string, rows: { bucket?: string; key?: string; trades: number; avgR: number; winRate: number | null }[]) => {
    if (!rows.length) return `${title}: no data`
    return `${title}: ${rows
      .map((r) => `${r.bucket ?? r.key} → ${r.avgR}R avg (${r.trades} trades, ${r.winRate ?? '—'}% WR)`)
      .join(' · ')}`
  }
  return [
    `— last 90d —`,
    w,
    corr('by sleep', s.correlations.sleep),
    corr('by mood', s.correlations.mood),
    corr('by habits done', s.correlations.habits),
    corr('by screen time', s.correlations.screen),
    corr('by session', s.correlations.session),
    corr('by setup', s.correlations.setup),
    s.flags.length ? `— observations —\n${s.flags.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
