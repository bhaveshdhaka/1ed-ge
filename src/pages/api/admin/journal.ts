import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry } from '../../../lib/content'

export const prerender = false

function readJournal() {
  return listMds('journal')
    .map((f) => {
      const e = readEntry('journal', f)
      const data = e.data as Record<string, unknown>
      const preview =
        e.content
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/[#>*_`-]/g, '')
          .trim()
          .slice(0, 220) || ''
      return { file: f, slug: f.replace(/\.(md|mdx)$/, ''), data, preview }
    })
    .sort((a, b) => String(b.data.date ?? '').localeCompare(String(a.data.date ?? '')))
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const url = new URL(request.url)
  const file = url.searchParams.get('file')
  if (file) {
    const e = readEntry('journal', file)
    return json({ ok: true, entry: { file, data: e.data, content: e.content } })
  }
  return json({ ok: true, entries: readJournal() })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date (expected YYYY-MM-DD)')

  const oldFile = typeof body.file === 'string' ? body.file : undefined
  const file = `${date}.mdx`
  if (oldFile && oldFile !== file) deleteEntry('journal', oldFile)

  const tags = Array.isArray(body.tags) ? body.tags.map(String) : []
  const rawMood = typeof body.mood === 'number' || typeof body.mood === 'string' ? Number(body.mood) : undefined
  const mood =
    typeof rawMood === 'number' && Number.isFinite(rawMood) ? Math.max(1, Math.min(5, rawMood)) : undefined
  const data: Record<string, unknown> = {
    date,
    ...(body.day ? { day: String(body.day) } : {}),
    ...(body.summary ? { summary: String(body.summary) } : {}),
    tags,
    ...(mood !== undefined ? { mood } : {}),
    ...(body.featuredImage ? { featuredImage: String(body.featuredImage) } : {}),
  }
  writeEntry('journal', file, data, String(body.content ?? ''))
  return json({ ok: true, file, slug: file.replace(/\.(md|mdx)$/, '') })
}

export const DELETE: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const file = String(body.file ?? '')
  if (!file || !/^[\w.-]+\.mdx?$/.test(file)) return error('invalid file')
  deleteEntry('journal', file)
  return json({ ok: true })
}
