#!/usr/bin/env node
/**
 * Generate the default social/OG image (1200x630) via Chromium.
 * Usage: node scripts/og-gen.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const font = fs.readFileSync(
  path.resolve('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'),
).toString('base64')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'JetBrains Mono';
    src: url(data:font/woff2;base64,${font}) format('woff2');
    font-weight: 400 800;
    font-display: swap;
  }
  html,body{margin:0;padding:0;background:#0a0a0c}
  *{box-sizing:border-box}
</style></head><body>
<div style="width:1200px;height:630px;background:#0a0a0c;position:relative;overflow:hidden;font-family:'JetBrains Mono',monospace">
  <div style="position:absolute;inset:1px;border:2px solid #26262c"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(120deg, rgba(125,211,252,0.05) 0%, transparent 45%)"></div>

  <div style="position:absolute;top:40px;left:88px;font-size:26px;color:#5c5c64;letter-spacing:1px">$ whoami</div>

  <div style="position:absolute;top:225px;left:88px;font-size:128px;font-weight:700;line-height:1">
    <span style="color:#7dd3fc">1</span><span style="color:#d8d8dc">edge</span>
  </div>
  <svg style="position:absolute;top:245px;left:410px" width="24" height="230" viewBox="0 0 24 230">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7dd3fc" stop-opacity="0"/>
        <stop offset="0.45" stop-color="#7dd3fc"/>
        <stop offset="1" stop-color="#4ade80"/>
      </linearGradient>
    </defs>
    <rect x="11" y="2" width="5" height="225" fill="url(#g)"/>
    <rect x="6" y="225" width="15" height="4" fill="#7dd3fc"/>
  </svg>

  <div style="position:absolute;top:490px;left:88px;font-size:34px;color:#d8d8dc">
    the edge is all we need.
  </div>
  <div style="position:absolute;top:545px;left:88px;font-size:24px;color:#5c5c64">
    a two-year public experiment — every trade, every account, every R.
  </div>

  <div style="position:absolute;bottom:40px;right:88px;font-size:22px;color:#4ade80">R ▮</div>
</div>
</body></html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'load' })
await page.waitForTimeout(1500)
const buf = await page.screenshot({ type: 'png' })
await browser.close()
fs.writeFileSync(path.resolve('public/og.png'), buf)
console.log('og.png written:', buf.length, 'bytes')
