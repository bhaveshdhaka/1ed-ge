import { sessionOk, sessionCookie, constantTimeEqual } from './webauthn'
import { env } from './env'

export { sessionOk }

/** Admin API gate: the passkey session cookie must be present + valid. */
export function requireSession(request: Request) {
  if (!sessionOk(request)) return error('unauthorized', 401)
  return null
}

export function setupKeyOk(given: string | null): boolean {
  if (!given) return false
  return constantTimeEqual(given, env.adminSecret())
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export function error(msg: string, status = 400) {
  return json({ ok: false, error: msg }, status)
}

export { sessionCookie }
