import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const PENDING_FILE = path.join(DATA_DIR, 'pending.json')
const REBUILDS_FILE = path.join(DATA_DIR, 'rebuilds.json')
const BUILD_LOCK_FILE = path.join(DATA_DIR, 'build.lock')

export interface PendingChange {
  at: string
  kind: string
  label: string
  detail?: string
}

export interface RebuildRecord {
  at: string
  ok: boolean
  applied: string[]
  error?: string
}

export function getPending(): PendingChange[] {
  try {
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'))
  } catch {
    return []
  }
}

export function addChange(kind: string, label: string, detail?: string) {
  const list = getPending()
  list.push({ at: new Date().toISOString(), kind, label, detail })
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(PENDING_FILE, JSON.stringify(list.slice(-200)))
  } catch {}
}

export function clearPending() {
  try {
    fs.unlinkSync(PENDING_FILE)
  } catch {}
}

export function getRebuilds(): RebuildRecord[] {
  try {
    return JSON.parse(fs.readFileSync(REBUILDS_FILE, 'utf8'))
  } catch {
    return []
  }
}

export function pushRebuild(r: RebuildRecord) {
  const list = [r, ...getRebuilds()].slice(0, 10)
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(REBUILDS_FILE, JSON.stringify(list))
  } catch {}
}

// --- rebuild file lock ---
// The /tmp-backed `running` flag is lost on container restart and can leave a
// stale flag behind after a crash, so a plain flag cannot stop two `npm run
// build` processes from racing on node_modules/.astro. This O_EXCL lock file
// is the hard guard: `fs.openSync(path, 'wx')` fails atomically if the lock
// already exists. The lock records the owning PID so a lock left by a dead
// builder (crash, server restart mid-build) can be reclaimed via liveness
// check instead of blocking rebuilds forever.

/** Try to take the rebuild lock. Returns true only when this process holds it. */
export function acquireBuildLock(): boolean {
  try {
    const fd = fs.openSync(BUILD_LOCK_FILE, 'wx')
    fs.writeFileSync(fd, String(process.pid))
    fs.closeSync(fd)
    return true
  } catch {
    return reclaimBuildLock()
  }
}

/** The lock exists — reclaim it if the recorded owner is dead, else report busy. */
function reclaimBuildLock(): boolean {
  try {
    const pid = Number.parseInt(fs.readFileSync(BUILD_LOCK_FILE, 'utf8'), 10)
    if (!Number.isInteger(pid) || pid <= 0) return false
    try {
      process.kill(pid, 0)
      return false // owner alive → a build is genuinely in flight
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'EPERM') return false // exists but owned elsewhere → busy
      fs.unlinkSync(BUILD_LOCK_FILE) // ESRCH → owner dead → reclaim
      return acquireBuildLock()
    }
  } catch {
    return false
  }
}

/** Release the lock (called from the build's exit/error handlers). */
export function releaseBuildLock() {
  try {
    fs.unlinkSync(BUILD_LOCK_FILE)
  } catch {}
}

/**
 * The build runs detached (`spawn(..., { detached: true, unref() })`) and
 * survives a server restart — so the lock must track the *builder's* PID, not
 * the server's. Written once the child has spawned.
 */
export function setBuildLockPid(pid: number) {
  try {
    fs.writeFileSync(BUILD_LOCK_FILE, String(pid))
  } catch {}
}
