#!/usr/bin/env node
/**
 * Accessibility audit of the public site + admin via axe-core.
 * Usage: node scripts/audit-a11y.mjs [baseUrl] [out]
 * Defaults: baseUrl = https://1ed.ge, out = .lhci/a11y-report.txt
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import dotenv from 'dotenv'
dotenv.config()

const BASE = process.argv[2] ?? process.env.AUDIT_BASE ?? 'https://1ed.ge'
const OUT = process.argv[3] ?? '.lhci/a11y-report.txt'
const SECRET = process.env.ADMIN_SECRET ?? ''

const routes = ['/', '/journal', '/performance', '/tracker', '/trends', '/accounts', '/coach', '/about']

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const results = []

for (const route of routes) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  const res = await new AxeBuilder({ page }).analyze()
  const v = res.violations.map((x) => ({
    id: x.id,
    impact: x.impact,
    help: x.help,
    nodes: x.nodes.length,
    targets: x.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))
  results.push({ url: route, violations: v })
  await context.close()
}

// admin day workspace (best-effort)
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/admin/${SECRET}`, { waitUntil: 'networkidle' })
  await page.keyboard.press('2')
  await page.waitForTimeout(1500)
  const res = await new AxeBuilder({ page }).exclude('.milkdown-1ed').analyze()
  results.push({
    url: '/admin/[secret] (day workspace)',
    violations: res.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.length, targets: x.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
  })
  await context.close()
} catch (e) {
  results.push({ url: '/admin (SKIPPED)', violations: [{ id: 'error', impact: 'n/a', help: String(e.message).slice(0, 120), nodes: 1, targets: [] }] })
}

await browser.close()

fs.mkdirSync('.lhci', { recursive: true })
const lines = []
let total = 0
for (const r of results) {
  lines.push(`\n== ${r.url} ==`)
  if (!r.violations.length) {
    lines.push('  ✓ no violations')
    continue
  }
  for (const v of r.violations) {
    total += v.nodes
    lines.push(`  [${v.impact}] ${v.id} — ${v.help}`)
    lines.push(`      nodes: ${v.nodes}`)
    for (const t of v.targets) lines.push(`      → ${t}`)
  }
}
lines.push(`\nTOTAL violations nodes: ${total}`)
const out = lines.join('\n')
fs.writeFileSync(OUT, out)
console.log(out)
