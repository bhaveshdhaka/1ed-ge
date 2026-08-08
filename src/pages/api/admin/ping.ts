import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { touchLive } from '../../../lib/live'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  // Heartbeat: refreshes the 5-min live window AND writes the durable
  // last-online stamp (public/media/.last-online) so the homepage's
  // "last seen" survives container restarts.
  touchLive()
  return json({ ok: true, live: true })
}
