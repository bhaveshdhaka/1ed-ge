import { useCallback, useEffect, useState } from 'react'
import { api, todayStr, notifyChanged, fileToDataUrl, uploadDataUrl } from '../api'
import { Card, Button, Field, TextInput, NumInput, Select } from '../ui'
import { ImageDropZone } from '../ImageDropZone'

interface StatementRead {
  accountId: string | null
  firm: string | null
  size: number | null
  sizeLabel: string | null
  equity: number | null
  netPnl: number | null
  buffer: number | null
  stage: 'eval' | 'buffer' | 'payout' | 'failed' | 'paused' | null
  payout: number | null
  note: string | null
  confident: boolean
}

interface AccountRow {
  file?: string
  id: string
  firm: string
  size: number
  sizeLabel: string
  drawdownLimit: number
  riskPerTrade: number
  stage: string
  note?: string
  stages: { stage: string; from: string; to?: string; note?: string }[]
  rules?: {
    dailyLossLimit?: number
    profitTarget?: number
    consistencyPct?: number
    bufferBalance?: number
    drawdownMode?: string
    payoutSplit?: number
  }
}
interface PayoutRow {
  file?: string
  date: string
  account: string
  amount: number
  status: string
  note?: string
}

const STAGES = ['eval', 'funded', 'buffer', 'payout', 'failed', 'paused']
const FLOW = ['eval', 'funded', 'buffer', 'payout']
const TERMINAL = ['failed', 'paused']

/** Prop-firm presets — select firm+size, everything prefills, override any value. */
const LUCID_PRESETS: Record<string, Record<string, unknown>> = {
  '25000': { drawdownLimit: 1000, dailyLossLimit: null, profitTarget: 1250, consistencyPct: 40, bufferBalance: 26100, drawdownMode: 'eod', payoutSplit: 90, sizeLabel: '25k' },
  '50000': { drawdownLimit: 2000, dailyLossLimit: 1200, profitTarget: 3000, consistencyPct: 40, bufferBalance: 52100, drawdownMode: 'eod', payoutSplit: 90, sizeLabel: '50k' },
  '100000': { drawdownLimit: 3000, dailyLossLimit: 1800, profitTarget: 6000, consistencyPct: 40, bufferBalance: 103100, drawdownMode: 'eod', payoutSplit: 90, sizeLabel: '100k' },
  '150000': { drawdownLimit: 4500, dailyLossLimit: 2700, profitTarget: 9000, consistencyPct: 40, bufferBalance: 154600, drawdownMode: 'eod', payoutSplit: 90, sizeLabel: '150k' },
}

