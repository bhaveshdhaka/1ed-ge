import type { APIRoute } from 'astro'
import { sessionOk } from '../../lib/auth'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  if (!sessionOk(request)) return new Response('unauthorized', { status: 401 })
  const manifest = {
    name: 'admin — 1ed.ge',
    short_name: 'admin',
    description: 'admin — the trading desk of 1ed.ge',
    start_url: '/zen/',
    scope: '/zen/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#0a0a0c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  })
}
