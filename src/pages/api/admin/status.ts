import path from 'node:path'
import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { env } from '../../../lib/env'
import { listMds, listMedia } from '../../../lib/content'
import { cmeToday } from '../../../lib/sessions'
import { getPending, getRebuilds } from '../../../lib/changes'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const today = cmeToday()

  let todayDay: Record<string, unknown> | null = null
  try {
    const { readEntry } = await import('../../../lib/content')
    if (listMds('days').includes(`${today}.md`)) {
      todayDay = (readEntry('days', `${today}.md`).data as Record<string, unknown>) ?? null
    }
  } catch {}

  let build = null
  try {
    const fs = await import('node:fs')
    build = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'build.json'), 'utf8'))
  } catch {}

  const tradesToday = Array.isArray(todayDay?.trades) ? (todayDay!.trades as unknown[]).length : 0
  const habitsDone = (d: Record<string, unknown> | null) => {
    const h = d?.habits as Record<string, boolean> | undefined
    return h ? Object.values(h).filter(Boolean).length : 0
  }

  return json({
    ok: true,
    env: {
      adminSecretSet: !!env.adminSecret(),
      openrouterKeySet: !!env.openrouterKey(),
      modelStructure: env.modelStructure(),
      modelVision: env.modelVision(),
    },
    today,
    counts: {
      days: listMds('days').length,
      todayTrades: tradesToday,
      journal: listMds('journal').length,
      habits: listMds('habits').length,
      accounts: listMds('accounts').length,
      payouts: listMds('payouts').length,
      coach: listMds('coach').length,
      media: listMedia().length,
    },
    todayDay,
    habitsDoneToday: habitsDone(todayDay),
    journalToday: listMds('journal').includes(`${today}.mdx`),
    build,
    pending: getPending(),
    rebuilds: getRebuilds(),
  })
}
