#!/usr/bin/env node
/**
 * design-review.mjs — weekly design violation review.
 * Reads data/design-violations.json, generates summary.
 * Writes data/design-review.json for /status page to read.
 * Cron: Monday 02:00 HKT (Sunday 18:00 UTC).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VIOLATIONS_FILE = path.join(ROOT, 'data', 'design-violations.json')
const REVIEW_FILE = path.join(ROOT, 'data', 'design-review.json')

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) }
  catch { return null }
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf8')
}

const violations = readJson(VIOLATIONS_FILE) || []
const pending = violations.filter(v => v.status === 'pending')
const approved = violations.filter(v => v.status === 'approved')
const rejected = violations.filter(v => v.status === 'rejected')

// Group pending by file
const byFile = {}
for (const v of pending) {
  if (!byFile[v.file]) byFile[v.file] = []
  byFile[v.file].push(v)
}

const review = {
  at: new Date().toISOString(),
  total: violations.length,
  pending: pending.length,
  approved: approved.length,
  rejected: rejected.length,
  byFile: Object.entries(byFile).map(([file, items]) => ({
    file,
    count: items.length,
    values: items.map(i => i.value),
  })),
  recentViolations: pending.slice(0, 20).map(v => ({
    file: v.file,
    line: v.line,
    value: v.value,
    at: v.at,
  })),
}

writeFile(REVIEW_FILE, JSON.stringify(review, null, 2) + '\n')
console.log(`design-review: ${pending.length} pending, ${approved.length} approved, ${rejected.length} rejected`)
