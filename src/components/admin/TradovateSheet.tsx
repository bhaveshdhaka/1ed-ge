import { useMemo, useRef, useState } from 'react'
import { api, fileToDataUrl } from './api'
import { Button, Select, TextInput } from './ui'
import { ImageDropZone } from './ImageDropZone'
import { SheetFrame } from './SheetFrame'
import { tradovateImported, tradovateNeedsStop, TRADOVATE_EXCURSION_NOTE, tradovateUpdated } from '../../lib/copy'
import { useLegacyTable, legacyCreateColumnHelper } from '@tanstack/react-table/legacy'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { flexRender } from '@tanstack/react-table'

interface TradovateAccountRow {
  platformId: string | null
  internalId: string | null
  confirmed: boolean
  qty: number
  pnl: number
}

interface TradovateEntry {
  key: string
  market: string
  direction: 'long' | 'short'
  entry: number
  exit: number
  points: number
  start?: string
  end?: string
  qty: number
  pnl: number
  accounts: TradovateAccountRow[]
  stop: number | null
  stopSource: 'recorded' | 'mental' | null
  mentalStop: number | null
  needsStop: boolean
  riskPoints: number | null
  exitType: 'market' | 'limit' | 'stop' | 'stoplimit' | 'unknown'
  mae: number | null
  mfe: number | null
  dup: boolean
}

/** The persisted day-record shape — what DayWorkspace's ledger panel reads. */
export type TradovateLedgerEntry = TradovateEntry

interface AliasProposal {
  platformId: string
  candidates: string[]
  suggested: string | null
}

interface TradovateResult {
  date: string
  trades: TradovateEntry[]
  aliasProposals: AliasProposal[]
  unlinkedPlatformIds: string[]
  skippedFiles: string[]
  dupeCount: number
}

interface ImportState {
  busy: boolean
  result: TradovateResult | null
  approved: Record<number, boolean>
  mentalByIndex: Record<number, string>
  links: Record<string, string>
}

interface TradovateSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  notify: (m: string, ok?: boolean) => void
  markDirty: () => void
  date: string
  onImported: (date: string) => Promise<void>
}

const helper = legacyCreateColumnHelper<TradovateEntry>()

/** Tradovate CSV import — one export set per account (Performance / Position
 * History / Orders), mapped to accounts incl. copies, with honest MAE/MFE and
 * the mental-SL prompt for stop-less positions. Cash History is skipped. */
