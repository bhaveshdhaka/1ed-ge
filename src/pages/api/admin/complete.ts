import type { APIRoute } from 'astro'
import { requireSession, error } from '../../../lib/auth'
import { orChatStream } from '../../../lib/ai'

export const prerender = false

/** Ghost-text continuation endpoint — streams the AI's continuation of the prose up to the caret. */
export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const text = String(body.text ?? '').slice(-500) // last 500 chars
  if (!text.trim()) return error('empty prompt')

  const stream = orChatStream([
    {
      role: 'system',
      content:
        'Continue the following journal entry in the same voice. Output ONLY the continuation text — no preamble, no commentary. Keep it short (20-40 words).',
    },
    { role: 'user', content: text },
  ])

  return new Response(
    new ReadableStream({
      async start(ctrl) {
        try {
          for await (const chunk of stream) ctrl.enqueue(new TextEncoder().encode(chunk))
          ctrl.close()
        } catch {
          ctrl.close()
        }
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } },
  )
}
