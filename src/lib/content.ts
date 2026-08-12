import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CONTENT, MEDIA } from './paths'

export type Kind =
  | 'days'
  | 'accounts'
  | 'payouts'
  | 'coach'
  | 'journal'
  | 'habits'
  | 'brief'
  | 'models'
  | 'rules'
  | 'quotes'
  | 'reviews'
  | 'intentions'

const DIRS: Record<Kind, string> = {
  days: 'days',
  accounts: 'accounts',
  payouts: 'payouts',
  coach: 'coach',
  journal: 'journal',
  habits: 'habits',
  brief: 'brief',
  models: 'models',
  rules: 'rules',
  quotes: 'quotes',
  reviews: 'reviews',
  intentions: 'intentions',
}

export const dirOf = (kind: Kind) => path.join(CONTENT, DIRS[kind])

export function listMds(kind: Kind): string[] {
  const d = dirOf(kind)
  if (!fs.existsSync(d)) return []
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort()
}

export function readEntry(kind: Kind, file: string) {
  const full = path.join(dirOf(kind), file)
  const raw = fs.readFileSync(full, 'utf8')
  const m = matter(raw)
  return { file, data: m.data as Record<string, unknown>, content: m.content, body: m.content }
}

export function writeEntry(kind: Kind, file: string, data: Record<string, unknown>, body = '') {
  const full = path.join(dirOf(kind), file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  const out = matter.stringify(body || '', data)
  fs.writeFileSync(full, out)
  return file
}

export function deleteEntry(kind: Kind, file: string) {
  const full = path.join(dirOf(kind), file)
  if (fs.existsSync(full)) fs.unlinkSync(full)
}

export function sanitizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function listMedia(): string[] {
  if (!fs.existsSync(MEDIA)) return []
  const walk = (dir: string, base = ''): string[] => {
    let out: string[] = []
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(base, ent.name)
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) out = out.concat(walk(full, rel))
      else if (!ent.name.startsWith('.')) out.push(rel)
    }
    return out
  }
  return walk(MEDIA).sort().reverse()
}
