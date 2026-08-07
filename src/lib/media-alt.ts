import fs from 'node:fs'
import path from 'node:path'
import { MEDIA } from './content'

const ALTS_FILE = path.join(MEDIA, 'alts.json')
let cache: Record<string, string> | null = null
let cacheAt = 0
const TTL = 10_000

export function readAlts(): Record<string, string> {
  if (cache && Date.now() - cacheAt < TTL) return { ...cache }
  try {
    cache = JSON.parse(fs.readFileSync(ALTS_FILE, 'utf8')) as Record<string, string>
  } catch {
    cache = {}
  }
  cacheAt = Date.now()
  return { ...cache }
}

function writeAlts(alts: Record<string, string>) {
  fs.mkdirSync(path.dirname(ALTS_FILE), { recursive: true })
  fs.writeFileSync(ALTS_FILE, JSON.stringify(alts, null, 2))
  cache = alts
  cacheAt = Date.now()
}

export function setAlt(rel: string, alt: string) {
  const alts = readAlts()
  alts[`/media/${rel}`] = alt
  writeAlts(alts)
}

export function removeAlt(rel: string) {
  const alts = readAlts()
  const key = `/media/${rel}`
  if (key in alts) {
    delete alts[key]
    writeAlts(alts)
  }
}

/** Alt text for a public image URL, or a generic fallback. */
export function altFor(url: string): string {
  return readAlts()[url] ?? '1ed.ge — public trading journal image'
}
