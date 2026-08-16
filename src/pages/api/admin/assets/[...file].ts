import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'
import { sessionOk } from '../../../../lib/auth'
import { CONTENT } from '../../../../lib/paths'

export const prerender = false

/**
 * Auth-gated asset serving for routine media (audio, ICS, etc.).
 * Files under content/assets/ are accessible with a valid session cookie.
 */
const ASSETS_DIR = path.join(CONTENT, 'assets')

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ics': 'text/calendar',
  '.json': 'application/json',
}

export const GET: APIRoute = async ({ params, request }) => {
  if (!sessionOk(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const rel = params.file ?? ''
  const abs = path.resolve(ASSETS_DIR, rel)

  if (!abs.startsWith(path.resolve(ASSETS_DIR) + path.sep) && abs !== path.resolve(ASSETS_DIR)) {
    return new Response('not found', { status: 404 })
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response('not found', { status: 404 })
  }

  const mime = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream'
  const stream = fs.createReadStream(abs)
  return new Response(stream as unknown as BodyInit, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
