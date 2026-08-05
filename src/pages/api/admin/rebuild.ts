import type { APIRoute } from 'astro'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { authorized, json, error } from '../../../lib/auth'
import { ROOT } from '../../../lib/content'

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
  if (!authorized(request)) return error('unauthorized', 401)
  return json({ ok: true, build: getStatus() })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const cur = getStatus()
  if (cur?.running) return json({ ok: true, running: true })

  setStatus({ running: true, startedAt: Date.now(), ok: null, finishedAt: null })
  const child = spawn('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore', detached: true })
  child.unref()
  child.on('exit', (code) => {
    setStatus({ running: false, ok: code === 0, finishedAt: Date.now() })
  })
  child.on('error', () => {
    setStatus({ running: false, ok: false, finishedAt: Date.now(), error: 'spawn failed' })
  })
  return json({ ok: true, running: true })
}
