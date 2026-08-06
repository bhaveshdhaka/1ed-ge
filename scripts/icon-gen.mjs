#!/usr/bin/env node
/**
 * Generate PWA PNG icons from the 1edge wordmark (sharp/librsvg raster).
 * Usage: node scripts/icon-gen.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { tileSvg, renderPng } from './lib/brand.mjs'

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })

const icon = async (name, size, opts) => {
  const png = await renderPng(tileSvg(size, opts), size, size)
  fs.writeFileSync(path.join(outDir, name), png)
  console.log(name, 'written:', png.length, 'bytes')
}

// "any" icons: rounded dark tile, wordmark ~85% of the tile width
await icon('icon-192.png', 192, { wordRatio: 0.22, rounded: true, sheen: true })
await icon('icon-512.png', 512, { wordRatio: 0.22, rounded: true, sheen: true })
// maskable: full-bleed square, wordmark in the 80% safe zone
await icon('icon-maskable-512.png', 512, { wordRatio: 0.20, rounded: false, sheen: true })

console.log('icons done:', fs.readdirSync(outDir).join(', '))
