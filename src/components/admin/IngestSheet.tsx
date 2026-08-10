import { useMemo, useRef, useState } from 'react'
import { api, fileToDataUrl } from './api'
import { Button, Select, TextInput } from './ui'
import { ImageDropZone } from './ImageDropZone'
import { SheetFrame } from './SheetFrame'
import { importedTrades } from '../../lib/copy'
import { useLegacyTable, legacyCreateColumnHelper } from '@tanstack/react-table/legacy'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { flexRender } from '@tanstack/react-table'

interface PositionProposal {
  market: string
  direction: 'long' | 'short'
  entry: number
  exit: number
  points: number
  riskPoints: number | null
  size: number
  start: string
  end: string
  fillCount: number
  fingerprint: string
  dup: boolean
  account: { internalId: string | null; platformId: string | null; confirmed: boolean }
}

interface AliasProposal {
  platformId: string
  candidates: string[]
  suggested: string | null
}

interface IngestResult {
  date: string
  proposals: PositionProposal[]
  dupes: number
  aliasProposal: AliasProposal | null
  platformIdsSeen: string[]
}

interface ImportState {
  busy: boolean
  result: IngestResult | null
  approved: Record<number, boolean>
  accountByIndex: Record<number, string>
  riskByIndex: Record<number, string>
  links: Record<string, string>
}

interface IngestSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  notify: (m: string, ok?: boolean) => void
  markDirty: () => void
  date: string
  onImported: (date: string) => Promise<void>
}

const helper = legacyCreateColumnHelper<PositionProposal>()

