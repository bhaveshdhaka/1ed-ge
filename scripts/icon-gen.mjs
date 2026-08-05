#!/usr/bin/env node
/**
 * Generate PWA PNG icons from the emoji favicon using Chromium (full-color emoji).
 * Usage: node scripts/icon-gen.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd())
const svg = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8')

const mkPage = (size, svgContent, emojiScale = 1) => {
  const inner = svgContent.replace(
    '<text x="32" y="45" font-size="34"',
    `<text x="32" y="${45 * emojiScale}" font-size="${34 * emojiScale}"`,
  )
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent}
    svg{display:block;width:${size}px;height:${size}px}
  </style></head><body>${inner}</body></html>`
  return { html, size }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ deviceScaleFactor: 1 })
const page = await context.newPage()

const render = async (size, scale) => {
  const { html } = mkPage(size, svg, scale)
  await page.setContent(html)
  const el = page.locator('svg')
  const buf = await el.screenshot({ type: 'png' })
  return buf
}

const outDir = path.join(ROOT, 'public/icons')
fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(path.join(outDir, 'icon-192.png'), await render(192, 1))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), await render(512, 1))
// maskable: emoji padded to ~62% for the circular safe zone
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), await render(512, 0.62))

await browser.close()
console.log('icons generated:', fs.readdirSync(outDir).join(', '))
