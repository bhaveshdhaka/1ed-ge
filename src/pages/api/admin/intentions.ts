import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import fs from 'node:fs'
import path from 'node:path'
import { listMds, readEntry } from '../../../lib/content'

export const prerender = false

const DIR = path.join(process.cwd(), 'src/content/intentions')

/** Generate next filename for today's intention */
function nextFilename(): string {
  const today = new Date().toISOString().slice(0, 10)
  if (!fs.existsSync(DIR)) return `${today}.md`
  const existing = fs.readdirSync(DIR).filter(f => f.startsWith(today) && f.endsWith('.md'))
  if (existing.length === 0) return `${today}.md`
  // Find highest suffix
  let max = 1
  for (const f of existing) {
    const match = f.match(/-(\d+)\.md$/)
    if (match) max = Math.max(max, parseInt(match[1]))
    else if (f === `${today}.md`) max = Math.max(max, 1)
  }
  return `${today}-${max + 1}.md`
}

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)

  const files = listMds('intentions').sort().reverse()
  const intentions = files.map(f => {
    const entry = readEntry('intentions', f)
    return {
      file: f,
      date: entry.data.date,
      time: entry.data.time ?? null,
      text: entry.body?.trim() ?? '',
    }
  }).filter(i => i.text.length > 0)

  return json({ ok: true, intentions, count: intentions.length })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)

  try {
    const body = await request.json()
    const text = (body.text ?? '').trim()
    if (!text) return error('text is required', 400)

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toISOString().slice(11, 16)
    const filename = nextFilename()

    // Ensure directory exists
    fs.mkdirSync(DIR, { recursive: true })

    const content = `---\ndate: "${date}"\ntime: "${time}"\n---\n${text}\n`
    fs.writeFileSync(path.join(DIR, filename), content, 'utf8')

    return json({ ok: true, file: filename, date, time })
  } catch (e: any) {
    return error(e.message ?? 'failed to save intention', 500)
  }
}
