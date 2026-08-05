import fs from 'node:fs'

const PENDING_FILE = '/tmp/1edge-pending.json'
const REBUILDS_FILE = '/tmp/1edge-rebuilds.json'

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
    fs.writeFileSync(REBUILDS_FILE, JSON.stringify(list))
  } catch {}
}
