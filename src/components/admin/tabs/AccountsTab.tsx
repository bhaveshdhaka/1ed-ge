import { useCallback, useEffect, useState } from 'react'
import { api, todayStr, notifyChanged } from '../api'
import { Card, Button, Field, TextInput, NumInput, Select } from '../ui'

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
}
interface PayoutRow {
  file?: string
  date: string
  account: string
  amount: number
  status: string
  note?: string
}

const STAGES = ['eval', 'buffer', 'payout', 'failed', 'paused']
const FLOW = ['eval', 'buffer', 'payout']
const TERMINAL = ['failed', 'paused']

export function AccountsTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, AccountRow>>({})
  const [adding, setAdding] = useState(false)
  const [newAcc, setNewAcc] = useState({ firm: 'Lucid', size: '50000', id: '' })
  const [payout, setPayout] = useState({ date: todayStr(), account: '', amount: '', status: 'paid', note: '' })

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
    const drawdownLimit = size >= 50000 ? 2000 : 1000
    try {
      await api('/api/admin/accounts', {
        method: 'POST',
        body: {
          action: 'save',
          id,
          firm: newAcc.firm.trim() || 'Lucid',
          size,
          sizeLabel: `${Math.round(size / 1000)}k`,
          drawdownLimit,
          riskPerTrade: 200,
          stage: 'eval',
          stages: [{ stage: 'eval', from: todayStr() }],
        },
      })
      notify(`account ${id} created`)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ accounts</h1>
        {adding ? (
          <div className="flex flex-wrap items-center gap-2">
            <TextInput value={newAcc.firm} onChange={(e) => setNewAcc((a) => ({ ...a, firm: e.target.value }))} placeholder="firm" className="w-28" />
            <TextInput value={newAcc.size} onChange={(e) => setNewAcc((a) => ({ ...a, size: e.target.value }))} placeholder="size $" className="w-28" />
            <TextInput value={newAcc.id} onChange={(e) => setNewAcc((a) => ({ ...a, id: e.target.value }))} placeholder="id (lucid-50k-b)" className="w-40" />
            <Button size="sm" variant="primary" onClick={addAccount}>create</Button>
            <Button size="sm" onClick={() => { setAdding(false); setNewAcc({ firm: 'Lucid', size: '50000', id: '' }) }}>cancel</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>+ new account</Button>
        )}
      </div>

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
