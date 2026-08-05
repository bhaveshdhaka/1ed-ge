import { env } from './env'

export function authorized(request: Request): boolean {
  const given = request.headers.get('x-admin-secret') ?? ''
  const expected = env.adminSecret()
  if (!expected || !given) return false
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function error(msg: string, status = 400) {
  return json({ ok: false, error: msg }, status)
}
