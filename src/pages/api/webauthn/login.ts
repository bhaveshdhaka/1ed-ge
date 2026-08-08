import type { APIRoute } from 'astro'
import { json, error } from '../../../lib/auth'
import { loginBegin, loginVerify, issueSession, sessionCookie } from '../../../lib/webauthn'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { nonce?: string; credential?: unknown } | null

  if (body?.nonce && body.credential) {
    // loginVerify throws on challenge/origin/RPID mismatch, unknown credential
    // and counter rollback — surface as a clean 401 instead of a 500.
    let ok = false
    try {
      ok = await loginVerify(body.nonce, body.credential as never)
    } catch {
      return error('authentication failed', 401)
    }
    if (!ok) return error('authentication failed', 401)
    const token = issueSession()
    const { value, opts } = sessionCookie(token)
    return json({ ok: true }, 200, { 'Set-Cookie': `${'zen_session'}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${opts.maxAge}` })
  }

  const begun = await loginBegin()
  if (!begun) return error('no passkey registered — use /zen/setup', 400)
  return json({ ok: true, options: begun.options, nonce: begun.nonce })
}
