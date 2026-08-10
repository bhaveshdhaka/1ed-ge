import type { APIRoute } from 'astro'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { requireSession, json, error } from '../../../lib/auth'
import { ROOT } from '../../../lib/content'
import { newsForDate, listNewsDates } from '../../../lib/market-news'
import { cmeToday } from '../../../lib/sessions'

export const prerender = false

const STATUS_FILE = '/tmp/1edge-market.json'

function setStatus(s: unknown) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(s))
  } catch {}
}
function getStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
  } catch {
    return null
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const date = url.searchParams.get('date') ?? cmeToday()
  return json({
    ok: true,
    today: cmeToday(),
    news: newsForDate(date),
    dates: listNewsDates().slice(0, 14),
    refresh: getStatus(),
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const cur = getStatus()
  if (cur?.running) return json({ ok: true, running: true })
  setStatus({ running: true, startedAt: Date.now(), ok: null, finishedAt: null, error: null })
  const child = spawn('node', ['scripts/market-news-fetch.mjs'], { cwd: ROOT, stdio: 'ignore', detached: true })
  child.unref()
  child.on('exit', (code) => {
    setStatus({ running: false, ok: code === 0, finishedAt: Date.now(), error: code === 0 ? null : `exit ${code}` })
  })
  child.on('error', (err) => {
    setStatus({ running: false, ok: false, finishedAt: Date.now(), error: err.message })
  })
  return json({ ok: true, running: true })
}
