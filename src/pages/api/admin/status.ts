import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { env } from '../../../lib/env'
import { listMds, listMedia } from '../../../lib/content'
import { todayKey } from '../../../lib/habits'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const today = todayKey()

  const trades = listMds('trades')
  const todayTrades = trades.filter((f) => f.startsWith(`${today}-`))

  let todayLog: Record<string, unknown> | null = null
  try {
    const { readEntry } = await import('../../../lib/content')
    if (listMds('habitLog').includes(`${today}.md`)) {
      todayLog = (readEntry('habitLog', `${today}.md`).data as Record<string, unknown>) ?? null
    }
  } catch {}

  let build = null
  try {
    const fs = await import('node:fs')
    build = JSON.parse(fs.readFileSync('/tmp/1edge-build.json', 'utf8'))
  } catch {}

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
      trades: trades.length,
      todayTrades: todayTrades.length,
      journal: listMds('journal').length,
      habits: listMds('habits').length,
      habitDays: listMds('habitLog').length,
      media: listMedia().length,
    },
    journalToday: listMds('journal').includes(`${today}.mdx`),
    todayLog,
    build,
  })
}
