import type { APIRoute } from 'astro'
import { json, error, setupKeyOk } from '../../../lib/auth'
import { registerBegin, registerVerify, issueSession, sessionCookieHeader } from '../../../lib/webauthn'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { key?: string; nonce?: string; credential?: unknown } | null
  if (!body || !setupKeyOk(body.key ?? null)) return error('unauthorized', 401)

  // verify phase (has nonce + credential) or begin phase
  if (body.nonce && body.credential) {
    // registerVerify throws on challenge/origin/RPID mismatch + malformed
    // credentials — surface as a clean 400 instead of an unhandled rejection.
    let ok = false
    try {
      ok = await registerVerify(body.nonce, body.credential as never)
    } catch {
      return error('registration failed', 400)
    }
    if (!ok) return error('registration failed', 400)
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieHeader(issueSession()) })
  }

  // registerBegin can throw too (e.g. corrupted credential id in the store) —
  // same clean 400 instead of an unhandled rejection.
  let begun: Awaited<ReturnType<typeof registerBegin>> | null = null
  try {
    begun = await registerBegin()
  } catch {
    return error('registration failed', 400)
  }
  return json({ ok: true, options: begun.options, nonce: begun.nonce })
}
