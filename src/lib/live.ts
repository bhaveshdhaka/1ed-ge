import fs from 'node:fs'

const LIVE_FILE = '/tmp/1edge-live.json'

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
  try {
    const raw = JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8')) as { at?: string }
    const at = raw.at ?? null
    if (!at) return { at: null, live: false, lastMsgMins: null }
    const mins = Math.max(0, Math.round((now - Date.parse(at)) / 60000))
    return { at, live: mins <= LIVE_WINDOW_MIN, lastMsgMins: mins }
  } catch {
    return { at: null, live: false, lastMsgMins: null }
  }
}

/** Record a heartbeat (admin calls this on a timer while active). */
export function touchLive(now = new Date()) {
  try {
    fs.writeFileSync(LIVE_FILE, JSON.stringify({ at: now.toISOString() }))
  } catch {}
}
