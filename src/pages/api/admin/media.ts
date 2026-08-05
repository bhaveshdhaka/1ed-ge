import type { APIRoute } from 'astro'
import path from 'node:path'
import fs from 'node:fs'
import sharp from 'sharp'
import { authorized, json, error } from '../../../lib/auth'
import { MEDIA, listMedia, sanitizeSlug } from '../../../lib/content'

export const prerender = false

function safeMediaPath(rel: string): string | null {
  const abs = path.resolve(MEDIA, rel)
  if (!abs.startsWith(path.resolve(MEDIA) + path.sep)) return null
  return abs
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  return json({ ok: true, media: listMedia() })
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const dataUrl = String(body.dataUrl ?? '')
  const match = dataUrl.match(/^data:image\/([a-z0-9+.-]+);base64,(.+)$/)
  if (!match) return error('expected a base64 data URL (image)')

  const buf = Buffer.from(match[2], 'base64')
  if (!buf.length) return error('empty image')

  const date = new Date().toISOString().slice(0, 10)
  const base = sanitizeSlug(path.parse(String(body.name ?? 'image')).name) || 'image'
  const dir = path.join(MEDIA, date)
  fs.mkdirSync(dir, { recursive: true })

  const rel = `${date}/${base}-${Date.now().toString(36)}.webp`
  const out = path.join(MEDIA, rel)
  try {
    await sharp(buf).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out)
  } catch {
    const ext = match[1].includes('png') ? 'png' : match[1].includes('gif') ? 'gif' : 'jpg'
    const rel2 = `${date}/${base}-${Date.now().toString(36)}.${ext}`
    fs.writeFileSync(path.join(MEDIA, rel2), buf)
    return json({ ok: true, url: `/media/${rel2}`, path: rel2 })
  }
  return json({ ok: true, url: `/media/${rel}`, path: rel })
}

export const DELETE: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const rel = String(body.path ?? '')
  const abs = safeMediaPath(rel)
  if (!abs) return error('invalid path')
  if (fs.existsSync(abs)) fs.unlinkSync(abs)
  return json({ ok: true })
}
