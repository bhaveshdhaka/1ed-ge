import type { APIRoute } from 'astro'
import { json } from '../../../lib/auth'
import { hasPasskeys, sessionPresent } from '../../../lib/webauthn'

export const prerender = false

export const GET: APIRoute = async ({ request }) =>
  json({ ok: true, hasPasskeys: hasPasskeys(), authed: sessionPresent(request) })
