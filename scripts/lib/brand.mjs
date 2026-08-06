#!/usr/bin/env node
/**
 * Shared brand assets for generated graphics (favicon / PWA icons / OG image).
 * The 1edge wordmark: JetBrains Mono "1" + Syne "edge" + trailing soft "_".
 * Rendered as SVG with embedded fonts, rasterized via sharp (librsvg) — the
 * headless-Chromium screenshot path was found to mis-rasterize large text.
 */
import fs from 'node:fs'
import path from 'node:path'

const MONO_PATH = 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'
const SYNE_PATH = 'node_modules/@fontsource-variable/syne/files/syne-latin-wght-normal.woff2'

const INK = '#d8d8dc'
const SOFT = '#9a9aa2'
const DIM = '#5c5c64'
const BG = '#0a0a0c'
const LINE = '#26262c'

export function fontsCss() {
  const mono = fs.readFileSync(path.resolve(MONO_PATH)).toString('base64')
  const syne = fs.readFileSync(path.resolve(SYNE_PATH)).toString('base64')
  return (
    `@font-face{font-family:'JBMono';src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:100 800}\n` +
    `@font-face{font-family:'Syne';src:url(data:font/woff2;base64,${syne}) format('woff2');font-weight:400 800}`
  )
}

/**
 * The wordmark as an SVG <text> with mixed fonts.
 * @param {number} x anchor x (left edge, or center when anchor='middle')
 * @param {number} y baseline y
 * @param {number} size font-size px
 * @param {object} o gradientId: linearGradient id for the tape sheen; anchor
 */
export function wordmarkSvg(x, y, size, { gradientId = null, anchor = 'start' } = {}) {
  const fill = gradientId ? `fill="url(#${gradientId})"` : `fill="${INK}"`
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Syne" font-size="${size}" font-weight="650" ${fill}>
  <tspan font-family="JBMono" font-weight="650">1</tspan>edge<tspan font-family="JBMono" fill="${SOFT}">_</tspan>
</text>`
}

/** Horizontal tape-sheen gradient def (the v06 sweep, statically placed). */
export function sheenDef(id) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0.40" stop-color="${INK}"/><stop offset="0.50" stop-color="#ffffff"/><stop offset="0.60" stop-color="${INK}"/>
</linearGradient>`
}

/**
 * Square tile SVG (favicon-style). Renders the wordmark centered.
 * @param {number} size tile edge px
 * @param {object} o wordRatio, rounded (bordered tile vs maskable square), sheen
 */
export function tileSvg(size, { wordRatio = 0.5, rounded = false, sheen = false } = {}) {
  const fontSize = Math.round(size * wordRatio)
  const radius = rounded ? Math.round(size * 0.22) : 0
  const cy = size / 2 + fontSize * 0.36
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><style>${fontsCss()}</style>${sheen ? sheenDef('sheen') : ''}</defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  ${rounded ? `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${Math.max(0, radius - 1)}" fill="none" stroke="${LINE}" stroke-width="2"/>` : ''}
  ${wordmarkSvg(size / 2, cy, fontSize, { gradientId: sheen ? 'sheen' : null, anchor: 'middle' })}
</svg>`
}

/** Rasterize an SVG buffer to PNG via sharp (librsvg). */
export async function renderPng(svg, width, height) {
  const { default: sharp } = await import('sharp')
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer()
}
