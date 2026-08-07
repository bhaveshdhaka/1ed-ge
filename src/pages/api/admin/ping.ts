import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { touchLive } from '../../../lib/live'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  touchLive()
  return json({ ok: true, live: true })
}
