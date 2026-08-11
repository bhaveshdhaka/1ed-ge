import path from 'node:path'
import type { APIRoute } from 'astro'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { requireSession, json, error } from '../../../lib/auth'
import { ROOT } from '../../../lib/content'
import { getPending, clearPending, getRebuilds, pushRebuild, acquireBuildLock, releaseBuildLock, setBuildLockPid } from '../../../lib/changes'

export const prerender = false

const STATUS_FILE = path.join(process.cwd(), 'data', 'build.json')
// A build that started more than this long ago but still claims `running` is
// stuck (crashed build, container restart mid-build) — clear it and proceed.
const STALE_MS = 10 * 60 * 1000

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
  // Fresh `running` flag → a build is genuinely in flight → busy.
  if (cur?.running && typeof cur.startedAt === 'number' && Date.now() - cur.startedAt < STALE_MS) {
    return json({ ok: true, running: true })
  }
  // Stale flag (crashed build / container restart / sync spawn failure left
  // `running` stuck) → clear it and fall through.
  if (cur?.running) {
    setStatus({ running: false, ok: false, finishedAt: Date.now(), error: 'stale build flag cleared' })
  }
  // File lock — the hard guard against two concurrent builds racing on
  // node_modules/.astro (the /tmp flag alone can be lost on restart).
  if (!acquireBuildLock()) return json({ ok: true, running: true })

  const snapshot = getPending().map((c) => c.label)
  setStatus({ running: true, startedAt: Date.now(), ok: null, finishedAt: null })
  let child: ReturnType<typeof spawn>
  try {
    child = spawn('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore', detached: true })
  } catch {
    // synchronous spawn failure (e.g. ENOENT npm) — never leave the flag/lock stuck
    releaseBuildLock()
    setStatus({ running: false, ok: false, finishedAt: Date.now(), error: 'spawn failed' })
    pushRebuild({ at: new Date().toISOString(), ok: false, applied: [], error: 'spawn failed' })
    return json({ ok: true, running: true })
  }
  child.unref()
  // The detached builder outlives this server — the lock must track it, not us.
  setBuildLockPid(child.pid ?? process.pid)
  child.on('exit', (code) => {
    const ok = code === 0
    setStatus({ running: false, ok, finishedAt: Date.now() })
    if (ok) clearPending()
    pushRebuild({ at: new Date().toISOString(), ok, applied: ok ? snapshot : [] })
    releaseBuildLock()
  })
  child.on('error', () => {
    setStatus({ running: false, ok: false, finishedAt: Date.now(), error: 'spawn failed' })
    pushRebuild({ at: new Date().toISOString(), ok: false, applied: [], error: 'spawn failed' })
    releaseBuildLock()
  })
  return json({ ok: true, running: true })
}
