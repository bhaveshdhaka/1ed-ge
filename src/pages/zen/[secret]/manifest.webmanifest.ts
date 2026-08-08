import type { APIRoute } from 'astro'
import { env } from '../../../lib/env'

export const prerender = false

// Zen-scoped PWA manifest, served only for the valid admin secret — the same
// exposure as the /zen/<secret> page itself (the secret already rides in every
// request URL). Lets the owner "Add to Home Screen" / install zen as a
// standalone PWA that launches straight into the private desk: start_url and
// scope are both the zen mount path. The public global /manifest.webmanifest
// and public/sw.js stay untouched (the SW keeps skipping /zen — no offline
// admin; install works without SW coverage).
export const GET: APIRoute = async ({ params }) => {
  const { secret } = params
  const expected = env.adminSecret()
  if (secret !== expected) {
    return new Response('not found', { status: 404 })
  }
  const mount = `/zen/${secret}/`
  const manifest = {
    name: 'zen — 1ed.ge',
    short_name: 'zen',
    description: 'zen — the private trading desk of 1ed.ge',
    start_url: mount,
    scope: mount,
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
