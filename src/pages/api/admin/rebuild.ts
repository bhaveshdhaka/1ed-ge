import type { APIRoute } from 'astro'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { requireSession, json, error } from '../../../lib/auth'
import { ROOT } from '../../../lib/content'
import { getPending, clearPending, getRebuilds, pushRebuild } from '../../../lib/changes'

export const prerender = false

const STATUS_FILE = '/tmp/1edge-build.json'

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

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  return json({ ok: true, build: getStatus(), pending: getPending(), rebuilds: getRebuilds() })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const cur = getStatus()
  if (cur?.running) return json({ ok: true, running: true })

  const snapshot = getPending().map((c) => c.label)
  setStatus({ running: true, startedAt: Date.now(), ok: null, finishedAt: null })
  const child = spawn('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore', detached: true })
  child.unref()
  child.on('exit', (code) => {
    const ok = code === 0
    setStatus({ running: false, ok, finishedAt: Date.now() })
    if (ok) clearPending()
    pushRebuild({ at: new Date().toISOString(), ok, applied: ok ? snapshot : [] })
  })
  child.on('error', () => {
    setStatus({ running: false, ok: false, finishedAt: Date.now(), error: 'spawn failed' })
    pushRebuild({ at: new Date().toISOString(), ok: false, applied: [], error: 'spawn failed' })
  })
  return json({ ok: true, running: true })
}
