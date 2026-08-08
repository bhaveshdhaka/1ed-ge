import fs from 'node:fs'
import path from 'node:path'

const LIVE_FILE = '/tmp/1edge-live.json'
// Durable last-online stamp. public/media/ is bind-mounted from the host, so
// this survives container restarts (the /tmp heartbeat file resets and would
// otherwise make "last seen" lie). Gitignored; holds an ISO timestamp.
const LAST_ONLINE_FILE = path.join(process.cwd(), 'public/media/.last-online')

export interface LiveState {
  at: string | null
  live: boolean
  lastMsgMins: number | null
  /** Durable ISO timestamp of the last heartbeat — survives container restarts. */
  lastOnlineIso: string | null
}

const LIVE_WINDOW_MIN = 5

function readDurableStamp(): string | null {
  try {
    const raw = fs.readFileSync(LAST_ONLINE_FILE, 'utf8').trim()
    return raw || null
  } catch {
    return null
  }
}

/**
 * Read the admin heartbeat. Returns live=true when a heartbeat was recorded
 * within LIVE_WINDOW_MIN. Public SSR routes (/stream, /) call this per request.
 * `lastOnlineIso` comes from the durable stamp, so it survives restarts.
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
    lastOnlineIso: readDurableStamp(),
  }
}

/** Record a heartbeat (admin calls this on a timer while active). Also writes
 * the durable last-online stamp so the homepage's "last seen" survives restarts. */
export function touchLive(now = new Date()) {
  const iso = now.toISOString()
  try {
    fs.writeFileSync(LIVE_FILE, JSON.stringify({ at: iso }))
  } catch {}
  try {
    fs.writeFileSync(LAST_ONLINE_FILE, iso)
  } catch {}
}
