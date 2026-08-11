#!/usr/bin/env node
/**
 * status-snapshot.mjs — host-only collector for /status.
 * Writes data/status.json (bind-mounted into the container).
 * Never throws away a partial snapshot; missing fields stay null.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'data', 'status.json')
const TMP = OUT + '.tmp'

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      timeout: 8_000,
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      ...opts,
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

// ── market ──────────────────────────────────────────────────────────────────
const logTail = (readFile('/tmp/1edge-market.log') ?? '').split('\n').filter(Boolean).slice(-50)
const SUMMARY = /market-news: (\d+) tv \+ (\d+) ff -> (\d+) events \((\d+) red, (\d+) verified\)/
const UNVERIFIED_COUNT = /market-news: (\d+) unverified \(single source\):/

// Last fetch time = mtime of the market log file (most reliable signal)
let lastFetched = null
try {
  const stat = fs.statSync('/tmp/1edge-market.log')
  lastFetched = stat.mtime.toISOString()
} catch {
  /* keep null */
}

let market = {
  lastDay: null,
  lastFetched,
  nextFetch: null,
  tv: null,
  ff: null,
  events: null,
  red: null,
  verified: null,
  unverifiedCount: null,
  unverified: [],
  logTail,
}
for (const line of logTail) {
  const m = SUMMARY.exec(line)
  if (m) {
    market.tv = Number(m[1])
    market.ff = Number(m[2])
    market.events = Number(m[3])
    market.red = Number(m[4])
    market.verified = Number(m[5])
  }
  const u = UNVERIFIED_COUNT.exec(line)
  if (u) market.unverifiedCount = Number(u[1])
}
market.unverified = logTail.filter((l) => /^\s{2}(TV|FF) /.test(l)).slice(0, 20)

// Next fetch: cron is 0 */8 * * * UTC (00:00, 08:00, 16:00 UTC)
// Compute next 8h boundary after lastFetched
if (lastFetched) {
  const last = new Date(lastFetched)
  const h = last.getUTCHours()
  const nextH = Math.ceil((h + 1) / 8) * 8
  const next = new Date(last)
  next.setUTCHours(nextH % 24, 0, 0, 0)
  if (nextH >= 24) next.setUTCDate(next.getUTCDate() + 1)
  // If next is in the past (lastFetched was a while ago), jump forward
  while (next <= last) next.setUTCHours(next.getUTCHours() + 8)
  market.nextFetch = next.toISOString()
}

try {
  const dir = path.join(ROOT, 'src/content/market-news')
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
  if (files.length) market.lastDay = files[files.length - 1].slice(0, 10)
} catch {
  /* keep null */
}

// ── rebuilds / pending ──────────────────────────────────────────────────────
const rebuildsRaw = readJson(path.join(ROOT, 'data', 'rebuilds.json'))
const pendingRaw = readJson(path.join(ROOT, 'data', 'pending.json'))
const rebuilds = Array.isArray(rebuildsRaw) ? rebuildsRaw : []
const pending = Array.isArray(pendingRaw) ? pendingRaw : []

// ── system ──────────────────────────────────────────────────────────────────
const dockerStatus = sh('docker ps --filter name=1edge-site --format "{{.Status}}"')
const dockerUp = !!dockerStatus && /^Up/i.test(dockerStatus)

const dfRaw = sh('df -h / | tail -1')
const dfParts = dfRaw ? dfRaw.split(/\s+/) : null
const disk =
  dfParts && dfParts.length >= 5
    ? { total: dfParts[1], used: dfParts[2], pct: dfParts[4] }
    : null

const memRaw = sh("free -h | awk '/^Mem:/{print}'")
const memParts = memRaw ? memRaw.split(/\s+/) : null
const memory =
  memParts && memParts.length >= 3
    ? { total: memParts[1], used: memParts[2] }
    : null

const uptime = sh('uptime -p')
const nodeRaw = sh('pgrep -c node')
const nodeProcesses = nodeRaw != null && nodeRaw !== '' ? Number(nodeRaw) : null

// ── git ─────────────────────────────────────────────────────────────────────
const branch = sh('git rev-parse --abbrev-ref HEAD')
const lastCommit = sh('git log -1 --format="%h %s (%cr)"')
const syncRaw = sh('git rev-list --left-right --count HEAD...@{upstream}')
let ahead = null
let behind = null
if (syncRaw) {
  const [a, b] = syncRaw.split(/\s+/)
  if (a != null && b != null) {
    ahead = Number(a)
    behind = Number(b)
  }
}

// ── live ────────────────────────────────────────────────────────────────────
const LIVE_FILE = path.join(ROOT, 'data', 'live.json')
const liveFile = readJson(LIVE_FILE)
const liveAt =
  liveFile && typeof liveFile === 'object' && typeof liveFile.at === 'string'
    ? liveFile.at
    : null
const LIVE_WINDOW_MS = 5 * 60 * 1000
const liveNow =
  liveAt != null && !Number.isNaN(Date.parse(liveAt))
    ? Date.now() - Date.parse(liveAt) < LIVE_WINDOW_MS
    : false

const snapshot = {
  at: new Date().toISOString(),
  market,
  rebuilds,
  pending,
  system: {
    container: { up: dockerUp, status: dockerStatus },
    disk,
    memory,
    uptime,
    nodeProcesses: Number.isFinite(nodeProcesses) ? nodeProcesses : null,
  },
  git: {
    branch,
    lastCommit,
    ahead,
    behind,
  },
  live: {
    live: liveNow,
    at: liveAt,
  },
}

try {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(TMP, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  fs.renameSync(TMP, OUT)
} catch (err) {
  console.error('status-snapshot: write failed', err?.message ?? err)
  process.exitCode = 1
}
