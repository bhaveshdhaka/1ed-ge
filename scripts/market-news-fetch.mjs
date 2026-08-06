#!/usr/bin/env node
// Fetch USD economic events (red = high, orange = medium) and write
// src/content/market-news/<hkt-date>.md files. Deterministic — no AI.
//
// Primary: TradingView economic calendar (importance 1 -> red, 0 -> orange).
// Secondary: Faireconomy (FF) this-week calendar. An event is "verified" when
// the other source also has an event in the same ±2 min UTC bucket.
//
// Usage: node scripts/market-news-fetch.mjs [--no-build]
//   --no-build skips `npm run build` (admin refresh runs the build itself).

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'src/content', 'market-news')

const HKT_OFFSET = 8 * 3600 * 1000
const DAY = 86400000
const VERIFY_WINDOW_MS = 2 * 60000
const KEEP_DAYS = 14

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
const TV_HEADERS = {
  Origin: 'https://in.tradingview.com',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
}

const pad = (n) => String(n).padStart(2, '0')
const isoDay = (ms) => new Date(ms + HKT_OFFSET).toISOString().slice(0, 10)
const hktTime = (ms) => new Date(ms + HKT_OFFSET).toISOString().slice(11, 16)
const yq = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

function toUtcMs(dateStr) {
  const ms = Date.parse(dateStr)
  return Number.isFinite(ms) ? ms : null
}

async function fetchTradingView(from, to) {
  const url = `https://economic-calendar.tradingview.com/events?from=${new Date(from).toISOString()}&to=${new Date(to).toISOString()}`
  const res = await fetchJson(url, { headers: TV_HEADERS })
  const list = res?.result ?? []
  const out = []
  for (const e of list) {
    if (e.currency !== 'USD') continue
    if (e.importance !== 1 && e.importance !== 0) continue
    const ms = toUtcMs(e.date)
    if (ms === null) continue
    out.push({ ms, level: e.importance === 1 ? 'red' : 'orange', title: String(e.title ?? '').trim(), src: 'tv' })
  }
  return out
}

async function fetchFaireconomy() {
  const list = await fetchJson(FF_URL)
  const out = []
  for (const e of list) {
    if (e.country !== 'USD') continue
    if (e.impact !== 'High' && e.impact !== 'Medium') continue
    const ms = toUtcMs(e.date)
    if (ms === null) continue
    out.push({ ms, level: e.impact === 'High' ? 'red' : 'orange', title: String(e.title ?? '').trim(), src: 'ff' })
  }
  return out
}

function merge(tv, ff) {
  // Zero-inference: every event displays verbatim from its own source, labeled.
  // The other source only contributes a "verified" badge (same ±2min UTC slot).
  const near = (a, b) => Math.abs(a.ms - b.ms) <= VERIFY_WINDOW_MS
  const tvRows = tv.map((e) => ({ ms: e.ms, level: e.level, title: e.title, source: 'TV', verified: ff.some((f) => near(f, e)) }))
  const ffRows = ff.map((e) => ({ ms: e.ms, level: e.level, title: e.title, source: 'FF', verified: tv.some((t) => near(t, e)) }))
  return [...tvRows, ...ffRows]
}

function writeDays(merged, cachedAt) {
  const byDay = new Map()
  for (const e of merged) {
    const day = isoDay(e.ms)
    if (!byDay.has(day)) byDay.set(day, { red: [], orange: [], anyVerified: false })
    const bucket = byDay.get(day)
    bucket[e.level].push({ time: hktTime(e.ms), currency: 'USD', title: e.title, source: e.source, verified: e.verified })
    if (e.verified) bucket.anyVerified = true
  }

  fs.mkdirSync(OUT, { recursive: true })
  const byTime = (a, b) => a.time.localeCompare(b.time)
  let written = 0
  for (const [day, b] of [...byDay.entries()].sort()) {
    const red = b.red.sort(byTime)
    const orange = b.orange.sort(byTime)
    const lines = ['---', `date: ${yq(day)}`, `verified: ${b.anyVerified}`, `cachedAt: ${yq(cachedAt)}`]
    for (const [key, list] of [['red', red], ['orange', orange]]) {
      if (list.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const ev of list) {
          lines.push(`  - time: ${yq(ev.time)}\n    title: ${yq(ev.title)}\n    source: ${yq(ev.source)}\n    verified: ${ev.verified ? 'true' : 'false'}`)
        }
      }
    }
    lines.push('---', '')
    fs.writeFileSync(path.join(OUT, `${day}.md`), lines.join('\n'))
    written++
  }

  const cutoff = isoDay(Date.now() - KEEP_DAYS * DAY)
  let pruned = 0
  for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith('.md')) continue
    const d = f.slice(0, 10)
    if (d && d < cutoff) {
      fs.unlinkSync(path.join(OUT, f))
      pruned++
    }
  }
  return { written, pruned }
}

async function main() {
  const noBuild = process.argv.includes('--no-build')
  const now = Date.now()
  const from = now - DAY
  const to = now + 8 * DAY

  const errors = []
  let tv = []
  let ff = []
  try {
    tv = await fetchTradingView(from, to)
  } catch (err) {
    errors.push(`tradingview: ${err.message}`)
  }
  try {
    ff = await fetchFaireconomy()
  } catch (err) {
    errors.push(`faireconomy: ${err.message}`)
  }

  const merged = merge(tv, ff)
  const cachedAt = new Date().toISOString()
  const { written, pruned } = writeDays(merged, cachedAt)

  const red = merged.filter((e) => e.level === 'red')
  const verified = merged.filter((e) => e.verified)
  console.log(
    `market-news: ${tv.length} tv + ${ff.length} ff -> ${merged.length} events (${red.length} red, ${verified.length} verified), ${written} day file(s), ${pruned} pruned`,
  )
  for (const err of errors) console.error(`market-news warn: ${err}`)
  const unverified = merged.filter((e) => !e.verified)
  if (unverified.length) {
    console.error(`market-news: ${unverified.length} unverified (single source):`)
    for (const e of unverified) console.error(`  ${e.source} ${isoDay(e.ms)} ${hktTime(e.ms)} ${e.level} ${e.title}`)
  }

  if (!noBuild) {
    try {
      execSync('npm run build', { cwd: ROOT, stdio: 'ignore', timeout: 180000 })
      console.log('market-news: build ok')
    } catch {
      console.error('market-news: build failed')
      process.exitCode = 1
    }
  }
}

main()
