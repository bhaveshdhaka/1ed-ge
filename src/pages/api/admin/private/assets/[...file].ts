import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'
import { sessionOk } from '../../../../../lib/auth'
import { CONTENT } from '../../../../../lib/paths'

export const prerender = false

/**
 * Auth-gated private asset serving.
 * Only files under content/private/assets/ are accessible, and only with a valid session cookie.
 * Replaces the old public/private/ unauthenticated HTTP 200.
 */
const PRIVATE_DIR = path.join(CONTENT, 'private', 'assets')

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
  // Auth gate — must have a valid passkey session cookie
  if (!sessionOk(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const rel = params.file ?? ''
  const abs = path.resolve(PRIVATE_DIR, rel)

  // Directory traversal protection
  if (!abs.startsWith(path.resolve(PRIVATE_DIR) + path.sep) && abs !== path.resolve(PRIVATE_DIR)) {
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
