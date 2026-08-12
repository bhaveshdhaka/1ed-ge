import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './paths'

// Heartbeat lives in data/ (bind-mounted, persists across container restarts).
const LIVE_FILE = path.join(DATA_DIR, 'live.json')

export interface LiveState {
  at: string | null
  live: boolean
  lastMsgMins: number | null
}

const LIVE_WINDOW_MIN = 5

/**
 * Read the admin heartbeat. Returns live=true when a heartbeat was recorded
 * within LIVE_WINDOW_MIN. Public SSR routes (/stream, /) call this per request.
 */
export function readLiveState(now = Date.now()): LiveState {
  let at: string | null = null
  try {
    const raw = JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8')) as { at?: string }
    at = raw.at ?? null
  } catch {
    at = null
  }
  const mins = at ? Math.max(0, Math.round((now - Date.parse(at)) / 60000)) : null
  return {
    at,
    live: mins !== null && mins <= LIVE_WINDOW_MIN,
    lastMsgMins: mins,
  }
}

/** Record a heartbeat (admin calls this on a timer while active). */
export function touchLive(now = new Date()) {
  const iso = now.toISOString()
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(LIVE_FILE, JSON.stringify({ at: iso }))
  } catch {}
}
