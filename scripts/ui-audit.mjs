#!/usr/bin/env node
/**
 * ui-audit.mjs — UI standardization & governance scanner.
 *
 * Scans src/pages/ and src/components/ for duplicate Tailwind class clusters
 * that the design system says should live in src/components/ui/*.  The goal is
 * to surface raw, hand-inlined markup that a maintainer or the design-steward
 * agent should replace with the standardized primitive.
 *
 * Cluster definitions live in CLUSTERS below.  Each is a named pattern with:
 *   - a regex to match a class= attribute (or inline class string)
 *   - the ui primitive that should own it
 *   - a recommendation
 *
 * Output: data/ui-audit.json
 *   {
 *     "at": "<iso>",
 *     "generator": "scripts/ui-audit.mjs",
 *     "totalDuplicates": N,
 *     "files": [ { path, matches: [ { cluster, count, sample } ] } ],
 *     "byCluster": [ { cluster, primitive, count, files: [...] } ]
 *   }
 *
 * Usage: node scripts/ui-audit.mjs [--json [out]]
 *   default out: data/ui-audit.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.argv.find((a, i) => a === '--json' && process.argv[i + 1])
  ? path.resolve(process.argv[process.argv.indexOf('--json') + 1])
  : path.join(ROOT, 'data', 'ui-audit.json')

const SCAN_DIRS = ['src/pages', 'src/components']
// The primitives themselves use their own classes — never flag ui/* as drift.
const EXCLUDE = ['src/components/ui', 'src/components/ui/react']

// ── Cluster definitions ──────────────────────────────────────────────────────
// Each entry: { name, primitive, regex, hint }
// `regex` is matched against a full class attribute value (e.g. `class="..."`)
// or a bare class string inside markup. Patterns are anchored on class tokens.
const CLUSTERS = [
  {
    name: 'card-panel',
    primitive: 'Card',
    regex: /\bpanel(?:\s+panel-(?:hero|static|flat))?\b/,
    hint: 'Raw .panel markup — use <Card variant=…> instead of hand-inlining the panel class.',
  },
  {
    name: 'card-header',
    primitive: 'Card (card-hd)',
    regex: /\bcard-hd\b/,
    hint: 'Raw card header markup — pass icon/label/subtitle to <Card> instead of hand-building card-hd.',
  },
  {
    name: 'card-icon',
    primitive: 'Card (card-ico)',
    regex: /\bcard-ico\b/,
    hint: 'Raw card icon markup — use <Card icon="…">.',
  },
  {
    name: 'badge-chip',
    primitive: 'Badge',
    regex: /\b(?:border-(?:up|down|warn|accent|line|line2)\/?(?:\d+)?\s+text-(?:up|down|warn|accent)\s+bg-(?:up|down|warn|accent)\/\d+)/,
    hint: 'Hand-rolled status chip — use <Badge variant=…>.',
  },
  {
    name: 'button',
    primitive: 'Button',
    regex: /\b(?:btn(?:\s+btn-(?:primary|danger|sm))?)\b/,
    hint: 'Raw button system class — use <Button> instead of inlining .btn classes.',
  },
  {
    name: 'well',
    primitive: 'Well',
    regex: /\bwell\b/,
    hint: 'Raw inset well — use <Well> instead of hand-inlining .well.',
  },
  {
    name: 'kv-row',
    primitive: 'KvRow',
    regex: /\bp-3\s+[^"]*?text-4xs\b|\bk\b/,
    hint: 'Potential key/value row — use <KvRow label= value=>.',
  },
  {
    name: 'stat-value',
    primitive: 'StatCard',
    regex: /\btext-4xs\s+font-bold\s+uppercase\s+text-faint\b/,
    hint: 'Hand-rolled stat label — use <StatCard label= value=>.',
  },
  {
    name: 'table-header',
    primitive: 'Table',
    regex: /\bth\b/,
    usesPrimitive: /\bTable\s*head=|\bimport\s+Table\b/,
    hint: 'Raw table header cell — use <Table head={…}> primitives.',
  },
  {
    name: 'table-cell',
    primitive: 'Table',
    regex: /\btd\b/,
    usesPrimitive: /\bTable\s*head=|\bimport\s+Table\b/,
    hint: 'Raw table cell — use <Table> primitives.',
  },
  // Modal / sheet structures (admin React uses these; scan anyway)
  {
    name: 'modal-sheet',
    primitive: 'ui/react (SheetFrame)',
    regex: /\b(?:fixed\s+inset-0|z-50\s+overlay|backdrop-blur)/,
    hint: 'Hand-rolled overlay/modal — use the admin SheetFrame primitive.',
  },
]

// ── Scan helpers ─────────────────────────────────────────────────────────────
function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'images') continue
      out.push(...walk(p))
    } else if (entry.name.endsWith('.astro') || entry.name.endsWith('.tsx')) {
      out.push(p)
    }
  }
  return out
}

function rel(p) { return path.relative(ROOT, p) }

function isExcluded(relPath) {
  return EXCLUDE.some((e) => relPath.startsWith(e + path.sep) || relPath === e)
}

function countMatches(content, regex) {
  const re = new RegExp(regex.source, 'g')
  let n = 0
  let sample = ''
  let m
  // Match class attribute values AND bare class lists in markup.
  const classAttr = /class="([^"]*)"/g
  let cm
  while ((cm = classAttr.exec(content))) {
    const m2 = cm[1].match(re)
    if (m2) {
      n++
      if (!sample) sample = cm[1].slice(0, 120)
    }
  }
  // Also count matches in raw template strings (e.g. class={`...`}) loosely.
  while ((m = re.exec(content))) {
    n++
    if (n === 1) sample = m[0].slice(0, 120)
  }
  // Avoid double counting: cap per cluster per file at a sane number.
  return { count: Math.min(n, 999), sample }
}

// ── Run scan ────────────────────────────────────────────────────────────────
const files = []
const byCluster = CLUSTERS.map((c) => ({ ...c, count: 0, files: [] }))

for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    const rp = rel(file)
    if (isExcluded(rp)) continue
    const content = fs.readFileSync(file, 'utf8')
    const matches = []
    CLUSTERS.forEach((c, idx) => {
      // Skip "primitive is already in use" clusters when the file uses that
      // primitive (e.g. .td/.th inside <Table> markup is the sanctioned pattern).
      if (c.usesPrimitive && c.usesPrimitive.test(content)) return
      const { count, sample } = countMatches(content, c.regex)
      if (count > 0) {
        matches.push({ cluster: c.name, primitive: c.primitive, count, sample })
        byCluster[idx].count += count
        byCluster[idx].files.push(rp)
      }
    })
    if (matches.length) files.push({ path: rel(file), matches })
  }
}

// Sort by most duplicates
files.sort((a, b) => {
  const sa = a.matches.reduce((s, m) => s + m.count, 0)
  const sb = b.matches.reduce((s, m) => s + m.count, 0)
  return sb - sa
})

const totalDuplicates = byCluster.reduce((s, c) => s + c.count, 0)

const report = {
  at: new Date().toISOString(),
  generator: 'scripts/ui-audit.mjs',
  scanDirs: SCAN_DIRS,
  totalDuplicates,
  files,
  byCluster: byCluster.map(({ regex, ...c }) => c), // drop regex from output
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')

console.log(`ui-audit: ${files.length} files with primitive-adjacent duplicates, ${totalDuplicates} total matches`)
for (const c of byCluster) {
  console.log(`  ${c.name.padEnd(14)} ${String(c.count).padStart(4)}  (${c.primitive})`)
}
console.log(`output: ${OUT}`)