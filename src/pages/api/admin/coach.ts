import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry } from '../../../lib/content'
import { addChange } from '../../../lib/changes'
import { coachReply } from '../../../lib/ai'
import { buildTrends, trendsForLLM } from '../../../lib/trends'

export const prerender = false

function parseTranscript(content: string): { role: 'me' | 'coach'; text: string; when: string }[] {
  const out: { role: 'me' | 'coach'; text: string; when: string }[] = []
  const re = /^##\s+(.+?)\s+·\s+(me|coach)\s*\n([\s\S]*?)(?=^##\s+|\s*$)/gm
  let m
  while ((m = re.exec(content)) !== null) {
    out.push({ when: m[1].trim(), role: m[2] as 'me' | 'coach', text: m[3].trim() })
  }
  return out
}

function loadAllTranscripts(): { role: 'me' | 'coach'; text: string; when: string }[] {
  const all: { role: 'me' | 'coach'; text: string; when: string }[] = []
  for (const f of listMds('coach').sort()) {
    const e = readEntry('coach', f)
    all.push(...parseTranscript(e.content))
  }
  return all
}

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const url = new URL(request.url)
  if (url.searchParams.get('snapshot')) {
    const days = listMds('days').map((f) => ({ id: f.replace(/\.md$/, ''), data: readEntry('days', f).data }))
    const accounts = listMds('accounts').map((f) => ({ id: f.replace(/\.md$/, ''), data: readEntry('accounts', f).data }))
    const snapshot = buildTrends(days as never, accounts as never)
    return json({ ok: true, snapshot: trendsForLLM(snapshot) })
  }
  const sessions = listMds('coach')
    .map((f) => {
      const e = readEntry('coach', f)
      return { file: f, date: (e.data as { date?: string }).date ?? f.replace(/\.md$/, ''), messages: parseTranscript(e.content) }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  return json({ ok: true, sessions })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const text = String(body.text ?? '').trim()
  if (!text) return error('message required')

  const today = new Date().toISOString().slice(0, 10)
  const file = `${today}.md`
  const existing = listMds('coach').includes(file)
  const content = existing ? readEntry('coach', file).content : ''

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const userMsg = `## ${now} · me\n${text}\n`
  const newContent = content + (content && !content.endsWith('\n') ? '\n' : '') + userMsg

  // fresh fs-based snapshot for the coach
  const days = listMds('days').map((f) => ({ id: f.replace(/\.md$/, ''), data: readEntry('days', f).data }))
  const accounts = listMds('accounts').map((f) => ({ id: f.replace(/\.md$/, ''), data: readEntry('accounts', f).data }))
  const snapshot = buildTrends(days as never, accounts as never)
  const snapshotText = trendsForLLM(snapshot)

  const history = [...loadAllTranscripts(), { role: 'me' as const, text, when: now }]

  let reply = ''
  try {
    reply = await coachReply(snapshotText, history)
  } catch (e) {
    writeEntry('coach', file, { date: today }, newContent)
    return error(e instanceof Error ? e.message : 'coach error', 500)
  }

  const replyMsg = `## ${now} · coach\n${reply}\n`
  writeEntry('coach', file, { date: today }, newContent + '\n' + replyMsg)
  addChange('coach', `coach · ${today}`, text.slice(0, 60))
  return json({ ok: true, reply, file })
}
