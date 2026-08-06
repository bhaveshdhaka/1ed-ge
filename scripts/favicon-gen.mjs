#!/usr/bin/env node
/**
 * Generate public/favicon.svg — the 1edge wordmark as a vector SVG
 * (embedded fonts), also usable as the master logo for print/letterheads.
 * Usage: node scripts/favicon-gen.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fontsCss } from './lib/brand.mjs'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><style>${fontsCss()}</style></defs>
  <rect width="64" height="64" rx="14" fill="#0a0a0c"/>
  <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#26262c" stroke-width="2"/>
  <text x="32" y="37" text-anchor="middle" font-family="Syne" font-size="15" font-weight="650" fill="#d8d8dc">
    <tspan font-family="JBMono" font-weight="650">1</tspan>edge<tspan font-family="JBMono" fill="#9a9aa2">_</tspan>
  </text>
</svg>
`
fs.writeFileSync(path.resolve('public/favicon.svg'), svg)
console.log('favicon.svg written:', svg.length, 'bytes')
