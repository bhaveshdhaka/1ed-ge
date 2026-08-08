import type { APIRoute } from 'astro'
import { json } from '../../../lib/auth'
import { deleteSession } from '../../../lib/passkeys'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? ''
  const m = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith('zen_session='))
  if (m) deleteSession(m.slice('zen_session='.length))
  return json({ ok: true }, 200, { 'Set-Cookie': 'zen_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' })
}
