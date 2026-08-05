import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'
import { MEDIA } from '../../lib/content'

export const prerender = false

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}

export const GET: APIRoute = async ({ params }) => {
  const rel = params.file ?? ''
  const abs = path.resolve(MEDIA, rel)
  if (!abs.startsWith(path.resolve(MEDIA) + path.sep)) {
    return new Response('not found', { status: 404 })
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response('not found', { status: 404 })
  }
  const mime = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream'
  const stream = fs.createReadStream(abs)
  return new Response(stream as unknown as BodyInit, {
    headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
