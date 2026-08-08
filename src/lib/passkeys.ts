import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = process.env.PASSKEY_DATA_DIR
  ? path.resolve(process.env.PASSKEY_DATA_DIR)
  : path.join(process.cwd(), 'data')

const CREDS = path.join(DATA_DIR, 'passkeys.json')
const SESSIONS = path.join(DATA_DIR, 'sessions.json')

export interface CredentialRecord {
  id: string
  publicKey: string // base64url
  counter: number
  transports: string[]
  createdAt: string
}
export interface SessionRecord {
  token: string
  createdAt: number
  expiresAt: number
}

const ensureDir = () => fs.mkdirSync(DATA_DIR, { recursive: true })
const readJson = <T>(file: string, fallback: T): T => {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}
const writeJson = (file: string, data: unknown) => {
  ensureDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// --- credentials ---
export function readCredentials(): CredentialRecord[] {
  return readJson<{ credentials: CredentialRecord[] }>(CREDS, { credentials: [] }).credentials
}
export function saveCredential(rec: CredentialRecord) {
  const all = readCredentials().filter((c) => c.id !== rec.id)
  all.push(rec)
  writeJson(CREDS, { credentials: all })
}
export function clearCredentials() {
  writeJson(CREDS, { credentials: [] })
}

// --- sessions ---
export function readSessions(): SessionRecord[] {
  return readJson<{ sessions: SessionRecord[] }>(SESSIONS, { sessions: [] }).sessions
}
function writeSessions(list: SessionRecord[]) {
  writeJson(SESSIONS, { sessions: list })
}
export function saveSession(token: string, ttlMs: number) {
  const now = Date.now()
  const all = readSessions()
  all.push({ token, createdAt: now, expiresAt: now + ttlMs })
  writeSessions(all)
}
export function deleteSession(token: string) {
  writeSessions(readSessions().filter((s) => s.token !== token))
}
export function clearSessions() {
  writeSessions([])
}
/** Sliding check: token present + not expired → refresh expiry, return true. */
export function touchSession(token: string, ttlMs: number): boolean {
  const all = readSessions()
  const idx = all.findIndex((s) => s.token === token)
  if (idx === -1) return false
  if (Date.now() > all[idx].expiresAt) {
    all.splice(idx, 1)
    writeSessions(all)
    return false
  }
  all[idx].expiresAt = Date.now() + ttlMs
  writeSessions(all)
  return true
}

// --- challenge store (in-memory, 2-min TTL) ---
const challenges = new Map<string, { value: string; at: number }>()
const CHALLENGE_TTL = 2 * 60 * 1000
export function setChallenge(nonce: string, challenge: string) {
  challenges.set(nonce, { value: challenge, at: Date.now() })
}
export function getChallenge(nonce: string, now: number = Date.now()): string | null {
  const c = challenges.get(nonce)
  if (!c) return null
  if (now - c.at > CHALLENGE_TTL) {
    challenges.delete(nonce)
    return null
  }
  challenges.delete(nonce) // single-use
  return c.value
}
