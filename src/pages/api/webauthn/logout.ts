import type { APIRoute } from 'astro'
import { json } from '../../../lib/auth'
import { deleteSession } from '../../../lib/passkeys'
import { COOKIE } from '../../../lib/webauthn'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get('cookie') ?? ''
  const m = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))
  if (m) deleteSession(m.slice(COOKIE.length + 1))
  return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` })
}
