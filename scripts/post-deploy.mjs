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
// DATA_DIR is env-driven (deploy.yml passes /srv/1edge/data) so bookkeeping
// lands in the mounted production volume, not the runner checkout.
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data')
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
  // Extracted to scripts/tokenomics.mjs (D4) — single source of truth.
  try {
    const out = execSync('node scripts/tokenomics.mjs', { encoding: 'utf8', timeout: 20_000, cwd: ROOT })
    console.log(`  ${out.trim()}`)
  } catch (e) {
    console.log('  tokenomics: failed:', e.message)
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
