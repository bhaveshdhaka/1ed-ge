#!/usr/bin/env node
/**
 * tokenomics.mjs — extract OpenCode token/cost stats into $DATA_DIR/tokenomics.json.
 * Runs on HOST (Server A) via cron. Reads the OpenCode SQLite DB.
 *
 * Env:
 *   OPENCODE_DB  — path to opencode.db (default ~/.local/share/opencode/opencode.db)
 *   DATA_DIR     — output dir (default ./data)
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = process.env.OPENCODE_DB || path.join(os.homedir(), '.local/share/opencode/opencode.db')
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data')

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15_000, cwd: ROOT }).trim()
  } catch { return null }
}

if (!fs.existsSync(DB_PATH)) {
  console.log('tokenomics: OpenCode DB not found, skipping')
  process.exit(0)
}

const script = `
import sqlite3, json, os
db = sqlite3.connect("${DB_PATH}", timeout=5)
c = db.cursor()

def q(sql):
    c.execute(sql)
    return c.fetchall()

c.execute("SELECT SUM(cost), SUM(tokens_input), SUM(tokens_output), SUM(tokens_reasoning), SUM(tokens_cache_read), SUM(tokens_cache_write), COUNT(*) FROM session")
t = c.fetchone()
total_cost = t[0] or 0
total_input = t[1] or 0
total_output = t[2] or 0
total_reasoning = t[3] or 0
total_cache = t[4] or 0
total_sessions = t[6] or 0
cache_rate = total_cache / max(1, total_cache + total_input)

import subprocess
try:
    commits = int(subprocess.check_output(["git", "rev-list", "--count", "HEAD"], cwd="${ROOT}", text=True).strip())
except: commits = 0
cost_per_commit = total_cost / max(1, commits)

rows = q("SELECT date(time_created/1000, 'unixepoch') as d, COUNT(*), SUM(cost), SUM(tokens_input), SUM(tokens_output), SUM(tokens_cache_read) FROM session GROUP BY d ORDER BY d")
byDay = [{"date": r[0], "sessions": r[1], "cost": round(r[2] or 0, 4), "tokensInput": r[3] or 0, "tokensOutput": r[4] or 0, "cacheRead": r[5] or 0} for r in rows]

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

rows = q("SELECT agent, COUNT(*), SUM(cost), SUM(tokens_input), SUM(tokens_output) FROM session WHERE agent IS NOT NULL GROUP BY agent ORDER BY SUM(cost) DESC")
byAgent = [{"agent": r[0] or "unknown", "sessions": r[1], "cost": round(r[2] or 0, 4), "tokensInput": r[3] or 0, "tokensOutput": r[4] or 0} for r in rows]

rows = q("SELECT title, model, agent, cost, date(time_created/1000, 'unixepoch'), tokens_input, tokens_output FROM session WHERE title IS NOT NULL ORDER BY time_created DESC LIMIT 20")
recent = []
for r in rows:
    try:
        m = json.loads(r[1])
        model = m.get("id", "?")
    except:
        model = str(r[1])[:30]
    recent.append({"title": r[0][:80], "model": model, "agent": r[2] or "?", "cost": round(r[3] or 0, 4), "date": r[4], "tokensInput": r[5] or 0, "tokensOutput": r[6] or 0})

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
  console.log('tokenomics: python query failed')
  process.exit(1)
}
try {
  const parsed = JSON.parse(out) // validate
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, 'tokenomics.json'), out + '\n')
  console.log(`tokenomics: wrote tokenomics.json (${parsed.totals.sessions} sessions)`)
} catch (e) {
  console.log('tokenomics: invalid JSON output:', e.message)
  process.exit(1)
}