export function TradovateSheet(props: TradovateSheetProps) {
  const [state, setState] = useState<ImportState>({
    busy: false,
    result: null,
    approved: {},
    mentalByIndex: {},
    links: {},
  })
  const applyingRef = useRef(false)

  const knownAccounts = useMemo(() => {
    if (!state.result) return []
    const set = new Set<string>()
    for (const t of state.result.trades) {
      for (const a of t.accounts) if (a.internalId) set.add(a.internalId)
    }
    for (const p of state.result.aliasProposals) for (const c of p.candidates) set.add(c)
    return Array.from(set).sort()
  }, [state.result])

  const onIngestFiles = async (files: File[]) => {
    setState((s) => ({ ...s, busy: true }))
    try {
      const filePayloads = await Promise.all(
        files.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) })),
      )
      const res = await api<{ ok: boolean; result: TradovateResult }>('/api/admin/tradovate', {
        method: 'POST',
        body: { files: filePayloads, date: props.date },
      })
      const approved: Record<number, boolean> = {}
      const mentalByIndex: Record<number, string> = {}
      res.result.trades.forEach((t, i) => {
        approved[i] = !t.dup // re-imports stay unchecked — the ledger edits those
        mentalByIndex[i] = t.stop != null ? String(t.stop) : t.mentalStop != null ? String(t.mentalStop) : ''
      })
      const links: Record<string, string> = {}
      for (const p of res.result.aliasProposals) {
        if (p.platformId && p.suggested) links[p.platformId] = p.suggested
      }
      setState({ busy: false, result: res.result, approved, mentalByIndex, links })
      props.notify(
        `parsed ${res.result.trades.length} round trips${res.result.dupeCount ? ` · ${res.result.dupeCount} already imported` : ''}`,
      )
    } catch (e) {
      setState({ busy: false, result: null, approved: {}, mentalByIndex: {}, links: {} })
      props.notify(e instanceof Error ? e.message : 'import failed', false)
    }
  }

  const setApproved = (i: number, v: boolean) => {
    setState((s) => ({ ...s, approved: { ...s.approved, [i]: v } }))
  }
  const setMental = (i: number, v: string) => {
    setState((s) => ({ ...s, mentalByIndex: { ...s.mentalByIndex, [i]: v } }))
  }
  const setLink = (platformId: string, internalId: string) => {
    setState((s) => ({ ...s, links: { ...s.links, [platformId]: internalId } }))
  }

  /** R preview: recorded stop, else the typed mental SL, else nothing. */
  const riskOf = (t: TradovateEntry, i: number): number | null => {
    const raw = state.mentalByIndex[i]
    const stop = raw !== '' && raw != null ? Number(raw) : t.stop
    if (stop == null || !Number.isFinite(stop)) return t.riskPoints
    return Math.abs(t.entry - stop)
  }

  const apply = async () => {
    const result = state.result
    if (!result || applyingRef.current) return
    applyingRef.current = true
    setState((s) => ({ ...s, busy: true }))
    try {
      const approved: TradovateEntry[] = []
      result.trades.forEach((t, i) => {
        if (!state.approved[i]) return
        const raw = state.mentalByIndex[i]
        const mentalStop = raw !== '' && raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null
        approved.push({ ...t, mentalStop, dup: false })
      })
      if (approved.length === 0) {
        setState((s) => ({ ...s, busy: false }))
        props.notify('no trades selected to import', false)
        return
      }
      const platformLinks = Object.entries(state.links)
        .filter(([platformId, internalId]) => Boolean(platformId && internalId) && result.unlinkedPlatformIds.includes(platformId))
        .map(([platformId, internalId]) => ({ platformId, internalId }))
      const res = await api<{ ok: boolean; imported: number; updated: number; linksApplied: number; stored: number }>(
        '/api/admin/tradovate/apply',
        {
          method: 'POST',
          body: { date: props.date, trades: approved, platformLinks },
        },
      )
      props.markDirty()
      props.notify(
        `${tradovateImported(res.imported)}${res.updated ? ` · ${tradovateUpdated(res.updated)}` : ''}`,
      )
      await props.onImported(props.date)
      setState({ busy: false, result: null, approved: {}, mentalByIndex: {}, links: {} })
    } catch (e) {
      setState((s) => ({ ...s, busy: false }))
      props.notify(e instanceof Error ? e.message : 'apply failed', false)
    } finally {
      applyingRef.current = false
    }
  }

  const approvedCount = state.result ? state.result.trades.filter((_, i) => state.approved[i]).length : 0
  const needsStopCount = state.result ? state.result.trades.filter((_, i) => state.approved[i] && (state.result?.trades[i].needsStop ?? false)).length : 0
  const needsStopTotal = state.result ? state.result.trades.filter((t) => t.needsStop).length : 0

  const columns = useMemo(
    () =>
      [
        helper.display({
          id: 'approve',
          header: () => (
            <input
              type="checkbox"
              aria-label="approve all"
              checked={state.result ? state.result.trades.every((_, i) => state.approved[i]) : false}
              onChange={(e) => {
                if (!state.result) return
                const v = e.target.checked
                setState((s) => ({
                  ...s,
                  approved: Object.fromEntries(s.result?.trades.map((_, i) => [i, v]) ?? []),
                }))
              }}
              className="h-4 w-4 accent-accent"
            />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              aria-label={`approve round trip ${row.index + 1}`}
              checked={!!state.approved[row.index]}
              onChange={(e) => setApproved(row.index, e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          ),
        }),
        helper.accessor((t) => t.market, {
          id: 'market',
          header: 'market',
          cell: ({ row }) => (
            <span className="text-ink">
              {row.original.direction === 'long' ? '▲' : '▼'} {row.original.market}
            </span>
          ),
        }),
        helper.accessor((t) => `${t.entry}→${t.exit}`, {
          id: 'entry-exit',
          header: 'entry→exit',
          cell: (info) => <span className="tabular-nums">{String(info.getValue())}</span>,
        }),
        helper.accessor((t) => t.points, {
          id: 'pts',
          header: 'pts',
          cell: ({ getValue }) => {
            const pts = Number(getValue())
            return (
              <span className={`tabular-nums ${pts >= 0 ? 'text-up' : 'text-down'}`}>{pts >= 0 ? '+' : ''}{pts}</span>
            )
          },
        }),
        helper.accessor((t) => t.accounts.map((a) => a.internalId ?? a.platformId ?? '').join(','), {
          id: 'accounts',
          header: 'accounts',
          cell: ({ row }) => {
            const accs = row.original.accounts
            if (!accs.length) return <span className="text-warn">—</span>
            return (
              <span className="flex flex-wrap gap-1">
                {accs.map((a, i) => (
                  <span
                    key={i}
                    className={`border px-1 py-0.5 font-mono text-3xs ${a.internalId ? 'border-line text-dim' : 'border-warn/50 text-warn'}`}
                  >
                    {a.internalId ?? a.platformId ?? '—'}
                    {a.platformId && !a.internalId ? ' ?' : ''}
                  </span>
                ))}
              </span>
            )
          },
        }),
        helper.accessor((t) => t.stop, {
          id: 'sl',
          header: 'SL',
          cell: ({ row }) => {
            const t = row.original
            if (!t.needsStop) {
              return (
                <span className={`tabular-nums text-dim ${t.stopSource === 'mental' ? 'italic' : ''}`}>
                  {t.stop}
                  {t.stopSource === 'recorded' ? ' ↯' : t.stopSource === 'mental' ? ' ✎' : ''}
                </span>
              )
            }
            return (
              <div className="flex items-center gap-1">
                <TextInput
                  type="number"
                  step="0.25"
                  value={state.mentalByIndex[row.index] ?? ''}
                  onChange={(e) => setMental(row.index, e.target.value)}
                  placeholder="mental SL"
                  aria-label={`mental stop for round trip ${row.index + 1}`}
                  className={`w-20 px-1.5 py-1 text-2xs ${t.needsStop ? 'border-warn/60' : ''}`}
                />
                <span className="border border-warn/50 px-1 py-0.5 text-3xs uppercase tracking-wide text-warn">SL?</span>
              </div>
            )
          },
        }),
        helper.accessor((t) => t.points, {
          id: 'r',
          header: 'R',
          cell: ({ row }) => {
            const risk = riskOf(row.original, row.index)
            const r = risk != null && risk > 0 ? row.original.points / risk : null
            if (r == null) return <span className="text-faint">—</span>
            return (
              <span className={`tabular-nums ${row.original.points > 0 ? 'text-up' : row.original.points < 0 ? 'text-down' : 'text-dim'}`}>
                {r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0')}
              </span>
            )
          },
        }),
        helper.accessor((t) => t.mae, {
          id: 'mae',
          header: 'mae',
          cell: ({ row }) => {
            const m = row.original.mae
            const exact = row.original.exitType === 'stop'
            if (m == null) return <span className="text-faint">—</span>
            return (
              <span className={`tabular-nums ${exact ? 'text-ink' : 'text-dim'}`}>
                {exact ? '' : '≥'}{m}
              </span>
            )
          },
        }),
        helper.accessor((t) => t.mfe, {
          id: 'mfe',
          header: 'mfe',
          cell: ({ row }) => {
            const m = row.original.mfe
            if (m == null) return <span className="text-faint">—</span>
            return <span className="tabular-nums text-dim">≥{m}</span>
          },
        }),
        helper.display({
          id: 'dup',
          header: '',
          cell: ({ row }) =>
            row.original.dup ? (
              <span className="border border-line px-1.5 py-0.5 text-3xs uppercase tracking-wide text-warn">imported</span>
            ) : null,
        }),
      ] as LegacyColumnDef<TradovateEntry>[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.result, state.approved, state.mentalByIndex, knownAccounts],
  )

  const table = useLegacyTable({
    data: state.result?.trades ?? [],
    columns,
  })

  if (!props.open) return null
  return (
    <SheetFrame title="tradovate csv import" onClose={() => props.onOpenChange(false)}>
      <ImageDropZone
        accept=".csv"
        onFiles={onIngestFiles}
        label="drop today's tradovate exports — one set per account →"
        helperText="performance · position history · orders · cash history is skipped · parsed in memory, never saved"
        ariaLabel="drop tradovate csv exports to import"
      />
      {state.busy && <div className="mt-3 text-sm text-faint">importing…</div>}

      {state.result && !state.busy && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-dim">
            <span>
              {state.result.trades.length} round trips
              {state.result.dupeCount > 0 && <span className="ml-2 text-faint">({state.result.dupeCount} already imported)</span>}
            </span>
            <span className="text-faint">{state.result.date}</span>
          </div>

          {state.result.skippedFiles.length > 0 && (
            <div className="border border-line bg-bg p-2 text-2xs text-faint">
              skipped: {state.result.skippedFiles.join(', ')}
            </div>
          )}

          {needsStopTotal > 0 && (
            <div className="border border-warn/50 bg-bg p-3 text-xs text-warn">
              {tradovateNeedsStop(needsStopTotal)} — the CSVs carry no stop for these; type the line you had in mind (even a mental one).
            </div>
          )}

          {state.result.aliasProposals.map((p) => (
            <div key={p.platformId || 'unattributed'} className="border border-line bg-bg p-3">
              <div className="mb-2 text-xs text-ink">
                {p.platformId ? (
                  <>
                    unknown platform id <span className="font-mono text-accent">{p.platformId}</span> — link to:
                  </>
                ) : (
                  <span>
                    some round trips carry no account column — link to:
                  </span>
                )}
              </div>
              <Select
                value={state.links[p.platformId] ?? p.suggested ?? ''}
                onChange={(e) => setLink(p.platformId, e.target.value)}
                className="w-full"
              >
                <option value="">— skip —</option>
                {p.candidates.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          ))}

          <div className="overflow-x-auto border border-line">
            <table className="w-full text-left text-2xs">
              <thead className="sticky top-0 bg-panel">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-line">
                    {hg.headers.map((h) => (
                      <th key={h.id} className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 hover:bg-raise/40">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-2 py-4 text-center text-faint">
                      no round trips found — need performance or position history exports
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-2xs text-faint">{TRADOVATE_EXCURSION_NOTE}</p>

          <div className="flex items-center justify-between border-t border-line pt-2">
            <span className="text-xs text-dim">
              {approvedCount} selected{needsStopCount > 0 && <span className="ml-2 text-warn">· {needsStopCount} SL?</span>}
            </span>
            <Button onClick={apply} disabled={approvedCount === 0 || state.busy}>
              apply {approvedCount} round trips →
            </Button>
          </div>
        </div>
      )}
    </SheetFrame>
  )
}
