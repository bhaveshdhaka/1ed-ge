import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase()
  const journal = await getCollection('journal')
  if (!q) {
    return new Response(JSON.stringify({ total: journal.length, ids: journal.map((j) => j.id), q }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }
  const ids: string[] = []
  for (const j of journal) {
    const hay = [j.data.date, j.data.day ?? '', j.data.summary ?? '', (j.data.tags ?? []).join(' '), j.body ?? '']
      .join(' ')
      .toLowerCase()
    if (hay.includes(q)) ids.push(j.id)
  }
  return new Response(JSON.stringify({ total: journal.length, ids, q }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
