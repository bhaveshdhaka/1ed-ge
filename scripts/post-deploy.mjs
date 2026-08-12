#!/usr/bin/env node
/**
 * post-deploy.mjs — ONE script for all post-deploy bookkeeping.
 * Runs on HOST. Called from deploy-prod.sh.
 * Each step is try/catch — one failure doesn't block others.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'data')
const CHANGELOG_DIR = path.join(ROOT, 'changelog')

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15_000, cwd: ROOT }).trim()
  } catch { return null }
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf8')
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) }
  catch { return null }
}

// ── 1. changelog ────────────────────────────────────────────────────────────
function generateChangelog() {
  // HKT date via Intl (same pattern as todayHkt in src/lib/sessions.ts)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date())
  const outFile = path.join(CHANGELOG_DIR, `${today}.md`)

  let existingContent = ''
  let lastHash = null

  if (fs.existsSync(outFile)) {
    existingContent = fs.readFileSync(outFile, 'utf8')
    // Extract last commit hash from <!-- last:HASH --> header
    const hashMatch = existingContent.match(/^<!-- last:([a-f0-9]+) -->/)
    if (hashMatch) lastHash = hashMatch[1]
  }

  // Determine which commits to process
  let log
  if (lastHash) {
    // Get commits since the last recorded hash
    log = sh(`git log ${lastHash}..HEAD --format="%h %s" --no-merges`)
  } else if (existingContent) {
    // File exists but no hash header — find last changelog across all days
    let since = null
    try {
      const files = fs.readdirSync(CHANGELOG_DIR)
        .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f !== `${today}.md`)
        .sort()
      if (files.length) {
        const prevFile = path.join(CHANGELOG_DIR, files[files.length - 1])
        const prevContent = fs.readFileSync(prevFile, 'utf8')
        const prevHash = prevContent.match(/^<!-- last:([a-f0-9]+) -->/)
        if (prevHash) since = prevHash[1]
      }
    } catch { /* no dir yet */ }
    log = since
      ? sh(`git log ${since}..HEAD --format="%h %s" --no-merges`)
      : sh('git log --since="7 days ago" --format="%h %s" --no-merges')
  } else {
    // No file exists — find last changelog across all days
    let since = null
    try {
      const files = fs.readdirSync(CHANGELOG_DIR)
        .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort()
      if (files.length) {
        const prevFile = path.join(CHANGELOG_DIR, files[files.length - 1])
        const prevContent = fs.readFileSync(prevFile, 'utf8')
        const prevHash = prevContent.match(/^<!-- last:([a-f0-9]+) -->/)
        if (prevHash) since = prevHash[1]
      }
    } catch { /* no dir yet */ }
    log = since
      ? sh(`git log ${since}..HEAD --format="%h %s" --no-merges`)
      : sh('git log --since="7 days ago" --format="%h %s" --no-merges')
  }

  if (!log) {
    console.log('  changelog: no new commits')
    return
  }

  const lines = log.split('\n').filter(Boolean)
  if (lines.length === 0) {
    console.log('  changelog: no new commits')
    return
  }

  // Get latest commit hash
  const latestHash = sh('git log -1 --format="%h"') || 'unknown'

  // Group new commits by prefix
  const groups = { Added: [], Fixed: [], Changed: [], Maintenance: [] }
  for (const line of lines) {
    if (/^.{7} feat[:\(]/.test(line)) groups.Added.push(line)
    else if (/^.{7} fix[:\(]/.test(line)) groups.Fixed.push(line)
    else if (/^.{7} docs[:\(]/.test(line)) groups.Changed.push(line)
    else if (/^.{7} refactor[:\(]/.test(line)) groups.Changed.push(line)
    else groups.Maintenance.push(line)
  }

  // Build new entries markdown
  let newEntries = ''
  for (const [section, items] of Object.entries(groups)) {
    if (items.length === 0) continue
    newEntries += `### ${section}\n\n`
    for (const item of items) {
      const msg = item.replace(/^.{7}\s*/, '')
      newEntries += `- ${msg}\n`
    }
    newEntries += '\n'
  }

  if (existingContent) {
    // Append new entries to existing file
    // Insert new entries after the header comment and title, before existing entries
    const headerEnd = existingContent.indexOf('\n### ')
    if (headerEnd !== -1) {
      // Insert before the first existing section
      const updated = existingContent.slice(0, headerEnd) + '\n\n' + newEntries + existingContent.slice(headerEnd)
      // Update the last hash
      const final = updated.replace(/^<!-- last:[a-f0-9]+ -->/, `<!-- last:${latestHash} -->`)
      writeFile(outFile, final)
    } else {
      // No existing sections — just append
      const final = existingContent.replace(/^<!-- last:[a-f0-9]+ -->/, `<!-- last:${latestHash} -->`) + '\n' + newEntries
      writeFile(outFile, final)
    }
    console.log(`  changelog: appended ${lines.length} commits to ${today}.md`)
  } else {
    // Write fresh file
    const md = `<!-- last:${latestHash} -->\n# ${today}\n\n${newEntries}`
    writeFile(outFile, md)
    console.log(`  changelog: wrote ${today}.md (${lines.length} commits)`)
  }
}

// ── 2. build stamp ──────────────────────────────────────────────────────────
function writeBuildStamp() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date())
  const commit = sh('git log -1 --format="%h %s"') || 'unknown'
  const build = {
    version: today,
    at: new Date().toISOString(),
    commit,
  }
  writeFile(path.join(DATA, 'build.json'), JSON.stringify(build, null, 2) + '\n')
  console.log(`  build: ${today} (${commit.slice(0, 12)})`)
}

// ── 3. tokenomics ───────────────────────────────────────────────────────────
function fetchTokenomics() {
  const DB_PATH = path.join(process.env.HOME, '.local/share/opencode/opencode.db')
  if (!fs.existsSync(DB_PATH)) {
    console.log('  tokenomics: OpenCode DB not found, skipping')
    return
  }

  // Use python3 since sqlite3 CLI may not be installed
  const script = `
import sqlite3, json, os
db = sqlite3.connect("${DB_PATH}", timeout=5)
c = db.cursor()

def q(sql):
    c.execute(sql)
    return c.fetchall()

# Totals
c.execute("SELECT SUM(cost), SUM(tokens_input), SUM(tokens_output), SUM(tokens_reasoning), SUM(tokens_cache_read), SUM(tokens_cache_write), COUNT(*) FROM session")
t = c.fetchone()
total_cost = t[0] or 0
total_input = t[1] or 0
total_output = t[2] or 0
total_reasoning = t[3] or 0
total_cache = t[4] or 0
total_sessions = t[6] or 0
cache_rate = total_cache / max(1, total_cache + total_input)

# Commits
import subprocess
try:
    commits = int(subprocess.check_output(["git", "rev-list", "--count", "HEAD"], cwd="${ROOT}", text=True).strip())
except: commits = 0
cost_per_commit = total_cost / max(1, commits)

# By day
rows = q("SELECT date(time_created/1000, 'unixepoch') as d, COUNT(*), SUM(cost), SUM(tokens_input), SUM(tokens_output), SUM(tokens_cache_read) FROM session GROUP BY d ORDER BY d")
byDay = [{"date": r[0], "sessions": r[1], "cost": round(r[2] or 0, 4), "tokensInput": r[3] or 0, "tokensOutput": r[4] or 0, "cacheRead": r[5] or 0} for r in rows]

# By model
rows = q("SELECT model, COUNT(*), SUM(cost), SUM(tokens_input), SUM(tokens_output) FROM session GROUP BY model ORDER BY SUM(cost) DESC")
byModel = []
for r in rows:
    try:
        m = json.loads(r[0])
        name = m.get("id", "?")
        provider = m.get("providerID", "?")
    except:
        name = str(r[0])[:40]
        provider = "?"
    byModel.append({"model": name, "provider": provider, "sessions": r[1], "cost": round(r[2] or 0, 4), "tokensInput": r[3] or 0, "tokensOutput": r[4] or 0})

# By agent
rows = q("SELECT agent, COUNT(*), SUM(cost), SUM(tokens_input), SUM(tokens_output) FROM session WHERE agent IS NOT NULL GROUP BY agent ORDER BY SUM(cost) DESC")
byAgent = [{"agent": r[0] or "unknown", "sessions": r[1], "cost": round(r[2] or 0, 4), "tokensInput": r[3] or 0, "tokensOutput": r[4] or 0} for r in rows]

# Recent sessions
rows = q("SELECT title, model, agent, cost, date(time_created/1000, 'unixepoch'), tokens_input, tokens_output FROM session WHERE title IS NOT NULL ORDER BY time_created DESC LIMIT 20")
recent = []
for r in rows:
    try:
        m = json.loads(r[1])
        model = m.get("id", "?")
    except:
        model = str(r[1])[:30]
    recent.append({"title": r[0][:80], "model": model, "agent": r[2] or "?", "cost": round(r[3] or 0, 4), "date": r[4], "tokensInput": r[5] or 0, "tokensOutput": r[6] or 0})

# Avg duration
c.execute("SELECT AVG(time_updated - time_created) / 1000 FROM session WHERE time_updated > time_created")
avg_dur = c.fetchone()[0] or 0

result = {
    "at": "${new Date().toISOString()}",
    "totals": {
        "cost": round(total_cost, 4),
        "sessions": total_sessions,
        "tokensInput": total_input,
        "tokensOutput": total_output,
        "tokensReasoning": total_reasoning,
        "tokensCacheRead": total_cache,
        "cacheHitRate": round(cache_rate, 4),
        "avgSessionDuration": int(avg_dur),
        "commits": commits,
        "costPerCommit": round(cost_per_commit, 6)
    },
    "byDay": byDay,
    "byModel": byModel,
    "byAgent": byAgent,
    "recentSessions": recent
}
print(json.dumps(result))
db.close()
`
  const out = sh(`python3 -c '${script.replace(/'/g, "'\\''")}'`)
  if (!out) {
    console.log('  tokenomics: python query failed')
    return
  }
  try {
    const parsed = JSON.parse(out) // validate
    writeFile(path.join(DATA, 'tokenomics.json'), out + '\n')
    console.log(`  tokenomics: wrote tokenomics.json (${parsed.totals.sessions} sessions)`)
  } catch (e) {
    console.log('  tokenomics: invalid JSON output:', e.message)
  }
}

// ── 4. clear pending ────────────────────────────────────────────────────────
function clearPending() {
  writeFile(path.join(DATA, 'pending.json'), '[]\n')
  console.log('  pending: cleared')
}

// ── main ────────────────────────────────────────────────────────────────────
console.log('post-deploy: starting')
try { generateChangelog() } catch (e) { console.error('  changelog failed:', e.message) }
try { writeBuildStamp() } catch (e) { console.error('  build stamp failed:', e.message) }
try { fetchTokenomics() } catch (e) { console.error('  tokenomics failed:', e.message) }
try { clearPending() } catch (e) { console.error('  clear pending failed:', e.message) }

console.log('post-deploy: done')
