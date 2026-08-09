import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { listMds, readEntry, writeEntry, deleteEntry, sanitizeSlug } from '../../../lib/content'
import { addChange } from '../../../lib/changes'

export const prerender = false

type LibKind = 'habits' | 'models' | 'rules' | 'quotes'
const LIB_KINDS: LibKind[] = ['habits', 'models', 'rules', 'quotes']

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const readAll = (kind: LibKind) =>
    listMds(kind).map((f) => ({ slug: f.replace(/\.mdx?$/, ''), file: f, ...readEntry(kind, f).data }))
  return json({
    ok: true,
    habits: readAll('habits'),
    models: readAll('models'),
    rules: readAll('rules'),
    quotes: readAll('quotes'),
  })
}

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  const kind = String(body.kind ?? '') as LibKind
  if (!LIB_KINDS.includes(kind)) return error('invalid kind')
  const slug = typeof body.slug === 'string' && body.slug ? sanitizeSlug(body.slug) : ''

  if (action === 'save') {
    if (kind === 'habits') {
      const s = slug || sanitizeSlug(String(body.name ?? 'untitled'))
      if (!s) return error('need a name')
      const data: Record<string, unknown> = {
        name: String(body.name ?? s),
        ...(body.emoji ? { emoji: String(body.emoji) } : {}),
        ...(body.color ? { color: String(body.color) } : {}),
        ...(body.description ? { description: String(body.description) } : {}),
        kind: body.type === 'count' ? 'count' : 'bool',
        ...(body.type === 'count' && body.target != null && Number(body.target) > 0 ? { target: Number(body.target) } : {}),
        category: String(body.category ?? 'general'),
        order: Number(body.order ?? 0),
        active: body.active !== false,
      }
      writeEntry('habits', `${s}.md`, data, '')
      addChange('library', `habit ${s}`)
      return json({ ok: true, slug: s })
    }
    if (kind === 'models') {
      const s = slug || sanitizeSlug(String(body.name ?? 'untitled'))
      if (!s) return error('need a name')
      const data: Record<string, unknown> = {
        name: String(body.name ?? s),
        ...(body.premise ? { premise: String(body.premise) } : {}),
        rules: Array.isArray(body.rules)
          ? body.rules.filter((r: unknown) => r != null).map(String).filter((r: string) => r.trim())
          : [],
        status: ['active', 'paused', 'retired'].includes(String(body.status)) ? String(body.status) : 'active',
        order: Number(body.order ?? 0),
      }
      writeEntry('models', `${s}.md`, data, '')
      addChange('library', `model ${s}`)
      return json({ ok: true, slug: s })
    }
    if (kind === 'rules') {
      const title = String(body.title ?? '').trim()
      if (!title) return error('rule text is required')
      const s = slug || sanitizeSlug(title.slice(0, 40))
      if (!s) return error('need a rule')
      writeEntry('rules', `${s}.md`, { title }, '')
      addChange('library', `rule ${s}`)
      return json({ ok: true, slug: s })
    }
    // quotes
    const text = String(body.text ?? '').trim()
    if (!text) return error('quote text is required')
    const s = slug || sanitizeSlug(text.slice(0, 40))
    if (!s) return error('need a quote')
    const data: Record<string, unknown> = {
      text,
      ...(body.author ? { author: String(body.author) } : {}),
    }
    writeEntry('quotes', `${s}.md`, data, '')
    addChange('library', `quote ${s}`)
    return json({ ok: true, slug: s })
  }

  if (action === 'delete') {
    if (!slug) return error('invalid slug')
    deleteEntry(kind, `${slug}.md`)
    addChange('library', `${kind.slice(0, -1)} ${slug} deleted`)
    return json({ ok: true })
  }

  return error('unknown action')
}
