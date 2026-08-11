import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { touchLive } from '../../../lib/live'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  // Heartbeat: refreshes the 5-min live window.
  // Writes to data/live.json (bind-mounted, persists across container restarts).
  touchLive()
  return json({ ok: true, live: true })
}