export function AccountsTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, AccountRow>>({})
  const [adding, setAdding] = useState(false)
  const [newAcc, setNewAcc] = useState({ firm: 'Lucid', size: '50000', id: '' })
  const [payout, setPayout] = useState({ date: todayStr(), account: '', amount: '', status: 'paid', note: '' })
  const [stmtBusy, setStmtBusy] = useState(false)
  const [proposal, setProposal] = useState<StatementRead | null>(null)
  const [proposalImage, setProposalImage] = useState<string | null>(null)
  const [applyTo, setApplyTo] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api<{ accounts: AccountRow[]; payouts: PayoutRow[] }>('/api/admin/accounts')
      setAccounts(res.accounts)
      setPayouts(res.payouts)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const draft = (a: AccountRow) => drafts[a.id] ?? a

  const saveAccount = async (a: AccountRow) => {
    const d = draft(a)
    try {
      await api('/api/admin/accounts', { method: 'POST', body: { action: 'save', ...d } })
      notify('account saved — queued for rebuild')
      notifyChanged()
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  const removeAccount = async (id: string) => {
    if (!confirm(`delete account ${id}? its history is gone forever.`)) return
    try {
      await api('/api/admin/accounts', { method: 'POST', body: { action: 'delete', id } })
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const addAccount = async () => {
    const id = newAcc.id.trim()
    if (!id) return notify('id required (e.g. lucid-50k-b)', false)
    const size = parseInt(newAcc.size || '50000', 10) || 50000
    const preset = LUCID_PRESETS[String(size)]
    const drawdownMode: string = newAcc.firm === 'TPT' ? 'intraday-to-eod' : 'eod'
    const sizeLabel = preset?.sizeLabel ?? `${Math.round(size / 1000)}k`
    const drawdownLimit = (preset?.drawdownLimit as number) ?? 2000
    try {
      await api('/api/admin/accounts', {
        method: 'POST',
        body: {
          action: 'save',
          id,
          firm: newAcc.firm.trim() || 'Lucid',
          size,
          sizeLabel: String(sizeLabel),
          drawdownLimit,
          riskPerTrade: 200,
          stage: 'eval',
          stages: [{ stage: 'eval', from: todayStr() }],
          trailing: drawdownMode !== 'intraday',
          rules: {
            dailyLossLimit: preset?.dailyLossLimit ?? undefined,
            profitTarget: preset?.profitTarget ?? undefined,
            consistencyPct: preset?.consistencyPct ?? undefined,
            bufferBalance: preset?.bufferBalance ?? undefined,
            drawdownMode,
            payoutSplit: preset?.payoutSplit ?? 90,
          },
        },
      })
      notify(`account ${id} created — ${String(sizeLabel)} ${newAcc.firm}`)
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'create failed', false)
    }
    setAdding(false)
    setNewAcc({ firm: 'Lucid', size: '50000', id: '' })
  }

  const setStage = (a: AccountRow, stage: string) => {
    const d = draft(a)
    const stages = [...d.stages]
    if (stages.length && stages[stages.length - 1].stage === stage) {
      // no-op
    } else {
      stages.push({ stage, from: todayStr() })
    }
    setDrafts((x) => ({ ...x, [a.id]: { ...d, stage, stages } }))
  }

  const setStageField = (a: AccountRow, i: number, patch: Partial<{ stage: string; from: string; to: string; note: string }>) => {
    const d = draft(a)
    setDrafts((x) => ({
      ...x,
      [a.id]: { ...d, stages: d.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) },
    }))
  }

  const setField = (a: AccountRow, patch: Partial<AccountRow>) =>
    setDrafts((x) => ({ ...x, [a.id]: { ...draft(a), ...patch } }))

  const setRule = (a: AccountRow, patch: Partial<NonNullable<AccountRow['rules']>>) =>
    setField(a, { rules: { ...(draft(a).rules ?? {}), ...patch } })

  const addPayout = async () => {
    if (!payout.account || !payout.amount) return notify('pick an account and amount', false)
    try {
      await api('/api/admin/accounts', {
        method: 'POST',
        body: { action: 'payout', date: payout.date, account: payout.account, amount: parseFloat(payout.amount), status: payout.status, note: payout.note || undefined },
      })
      notify('payout logged — queued for rebuild')
      notifyChanged()
      setPayout({ date: todayStr(), account: '', amount: '', status: 'paid', note: '' })
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'payout failed', false)
    }
  }

  const removePayout = async (file?: string) => {
    if (!file || !confirm('delete this payout?')) return
    try {
      await api('/api/admin/accounts', { method: 'POST', body: { action: 'deletePayout', file } })
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const onStmtFiles = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setStmtBusy(true)
    try {
      const dataUrl = await fileToDataUrl(f)
      const url = await uploadDataUrl(dataUrl, f.name)
      setProposalImage(url)
      const res = await api<{ result: StatementRead }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'statement', image: url },
      })
      setProposal(res.result)
      setApplyTo(res.result.accountId && accounts.some((a) => a.id === res.result.accountId) ? res.result.accountId : accounts[0]?.id ?? res.result.accountId ?? '')
      notify(res.result.confident ? 'statement read — review before applying' : 'statement read — low confidence, check the numbers', !res.result.confident)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'statement read failed', false)
    } finally {
      setStmtBusy(false)
    }
  }

  const applyProposal = async () => {
    if (!proposal) return
    const target = applyTo.trim()
    if (!target) return notify('pick which account to apply this to', false)
    const existing = accounts.find((a) => a.id === target)
    try {
      if (existing) {
        const stages = [...existing.stages]
        if (proposal.stage && proposal.stage !== existing.stage && stages[stages.length - 1]?.stage !== proposal.stage) {
          stages.push({ stage: proposal.stage, from: todayStr(), note: 'from statement' })
        }
        await api('/api/admin/accounts', {
          method: 'POST',
          body: {
            action: 'save',
            ...existing,
            firm: proposal.firm || existing.firm,
            size: proposal.size || existing.size,
            sizeLabel: proposal.sizeLabel || existing.sizeLabel,
            stage: proposal.stage || existing.stage,
            stages,
            note: [existing.note, proposal.note].filter(Boolean).join(' · ') || undefined,
          },
        })
        if (proposal.payout) {
          await api('/api/admin/accounts', {
            method: 'POST',
            body: { action: 'payout', date: todayStr(), account: target, amount: proposal.payout, status: 'paid', note: 'auto from statement' },
          })
        }
        notify('applied from statement — queued for rebuild')
      } else {
        const size = proposal.size || 50000
        const stage = proposal.stage || 'eval'
        const preset = LUCID_PRESETS[String(size)]
        const drawdownMode = 'eod'
        const drawdownLimit = (preset?.drawdownLimit as number) ?? (size >= 50000 ? 2000 : 1000)
        await api('/api/admin/accounts', {
          method: 'POST',
          body: {
            action: 'save',
            id: target,
            firm: proposal.firm || 'Lucid',
            size,
            sizeLabel: proposal.sizeLabel || `${Math.round(size / 1000)}k`,
            drawdownLimit,
            riskPerTrade: 200,
            stage,
            stages: [{ stage, from: todayStr(), note: 'from statement' }],
            note: proposal.note || undefined,
            trailing: true,
            rules: {
              dailyLossLimit: preset?.dailyLossLimit ?? undefined,
              profitTarget: preset?.profitTarget ?? undefined,
              consistencyPct: preset?.consistencyPct ?? undefined,
              bufferBalance: preset?.bufferBalance ?? undefined,
              drawdownMode,
              payoutSplit: preset?.payoutSplit ?? 90,
            },
          },
        })
        notify(`account ${target} created from statement — queued for rebuild`)
      }
      notifyChanged()
      await load()
      setProposal(null)
      setProposalImage(null)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'apply failed', false)
    }
  }

  const cancelProposal = () => {
    setProposal(null)
    setProposalImage(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ accounts</h1>
        {adding ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={newAcc.firm} onChange={(e) => setNewAcc((a) => ({ ...a, firm: e.target.value }))} className="w-24">
              <option value="Lucid">Lucid</option>
              <option value="TPT">TPT</option>
            </Select>
            <Select value={newAcc.size} onChange={(e) => setNewAcc((a) => ({ ...a, size: e.target.value }))} className="w-24">
              <option value="25000">25k</option>
              <option value="50000">50k</option>
              <option value="100000">100k</option>
              <option value="150000">150k</option>
            </Select>
            <TextInput value={newAcc.id} onChange={(e) => setNewAcc((a) => ({ ...a, id: e.target.value }))} placeholder="id (lucid-50k-b)" className="w-40" />
            <Button size="sm" variant="primary" onClick={addAccount}>create</Button>
            <Button size="sm" onClick={() => { setAdding(false); setNewAcc({ firm: 'Lucid', size: '50000', id: '' }) }}>cancel</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>+ new account</Button>
        )}
      </div>

      <Card title="read a statement screenshot" actions={<span className="text-[11px] text-faint">{stmtBusy ? 'reading…' : 'AI proposes · you confirm'}</span>}>
        {!proposal ? (
          <ImageDropZone onFiles={onStmtFiles} label={stmtBusy ? 'reading the statement…' : 'paste a prop-firm statement screenshot (equity / buffer / payouts)'} />
        ) : (
          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            {proposalImage && (
              <a href={proposalImage} target="_blank" className="block border border-line bg-bg">
                <img src={proposalImage} alt="statement" className="w-full" />
              </a>
            )}
            <div>
              {!proposal.confident && (
                <p className="mb-2 border border-warn/40 bg-warn/10 px-2 py-1 text-[12px] text-warn">
                  low confidence — check the numbers before applying
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-[13px] md:grid-cols-3">
                <div className="kv"><span className="text-dim">firm</span><span className="text-ink">{proposal.firm ?? '—'}</span></div>
                <div className="kv"><span className="text-dim">size</span><span className="text-ink">{proposal.sizeLabel ?? proposal.size ?? '—'}</span></div>
                <div className="kv"><span className="text-dim">equity</span><span className="text-ink">{proposal.equity !== null ? `$${proposal.equity.toLocaleString()}` : '—'}</span></div>
                <div className="kv"><span className="text-dim">net pnl</span><span className={proposal.netPnl !== null && proposal.netPnl < 0 ? 'text-down' : 'text-up'}>{proposal.netPnl !== null ? `${proposal.netPnl >= 0 ? '+' : ''}$${proposal.netPnl.toLocaleString()}` : '—'}</span></div>
                <div className="kv"><span className="text-dim">buffer left</span><span className="text-ink">{proposal.buffer !== null ? `$${proposal.buffer.toLocaleString()}` : '—'}</span></div>
                <div className="kv"><span className="text-dim">stage</span><span className="text-ink">{proposal.stage ?? '—'}</span></div>
              </div>
              {proposal.payout && (
                <p className="mt-2 text-[12px] text-up">payout detected: +${proposal.payout.toLocaleString()} — a payout record will be added</p>
              )}
              {proposal.note && <p className="mt-2 text-[12px] text-dim">{proposal.note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Field label="apply to">
                  <Select value={applyTo} onChange={(e) => setApplyTo(e.target.value)} className="w-44">
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                    {!accounts.some((a) => a.id === applyTo) && applyTo && <option value={applyTo}>{applyTo} (new)</option>}
                  </Select>
                </Field>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" onClick={cancelProposal}>cancel</Button>
                  <Button size="sm" variant="primary" onClick={applyProposal}>apply to account</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {accounts.map((a) => (
          <Card
            key={a.id}
            title={a.id}
            actions={
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-faint">{draft(a).firm} · {draft(a).sizeLabel}</span>
                <Button size="sm" onClick={() => saveAccount(a)}>save</Button>
                <Button size="sm" variant="danger" onClick={() => removeAccount(a.id)}>×</Button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="firm"><TextInput value={draft(a).firm} onChange={(e) => setField(a, { firm: e.target.value })} /></Field>
              <Field label="size"><NumInput value={String(draft(a).size)} onChange={(e) => setField(a, { size: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="size label"><TextInput value={draft(a).sizeLabel} onChange={(e) => setField(a, { sizeLabel: e.target.value })} /></Field>
              <Field label="dd limit ($)"><NumInput value={String(draft(a).drawdownLimit)} onChange={(e) => setField(a, { drawdownLimit: parseFloat(e.target.value || '0') })} /></Field>
              <Field label="risk / trade ($)"><NumInput value={String(draft(a).riskPerTrade)} onChange={(e) => setField(a, { riskPerTrade: parseFloat(e.target.value || '0') })} /></Field>
            </div>

            {/* lifecycle stepper */}
            <div className="mt-3">
              <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">stage</div>
              <div className="flex items-center gap-1">
                {FLOW.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <button
                      onClick={() => setStage(a, s)}
                      className={`flex h-9 items-center border px-2.5 text-[12px] transition-colors ${
                        draft(a).stage === s
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-line2 text-dim hover:border-accent hover:text-ink'
                      }`}
                    >
                      {s}
                    </button>
                    {i < FLOW.length - 1 && <span className="text-faint">→</span>}
                  </div>
                ))}
                <span className="mx-1 text-faint">|</span>
                {TERMINAL.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStage(a, s)}
                    className={`flex h-9 items-center border px-2.5 text-[12px] transition-colors ${
                      draft(a).stage === s
                        ? s === 'failed'
                          ? 'border-down bg-down/15 text-down'
                          : 'border-line2 bg-raise text-soft'
                        : 'border-line2 text-faint hover:border-down hover:text-down'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-faint">clicking a stage records it in the history with today's date</p>
            </div>

            <Field label="note" className="mt-3">
              <TextInput value={draft(a).note ?? ''} onChange={(e) => setField(a, { note: e.target.value })} placeholder="optional" />
            </Field>

            {/* owner-dictated rules — no engine, no AI: prop firms change these, keep it editable */}
            <div className="mt-4 border-t border-line/60 pt-3">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-dim">rules — owner-dictated</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="daily loss ($)">
                  <NumInput
                    value={draft(a).rules?.dailyLossLimit != null ? String(draft(a).rules?.dailyLossLimit) : ''}
                    onChange={(e) => setRule(a, { dailyLossLimit: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="1200"
                  />
                </Field>
                <Field label="profit target ($)">
                  <NumInput
                    value={draft(a).rules?.profitTarget != null ? String(draft(a).rules?.profitTarget) : ''}
                    onChange={(e) => setRule(a, { profitTarget: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="3000"
                  />
                </Field>
                <Field label="consistency %">
                  <NumInput
                    value={draft(a).rules?.consistencyPct != null ? String(draft(a).rules?.consistencyPct) : ''}
                    onChange={(e) => setRule(a, { consistencyPct: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="40"
                  />
                </Field>
                <Field label="buffer ($)">
                  <NumInput
                    value={draft(a).rules?.bufferBalance != null ? String(draft(a).rules?.bufferBalance) : ''}
                    onChange={(e) => setRule(a, { bufferBalance: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="52100"
                  />
                </Field>
                <Field label="drawdown mode">
                  <Select value={draft(a).rules?.drawdownMode ?? 'eod'} onChange={(e) => setRule(a, { drawdownMode: e.target.value })}>
                    <option value="eod">EOD trailing</option>
                    <option value="intraday">intraday trailing</option>
                    <option value="intraday-to-eod">intraday → EOD at buffer</option>
                  </Select>
                </Field>
                <Field label="payout split (%)">
                  <NumInput
                    value={draft(a).rules?.payoutSplit != null ? String(draft(a).rules?.payoutSplit) : ''}
                    onChange={(e) => setRule(a, { payoutSplit: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="90"
                  />
                </Field>
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-[11px] uppercase tracking-widest text-dim">
                stage history ({draft(a).stages.length}) ▾
              </summary>
              <div className="mt-2 space-y-2">
                {draft(a).stages.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Select value={s.stage} onChange={(e) => setStageField(a, i, { stage: e.target.value })} className="w-28">
                      {STAGES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </Select>
                    <TextInput type="date" value={s.from} onChange={(e) => setStageField(a, i, { from: e.target.value })} className="w-36" />
                    <TextInput type="date" value={s.to ?? ''} onChange={(e) => setStageField(a, i, { to: e.target.value || undefined })} className="w-36" placeholder="to" />
                    <TextInput value={s.note ?? ''} onChange={(e) => setStageField(a, i, { note: e.target.value })} placeholder="note" className="flex-1" />
                    <Button size="sm" variant="danger" onClick={() => setField(a, { stages: draft(a).stages.filter((_, j) => j !== i) })}>×</Button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <Button size="sm" onClick={() => setField(a, { stages: [...draft(a).stages, { stage: 'buffer', from: todayStr() }] })}>+ stage</Button>
              </div>
            </details>
          </Card>
        ))}
        {accounts.length === 0 && <p className="text-[13px] text-faint">no accounts yet.</p>}
      </div>

      <Card title={`payouts (${payouts.length})`}>
        <div className="mb-4 grid gap-2 md:grid-cols-6">
          <TextInput type="date" value={payout.date} onChange={(e) => setPayout((p) => ({ ...p, date: e.target.value }))} className="md:col-span-1" />
          <Select value={payout.account} onChange={(e) => setPayout((p) => ({ ...p, account: e.target.value }))} className="md:col-span-2">
            <option value="">— account —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
          </Select>
          <NumInput value={payout.amount} onChange={(e) => setPayout((p) => ({ ...p, amount: e.target.value }))} placeholder="amount $" className="md:col-span-1" />
          <Select value={payout.status} onChange={(e) => setPayout((p) => ({ ...p, status: e.target.value }))} className="md:col-span-1">
            <option value="paid">paid</option>
            <option value="pending">pending</option>
          </Select>
          <Button onClick={addPayout} className="md:col-span-1">log payout</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr><th className="th">date</th><th className="th">account</th><th className="th text-right">amount</th><th className="th">status</th><th className="th">note</th><th className="th"></th></tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.file}>
                  <td className="td text-dim">{p.date}</td>
                  <td className="td">{p.account}</td>
                  <td className="td text-right num-up">+${p.amount.toLocaleString()}</td>
                  <td className="td"><span className={p.status === 'paid' ? 'text-up' : 'text-warn'}>{p.status}</span></td>
                  <td className="td text-dim">{p.note ?? ''}</td>
                  <td className="td"><Button size="sm" variant="danger" onClick={() => removePayout(p.file)}>×</Button></td>
                </tr>
              ))}
              {payouts.length === 0 && <tr><td className="td text-faint" colSpan={6}>no payouts yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