/** Approve-every-trade import ritual (moved from IngestPanel) wrapped in a Sheet. */
export function IngestSheet(props: IngestSheetProps) {
  const [state, setState] = useState<ImportState>({
    busy: false,
    result: null,
    approved: {},
    accountByIndex: {},
    riskByIndex: {},
    links: {},
  })
  const applyingRef = useRef(false)

  const knownAccounts = useMemo(() => {
    if (!state.result) return []
    const set = new Set<string>()
    for (const p of state.result.proposals) {
      if (p.account.internalId) set.add(p.account.internalId)
    }
    if (state.result.aliasProposal?.candidates) {
      for (const c of state.result.aliasProposal.candidates) set.add(c)
    }
    return Array.from(set).sort()
  }, [state.result])

  const onIngestFiles = async (files: File[]) => {
    setState((s) => ({ ...s, busy: true }))
    try {
      const filePayloads = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          dataUrl: await fileToDataUrl(f),
        })),
      )
      const res = await api<{ ok: boolean; result: IngestResult }>('/api/admin/ingest', {
        method: 'POST',
        body: { files: filePayloads },
      })
      const approved: Record<number, boolean> = {}
      const accountByIndex: Record<number, string> = {}
      const riskByIndex: Record<number, string> = {}
      res.result.proposals.forEach((p, i) => {
        approved[i] = true
        // Seed with the proposal's own attribution ONLY — never the alias
        // suggestion. If the alias suggestion were seeded here, the alias
        // confirm's choice below would be ignored for this batch (per-position
        // seed short-circuits the recompute and apply). The suggested account
        // still applies by default via `links[platformId]` at apply time.
        accountByIndex[i] = p.account.internalId ?? ''
        // Prefill the risk input from the parsed stop when the source had one;
        // empty = the owner fills it manually at apply time.
        riskByIndex[i] = p.riskPoints != null ? String(p.riskPoints) : ''
      })
      const links: Record<string, string> = {}
      if (res.result.aliasProposal?.platformId && res.result.aliasProposal.suggested) {
        links[res.result.aliasProposal.platformId] = res.result.aliasProposal.suggested
      }
      setState({
        busy: false,
        result: res.result,
        approved,
        accountByIndex,
        riskByIndex,
        links,
      })
      props.notify(`parsed ${res.result.proposals.length} proposed trades${res.result.dupes ? ` · ${res.result.dupes} dup` : ''}`)
    } catch (e) {
      // Reset the whole import state so a stale batch's proposals can't be
      // applied after a re-parse fails.
      setState({ busy: false, result: null, approved: {}, accountByIndex: {}, riskByIndex: {}, links: {} })
      props.notify(e instanceof Error ? e.message : 'import failed', false)
    }
  }

  const setApproved = (i: number, v: boolean) => {
    setState((s) => ({ ...s, approved: { ...s.approved, [i]: v } }))
  }

  const setAccount = (i: number, id: string) => {
    setState((s) => ({ ...s, accountByIndex: { ...s.accountByIndex, [i]: id } }))
  }

  const setRisk = (i: number, v: string) => {
    setState((s) => ({ ...s, riskByIndex: { ...s.riskByIndex, [i]: v } }))
  }

  const setLink = (platformId: string, internalId: string) => {
    setState((s) => {
      const links = { ...s.links, [platformId]: internalId }
      return {
        ...s,
        links,
        accountByIndex: Object.fromEntries(
          s.result?.proposals.map((p, i) => {
            // Mirror the apply-time resolution (see apply()) so the per-position
            // selects stay in sync with what will actually be imported: per-position
            // override wins, then the alias-confirm link for the proposal's platform,
            // then the proposal's own attribution, else unlinked.
            const resolved =
              s.accountByIndex[i] ||
              (p.account.platformId ? links[p.account.platformId] : undefined) ||
              p.account.internalId ||
              ''
            return [i, resolved]
          }) ?? [],
        ),
      }
    })
  }

  const apply = async () => {
    const result = state.result
    // Re-entry guard: a double-click must not fire two POST /apply (the button
    // is disabled while busy too; the ref covers the pre-re-render race).
    if (!result || applyingRef.current) return
    applyingRef.current = true
    setState((s) => ({ ...s, busy: true }))
    try {
      const approvedPositions: PositionProposal[] = []
      result.proposals.forEach((p, i) => {
        if (!state.approved[i]) return
        // Per-position override wins, then the alias-confirm link for this
        // proposal's platform, then the proposal's own attribution, else
        // unlinked — a deliberate "— account —" choice falls back to the
        // proposal's own attribution here.
        const internalId =
          state.accountByIndex[i] ||
          (p.account.platformId ? state.links[p.account.platformId] : undefined) ||
          p.account.internalId ||
          ''
        approvedPositions.push({
          ...p,
          account: { ...p.account, internalId },
          // Manual risk input wins; else the parsed stop-derived riskPoints;
          // else null (owner's "add it later" case). Only positive finite
          // values land in the day record (apply-side guard repeats this).
          riskPoints: (() => {
            const riskRaw = state.riskByIndex[i]
            const risk = riskRaw !== '' && riskRaw != null ? Number(riskRaw) : p.riskPoints
            return risk != null && Number.isFinite(risk) && risk > 0 ? risk : null
          })(),
        })
      })
      if (approvedPositions.length === 0) {
        setState((s) => ({ ...s, busy: false }))
        props.notify('no trades selected to import', false)
        return
      }

      // Only persist links that are non-empty AND were seen in this batch.
      const platformLinks = Object.entries(state.links)
        .filter(
          ([platformId, internalId]) =>
            Boolean(platformId && internalId) && result.platformIdsSeen.includes(platformId),
        )
        .map(([platformId, internalId]) => ({ platformId, internalId }))

      const res = await api<{ ok: boolean; dayFile: string; linksApplied: number; imported: number }>(
        '/api/admin/ingest/apply',
        {
          method: 'POST',
          body: { date: props.date, positions: approvedPositions, platformLinks },
        },
      )
      props.markDirty()
      props.notify(importedTrades(res.imported))
      await props.onImported(props.date)
      setState({ busy: false, result: null, approved: {}, accountByIndex: {}, riskByIndex: {}, links: {} })
    } catch (e) {
      setState((s) => ({ ...s, busy: false }))
      props.notify(e instanceof Error ? e.message : 'apply failed', false)
    } finally {
      applyingRef.current = false
    }
  }

  const approvedCount = state.result
    ? state.result.proposals.filter((_, i) => state.approved[i]).length
    : 0

  // ---- TanStack Table v9 (legacy v8-compatible surface) ----
  const columns = useMemo(
    () =>
      [
        helper.display({
          id: 'approve',
          header: () => (
            <input
              type="checkbox"
              aria-label="approve all"
              checked={state.result ? state.result.proposals.every((_, i) => state.approved[i]) : false}
              onChange={(e) => {
                if (!state.result) return
                const v = e.target.checked
                setState((s) => ({
                  ...s,
                  approved: Object.fromEntries(s.result?.proposals.map((_, i) => [i, v]) ?? []),
                }))
              }}
              className="h-4 w-4 accent-accent"
            />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              aria-label={`approve proposed trade ${row.index + 1}`}
              checked={!!state.approved[row.index]}
              onChange={(e) => setApproved(row.index, e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          ),
        }),
        helper.accessor((p) => p.market, {
          id: 'market',
          header: 'market',
          cell: ({ row, getValue }) => (
            <span className="text-ink">
              {row.original.direction === 'long' ? '▲' : '▼'} {String(getValue())}
            </span>
          ),
        }),
        helper.accessor((p) => p.direction, {
          id: 'dir',
          header: 'dir',
          cell: (info) => <span className="text-dim">{String(info.getValue())}</span>,
        }),
        helper.accessor((p) => `${p.entry}→${p.exit}`, {
          id: 'entry-exit',
          header: 'entry→exit',
          cell: (info) => <span className="tabular-nums">{String(info.getValue())}</span>,
        }),
        helper.accessor((p) => p.points, {
          id: 'pts',
          header: 'pts',
          cell: ({ getValue }) => {
            const pts = Number(getValue())
            return <span className={`tabular-nums ${pts >= 0 ? 'text-up' : 'text-down'}`}>{pts >= 0 ? '+' : ''}{pts}</span>
          },
        }),
        helper.accessor((p) => p.riskPoints, {
          id: 'risk',
          header: 'risk pts',
          cell: ({ row }) => (
            <TextInput
              type="number"
              min="0"
              step="0.25"
              value={state.riskByIndex[row.index] ?? ''}
              onChange={(e) => setRisk(row.index, e.target.value)}
              placeholder="—"
              aria-label={`risk points for proposed trade ${row.index + 1}`}
              className="w-20 px-1.5 py-1 text-2xs"
            />
          ),
        }),
        helper.accessor((p) => (p.riskPoints != null && Number.isFinite(p.points) ? p.points / p.riskPoints : null), {
          id: 'r',
          header: 'R',
          cell: ({ row, getValue }) => {
            const r = getValue() as number | null
            if (r == null) return <span className="text-faint">—</span>
            return (
              <span className={`tabular-nums ${row.original.points > 0 ? 'text-up' : row.original.points < 0 ? 'text-down' : 'text-dim'}`}>
                {r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0')}
              </span>
            )
          },
        }),
        helper.accessor((p) => p.fillCount, {
          id: 'fills',
          header: 'fills',
          cell: (info) => <span className="tabular-nums text-dim">{String(info.getValue())}</span>,
        }),
        helper.accessor((p) => p.account.internalId ?? '', {
          id: 'account',
          header: 'account',
          cell: ({ row }) => (
            <Select
              value={state.accountByIndex[row.index] ?? ''}
              onChange={(e) => setAccount(row.index, e.target.value)}
              className="max-w-[110px] px-1.5 py-1 text-2xs"
            >
              <option value="">— account —</option>
              {knownAccounts.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </Select>
          ),
        }),
        helper.display({
          id: 'dup',
          header: '',
          cell: ({ row }) =>
            row.original.dup ? (
              <span className="border border-line px-1.5 py-0.5 text-3xs uppercase tracking-wide text-warn">dup</span>
            ) : null,
        }),
      ] as LegacyColumnDef<PositionProposal>[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.result, state.approved, state.accountByIndex, state.riskByIndex, knownAccounts],
  )

  const table = useLegacyTable({
    data: state.result?.proposals ?? [],
    columns,
  })

  if (!props.open) return null
  return (
    <SheetFrame title="import trades" onClose={() => props.onOpenChange(false)}>
      <ImageDropZone
        accept="image/*,.csv,.pdf"
        onFiles={onIngestFiles}
        label="drop exports — screenshots, CSV, PDF →"
        helperText="exports are parsed in memory and never saved"
        ariaLabel="drop exports to import trades"
      />
      {state.busy && <div className="mt-3 text-sm text-faint">importing…</div>}

      {state.result && !state.busy && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-dim">
            <span>
              {state.result.proposals.length} proposed
              {state.result.dupes > 0 && <span className="ml-2 text-faint">({state.result.dupes} dup)</span>}
            </span>
            <span className="text-faint">{state.result.date}</span>
          </div>

          {state.result.aliasProposal && (
            <div className="border border-line bg-bg p-3">
              <div className="mb-2 text-xs text-ink">
                unknown platform id <span className="font-mono text-accent">{state.result.aliasProposal.platformId || '—'}</span> — link to:
              </div>
              <Select
                value={state.links[state.result.aliasProposal.platformId] ?? state.result.aliasProposal.suggested ?? ''}
                onChange={(e) => {
                  const platformId = state.result?.aliasProposal?.platformId
                  if (platformId) setLink(platformId, e.target.value)
                }}
                className="w-full"
              >
                <option value="">— skip —</option>
                {state.result.aliasProposal.candidates.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          )}

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
                      no proposals
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-2">
            <span className="text-xs text-dim">{approvedCount} selected</span>
            <Button onClick={apply} disabled={approvedCount === 0 || state.busy}>
              apply {approvedCount} approved trades →
            </Button>
          </div>
        </div>
      )}
    </SheetFrame>
  )
}
