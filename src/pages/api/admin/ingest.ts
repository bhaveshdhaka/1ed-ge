import type { APIRoute } from 'astro'
import { authorized, json, error } from '../../../lib/auth'
import { ingestFiles } from '../../../lib/ingest'
import type { IngestFile } from '../../../lib/ingest'
import { listMds, readEntry } from '../../../lib/content'

export const prerender = false

/**
 * Internal accounts for the ingest ctx: id + contract + size + platformIds.
 * `platformIds` is read straight from each account's frontmatter (Task 1 added
 * the schema field + save whitelist) so `resolveAlias` inside `ingestFiles`
 * can match Tradovate platform ids (`LTE…`) to internal accounts.
 */
function listAccountCtx(): { id: string; contract?: string; size?: number; platformIds: string[] }[] {
  return listMds('accounts').map((f) => {
    const data = readEntry('accounts', f).data as Record<string, unknown>
    return {
      id: String(data.id ?? f.replace(/\.md$/, '')),
      ...(typeof data.contract === 'string' && data.contract ? { contract: data.contract } : {}),
      ...(typeof data.size === 'number' && Number.isFinite(data.size) ? { size: data.size } : {}),
      platformIds: Array.isArray(data.platformIds)
        ? (data.platformIds as unknown[]).filter((p): p is string => typeof p === 'string')
        : [],
    }
  })
}

/** Existing day trades (dedup baseline) — [] when the day file doesn't exist yet. */
function dayTrades(date: string): { market: string; direction: string; entry: number; exit: number }[] {
  if (!listMds('days').includes(`${date}.md`)) return []
  const data = readEntry('days', `${date}.md`).data as Record<string, unknown>
  return Array.isArray(data.trades) ? (data.trades as { market: string; direction: string; entry: number; exit: number }[]) : []
}

/**
 * POST /api/admin/ingest — parse files into trade proposals.
 * Body: { files: [{ name, dataUrl }], date? } → { ok, result: IngestResult }.
 * Errors (bad data URL, pdftotext missing, model parse) surface as 400-style
 * `error(...)` messages.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const files: IngestFile[] = Array.isArray(body.files)
    ? body.files.filter(
        (f: unknown) =>
          f && typeof (f as { dataUrl?: unknown }).dataUrl === 'string' && typeof (f as { name?: unknown }).name === 'string',
      )
    : []
  if (!files.length) return error('no files provided')
  const accounts = listAccountCtx()
  const existing = body.date ? dayTrades(String(body.date)) : []
  try {
    const result = await ingestFiles(files, { accounts, existingTrades: existing })
    return json({ ok: true, result })
  } catch (e) {
    return error(e instanceof Error ? e.message : 'ingest failed')
  }
}
