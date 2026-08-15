import type { APIRoute } from 'astro'

export const prerender = false

/** Public liveness probe — answers "is the app up" with a static OK and no data, no auth. */
export const GET: APIRoute = () =>
  new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
