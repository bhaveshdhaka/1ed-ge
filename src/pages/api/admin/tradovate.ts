import type { APIRoute } from 'astro'
import { requireSession, json, error } from '../../../lib/auth'
import { decodeDataUrl, type IngestFile } from '../../../lib/ingest'
import { buildTradovateResult, parseTradovateCsvText, type TradovateImportResult } from '../../../lib/tradovate'
import { listMds, readEntry } from '../../../lib/content'

export const prerender = false

/** Internal accounts for attribution (id + platformIds) — mirrors ingest.ts. */
function listAccountCtx(): { id: string; platformIds: string[] }[] {
  return listMds('accounts').map((f) => {
    const data = readEntry('accounts', f).data as Record<string, unknown>
    return {
      id: String(data.id ?? f.replace(/\.md$/, '')),
      platformIds: Array.isArray(data.platformIds)
        ? (data.platformIds as unknown[]).filter((p): p is string => typeof p === 'string')
        : [],
    }
  })
}

/** Keys already stored in the day's private draft.tradovate (re-import dups). */
function existingKeys(date: string): string[] {
  if (!listMds('days').includes(`${date}.md`)) return []
  const data = readEntry('days', `${date}.md`).data as Record<string, unknown>
  const draft = (data.draft as Record<string, unknown> | undefined) ?? {}
  const tv = draft.tradovate
  return Array.isArray(tv) ? (tv as { key?: unknown }[]).map((t) => String(t?.key ?? '')).filter(Boolean) : []
}

/**
 * POST /api/admin/tradovate — parse daily Tradovate CSVs (one export set per
 * account) into attributed round trips with honest MAE/MFE + SL status.
 * Body: { files: [{ name, dataUrl }], date? } → { ok, result: TradovateImportResult }.
 * Cash History and unrecognised files are reported in `skippedFiles`, never parsed.
 */
export const POST: APIRoute = async ({ request }) => {
  if (requireSession(request)) return error('unauthorized', 401)
  const body = await request.json().catch(() => ({}))
  const files: IngestFile[] = Array.isArray(body.files)
    ? body.files.filter(
        (f: unknown) =>
          f && typeof (f as { dataUrl?: unknown }).dataUrl === 'string' && typeof (f as { name?: unknown }).name === 'string',
      )
    : []
  if (!files.length) return error('no files provided')

  const perf: ReturnType<typeof parseTradovateCsvText>['perf'] = []
  const pos: ReturnType<typeof parseTradovateCsvText>['pos'] = []
  const orders: ReturnType<typeof parseTradovateCsvText>['orders'] = []
  const skippedFiles: string[] = []

  for (const file of files) {
    const { buf } = decodeDataUrl(file.dataUrl)
    const parsed = parseTradovateCsvText(buf.toString('utf8'))
    if (parsed.kind === 'performance') perf.push(...parsed.perf)
    else if (parsed.kind === 'position') pos.push(...parsed.pos)
    else if (parsed.kind === 'orders') orders.push(...parsed.orders)
    else skippedFiles.push(file.name) // Cash History + anything unrecognised
  }

  const accounts = listAccountCtx()
  const existing = body.date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? existingKeys(String(body.date)) : []
  const result: TradovateImportResult = buildTradovateResult(perf, pos, orders, {
    accounts,
    existingKeys: existing,
  })
  result.skippedFiles = skippedFiles
  return json({ ok: true, result })
}
