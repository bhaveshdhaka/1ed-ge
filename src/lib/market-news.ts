import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CONTENT } from './content'

export interface NewsItem {
  time: string
  currency: string
  title: string
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
