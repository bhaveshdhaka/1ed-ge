import { useMemo, useState } from 'react'
import { api, fileToDataUrl } from './api'
import { Card, Button, Select } from './ui'
import { ImageDropZone } from './ImageDropZone'

interface PositionProposal {
  market: string
  direction: 'long' | 'short'
  entry: number
  exit: number
  points: number
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
  links: Record<string, string>
}

export function IngestPanel({
  notify,
  markDirty,
  date,
  onImported,
}: {
  notify: (m: string, ok?: boolean) => void
  markDirty: () => void
  date: string
  onImported: (date: string) => Promise<void>
}) {
  const [state, setState] = useState<ImportState>({
    busy: false,
    result: null,
    approved: {},
    accountByIndex: {},
    links: {},
  })

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
      res.result.proposals.forEach((p, i) => {
        approved[i] = true
        accountByIndex[i] = p.account.internalId ?? res.result.aliasProposal?.suggested ?? ''
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
        links,
      })
      notify(`parsed ${res.result.proposals.length} proposed trades${res.result.dupes ? ` · ${res.result.dupes} dup` : ''}`)
    } catch (e) {
      setState((s) => ({ ...s, busy: false }))
      notify(e instanceof Error ? e.message : 'import failed', false)
    }
  }

  const setApproved = (i: number, v: boolean) => {
    setState((s) => ({ ...s, approved: { ...s.approved, [i]: v } }))
  }

  const setAccount = (i: number, id: string) => {
    setState((s) => ({ ...s, accountByIndex: { ...s.accountByIndex, [i]: id } }))
  }

  const setLink = (platformId: string, internalId: string) => {
    setState((s) => ({
      ...s,
      links: { ...s.links, [platformId]: internalId },
      accountByIndex: Object.fromEntries(
        s.result?.proposals.map((p, i) => {
          const resolved =
            s.accountByIndex[i] ||
            p.account.internalId ||
            s.links[p.account.platformId || ''] ||
            (p.account.platformId === platformId ? internalId : '') ||
            s.result?.aliasProposal?.suggested ||
            ''
          return [i, resolved]
        }) ?? [],
      ),
    }))
  }

  const apply = async () => {
    const result = state.result
    if (!result) return
    const approvedPositions: PositionProposal[] = []
    result.proposals.forEach((p, i) => {
      if (!state.approved[i]) return
      const internalId = state.accountByIndex[i] || p.account.internalId || ''
      approvedPositions.push({
        ...p,
        account: { ...p.account, internalId },
      })
    })
    if (approvedPositions.length === 0) return notify('no trades selected to import', false)

    const platformLinks = Object.entries(state.links)
      .filter(([platformId]) => result.platformIdsSeen.includes(platformId))
      .map(([platformId, internalId]) => ({ platformId, internalId }))

    try {
      const res = await api<{ ok: boolean; dayFile: string; linksApplied: number }>('/api/admin/ingest/apply', {
        method: 'POST',
        body: { date, positions: approvedPositions, platformLinks },
      })
      markDirty()
      notify(`imported ${approvedPositions.length} trades${res.linksApplied ? ` · linked ${res.linksApplied} account` : ''}`)
      await onImported(date)
      setState({ busy: false, result: null, approved: {}, accountByIndex: {}, links: {} })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'apply failed', false)
    }
  }

  const approvedCount = state.result
    ? state.result.proposals.filter((_, i) => state.approved[i]).length
    : 0

  return (
    <div id="sec-import" className="scroll-mt-20">
      <Card title="import trades — drop exports, review, apply">
        <ImageDropZone
          accept="image/*,.csv,.pdf"
          onFiles={onIngestFiles}
          label="drop exports — screenshots, CSV, PDF →"
          helperText="exports are parsed in memory and never saved"
          ariaLabel="drop exports to import trades"
        />
        {state.busy && (
          <div className="mt-3 text-[13px] text-faint">importing…</div>
        )}

        {state.result && !state.busy && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-[12px] text-dim">
              <span>
                {state.result.proposals.length} proposed
                {state.result.dupes > 0 && <span className="ml-2 text-faint">({state.result.dupes} dup)</span>}
              </span>
              <span className="text-faint">{state.result.date}</span>
            </div>

            {state.result.aliasProposal && (
              <div className="border border-line bg-bg p-3">
                <div className="mb-2 text-[12px] text-ink">
                  unknown platform id <span className="font-mono text-accent">{state.result.aliasProposal.platformId || '—'}</span> — link to:
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={state.links[state.result.aliasProposal.platformId] ?? state.result.aliasProposal.suggested ?? ''}
                    onChange={(e) => {
                      const platformId = state.result?.aliasProposal?.platformId
                      if (platformId) setLink(platformId, e.target.value)
                    }}
                    className="flex-1"
                  >
                    <option value="">— skip —</option>
                    {state.result.aliasProposal.candidates.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {state.result.proposals.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 border border-line bg-bg px-3 py-2">
                <label className="flex h-9 cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={!!state.approved[i]}
                    onChange={(e) => setApproved(i, e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-faint">approve</span>
                </label>
                <span className="text-[14px] text-ink">
                  {p.direction === 'long' ? '▲' : '▼'} {p.market} {p.direction} {p.entry} → {p.exit} · {p.points >= 0 ? '+' : ''}{p.points} pts · size {p.size} · {p.fillCount} fills
                </span>
                {p.dup && (
                  <span className="border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warn">dup</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Select
                    value={state.accountByIndex[i] ?? ''}
                    onChange={(e) => setAccount(i, e.target.value)}
                  >
                    <option value="">— account —</option>
                    {knownAccounts.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[12px] text-dim">{approvedCount} selected</span>
              <Button onClick={apply} disabled={approvedCount === 0}>
                apply {approvedCount} trades
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
