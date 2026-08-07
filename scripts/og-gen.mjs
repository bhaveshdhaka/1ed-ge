#!/usr/bin/env node
/**
 * Generate the default social/OG image (1200x630) — the 1edge wordmark
 * (mono 1 + Syne edge + soft _) on the site's dark field. Raster via sharp.
 * Usage: node scripts/og-gen.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fontsCss, wordmarkSvg, sheenDef, renderPng } from './lib/brand.mjs'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>${fontsCss()}</style>
    ${sheenDef('sheen')}
    <linearGradient id="bg-g" x1="0" y1="0" x2="1" y2="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.035"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0a0a0c"/>
  <rect x="1" y="1" width="1198" height="628" fill="none" stroke="#26262c" stroke-width="2"/>
  <rect width="1200" height="630" fill="url(#bg-g)"/>

  <text x="88" y="64" font-family="JBMono" font-size="26" fill="#5c5c64">$ whoami</text>

  ${wordmarkSvg(86, 330, 150, { gradientId: 'sheen' })}

  <text x="88" y="458" font-family="JBMono" font-size="34" fill="#d8d8dc">the edge is all we need.</text>
  <text x="88" y="506" font-family="JBMono" font-size="24" fill="#5c5c64">a public trading journal — every trade, every account, every R.</text>

  <text x="1073" y="586" font-family="JBMono" font-size="22" fill="#9a9aa2">R ▮</text>
</svg>
`

const png = await renderPng(svg, 1200, 630)
fs.writeFileSync(path.resolve('public/og.png'), png)
console.log('og.png written:', png.length, 'bytes')
