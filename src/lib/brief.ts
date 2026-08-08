import { readEntry, writeEntry } from './content'
import { daySessionWindows, marketEvents, addDaysIso } from './sessions'
import { newsForDate, groupNewsByTime } from './market-news'

/** Deterministic pre-market data snapshot for the AI to write prose about. Numbers only, never generated. */
export function buildBriefSnapshot(date: string): string {
  const parts: string[] = []
  const wins = daySessionWindows(date)
  parts.push(`DATE (HKT): ${date}`)
  parts.push(
    `SESSIONS (HKT): New York ${wins.nyse} · Tokyo ${wins.tse} · London ${wins.lse} · CME Globex equity-index futures (mnq) ${wins.cme}`,
  )

  const news = newsForDate(date)
  if (news && (news.red.length > 0 || news.orange.length > 0)) {
    parts.push('USD NEWS (HKT):')
    for (const g of groupNewsByTime(news.red)) parts.push(`- RED ${g.time}: ${g.titles.join('; ')}`)
    for (const g of groupNewsByTime(news.orange)) parts.push(`- ORANGE ${g.time}: ${g.titles.join('; ')}`)
  } else {
    parts.push('USD NEWS (HKT): none major')
  }

  // the previous day record (fall back to the last day with a record)
  let prev = addDaysIso(date, -1)
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso(date, -i - 1)
    try {
      const d = readEntry('days', `${iso}.md`).data as Record<string, unknown>
      const trades = (Array.isArray(d.trades) ? d.trades : []) as { points: number; riskPoints?: number; stop?: number; entry: number }[]
      const sumR = trades.reduce((s, t) => s + (t.points / (t.riskPoints ?? (t.stop !== undefined ? Math.abs(t.entry - t.stop) : 1))), 0)
      parts.push(`MOST RECENT DAY (${iso}):`)
      parts.push(`- trades: ${trades.length}, cumulative R: ${sumR >= 0 ? '+' : ''}${sumR.toFixed(2)}`)
      if (d.mood) parts.push(`- mood: ${d.mood}/5`)
      const sleep = d.sleep as { hours?: number; quality?: number } | undefined
      if (sleep && sleep.hours !== undefined) parts.push(`- sleep: ${sleep.hours}h (quality ${sleep.quality ?? '?'}/5)`)
      break
    } catch {
      prev = iso
    }
  }

  return parts.join('\n')
}

export function readBrief(date: string): { date: string; body: string } | null {
  try {
    const e = readEntry('brief', `${date}.md`)
    return { date, body: e.body }
  } catch {
    return null
  }
}

export function saveBrief(date: string, body: string) {
  writeEntry('brief', `${date}.md`, { date }, body)
}
