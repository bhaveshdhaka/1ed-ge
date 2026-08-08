import type { APIRoute } from 'astro'
import { json } from '../../../lib/auth'
import { hasPasskeys, sessionOk } from '../../../lib/webauthn'

export const prerender = false

export const GET: APIRoute = async ({ request }) =>
  json({ ok: true, hasPasskeys: hasPasskeys(), authed: sessionOk(request) })
