import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CONTENT } from './paths'

export interface NewsItem {
  time: string
  currency: string
  title: string
  source?: 'TV' | 'FF'
  verified?: boolean
}

export interface MarketNewsDay {
  date: string
  verified: boolean
  cachedAt?: string
  red: NewsItem[]
  orange: NewsItem[]
}

const DIR = path.join(CONTENT, 'market-news')

export function newsForDate(date: string): MarketNewsDay | null {
  const full = path.join(DIR, `${date}.md`)
  if (!fs.existsSync(full)) return null
  const m = matter(fs.readFileSync(full, 'utf8'))
  const data = m.data as Record<string, unknown>
  return {
    date,
    verified: data.verified === true,
    cachedAt: typeof data.cachedAt === 'string' ? data.cachedAt : undefined,
    red: (Array.isArray(data.red) ? data.red : []) as NewsItem[],
    orange: (Array.isArray(data.orange) ? data.orange : []) as NewsItem[],
  }
}

export function listNewsDates(): string[] {
  if (!fs.existsSync(DIR)) return []
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort()
    .reverse()
}

export function writeNews(day: MarketNewsDay) {
  fs.mkdirSync(DIR, { recursive: true })
  const body = ''
  const out = matter.stringify(body, {
    date: day.date,
    verified: day.verified,
    cachedAt: day.cachedAt ?? new Date().toISOString(),
    red: day.red,
    orange: day.orange,
  })
  fs.writeFileSync(path.join(DIR, `${day.date}.md`), out)
}

/** Relevant emoji for a news title (e.g. 🛢️ crude oil, 🛒 inflation/CPI). */
const EMOJI_RULES: [RegExp, string][] = [
  [/inflation|cpi|ppi|deflator|price index|core/i, '🛒'],
  [/crude|oil|gasoline|eia|api|natural gas|ng stocks/i, '🛢️'],
  [/payroll|nonfarm|employment change|jobless|claims|jolts/i, '💼'],
  [/unemployment rate/i, '👥'],
  [/fed|fomc|powell|speech|speaks|testimon/i, '🗣️'],
  [/gdp|industrial/i, '🏭'],
  [/retail sales|consumer spending|household/i, '🛍️'],
  [/housing|home sales|building permits|mortgage|naHB/i, '🏠'],
  [/pmi|ism|manufacturing|services/i, '🏭'],
  [/sentiment|uom|u\. of m|confidence/i, '💬'],
  [/treasury|auction|budget|debt/i, '🏦'],
  [/trade|import|export|balance/i, '⚖️'],
  [/income|spending|savings|earnings/i, '💵'],
  [/participation rate/i, '👥'],
]

const EMOJI_FALLBACK = '📰'

export function newsEmoji(title: string): string {
  for (const [re, emoji] of EMOJI_RULES) {
    if (re.test(title)) return emoji
  }
  return EMOJI_FALLBACK
}

export interface NewsGroup {
  time: string
  kind: 'red' | 'orange'
  title: string
  source?: 'TV' | 'FF'
  verified?: boolean
  rest: (NewsItem & { kind: 'red' | 'orange' })[]
}

/** Per unique HKT time: the most important event (first red, else first orange) + the rest. */
export function groupNewsHeadlines(red: NewsItem[], orange: NewsItem[]): NewsGroup[] {
  const byTime = new Map<string, (NewsItem & { kind: 'red' | 'orange' })[]>()
  for (const n of [
    ...red.map((r) => ({ ...r, kind: 'red' as const })),
    ...orange.map((o) => ({ ...o, kind: 'orange' as const })),
  ]) {
    const arr = byTime.get(n.time) ?? []
    arr.push(n)
    byTime.set(n.time, arr)
  }
  return [...byTime.keys()]
    .sort()
    .map((t) => {
      const all = byTime.get(t)!
      const rep = all.find((n) => n.kind === 'red') ?? all[0]
      return {
        time: t,
        kind: rep.kind,
        title: rep.title,
        source: rep.source,
        verified: rep.verified,
        rest: all.filter((n) => n !== rep),
      }
    })
}

/** Collapse consecutive events that share the same HKT time into one row. */
export function groupNewsByTime(items: NewsItem[]): { time: string; titles: string[] }[] {
  const out: { time: string; titles: string[] }[] = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (last && last.time === it.time) last.titles.push(it.title)
    else out.push({ time: it.time, titles: [it.title] })
  }
  return out
}

export interface NewsHeadline {
  time: string
  title: string
  kind: 'red' | 'orange'
}

/** First red (else orange) event — the summary line, never the word "red". */
export function newsHeadline(red: NewsItem[], orange: NewsItem[]): NewsHeadline | null {
  const r = red[0]
  if (r) return { time: r.time, title: r.title, kind: 'red' }
  const o = orange[0]
  if (o) return { time: o.time, title: o.title, kind: 'orange' }
  return null
}
