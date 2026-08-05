import { useCallback, useEffect, useState } from 'react'
import { api, todayStr, fileToDataUrl, uploadDataUrl, triggerRebuild } from '../api'
import { Card, Button, Field, TextInput, NumInput, TextArea, Select, inputCls } from '../ui'
import { ImageDropZone } from '../ImageDropZone'

interface TradeRow {
  file: string
  slug: string
  data: Record<string, any>
}
interface AccountRow {
  id: string
  firm: string
  sizeLabel: string
  pointsValue: number
  [k: string]: any
}

interface FormState {
  date: string
  account: string
  market: string
  session: string
  direction: 'long' | 'short'
  setup: string
  entry: string
  stop: string
  target: string
  exit: string
  riskPoints: string
  points: string
  confidence: string
  note: string
}

const emptyForm = (): FormState => ({
  date: todayStr(),
  account: '',
  market: 'MNQ',
  session: '',
  direction: 'long',
  setup: '',
  entry: '',
  stop: '',
  target: '',
  exit: '',
  riskPoints: '',
  points: '',
  confidence: '',
  note: '',
})

function setNum(target: FormState, key: keyof FormState, v: unknown) {
  if (v === null || v === undefined || v === '') return
  ;(target[key] as any) = String(v)
}

export function TradesTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [rawNotes, setRawNotes] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [visionBusy, setVisionBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api<{ trades: TradeRow[]; accounts: AccountRow[] }>('/api/admin/trades')
      setTrades(res.trades)
      setAccounts(res.accounts)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
    setLoading(false)
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const selectTrade = (t: TradeRow) => {
    const d = t.data
    setSelected(t.file)
    const f = {
      date: String(d.date ?? todayStr()),
      account: String(d.account ?? ''),
      market: String(d.market ?? 'MNQ'),
      session: String(d.session ?? ''),
      direction: d.direction === 'short' ? ('short' as const) : ('long' as const),
      setup: String(d.setup ?? ''),
      entry: String(d.entry ?? ''),
      stop: String(d.stop ?? ''),
      target: String(d.target ?? ''),
      exit: String(d.exit ?? ''),
      riskPoints: String(d.riskPoints ?? ''),
      points: String(d.points ?? ''),
      confidence: String(d.confidence ?? ''),
      note: String(d.note ?? ''),
    }
    setForm(f)
    setScreenshots(Array.isArray(d.screenshots) ? d.screenshots : [])
  }

  const clearForm = () => {
    setSelected(null)
    setForm(emptyForm())
    setScreenshots([])
    setRawNotes('')
  }

  const applyStructure = (r: Record<string, any>) => {
    setForm((f) => {
      const n = { ...f }
      if (r.date) n.date = String(r.date)
      if (r.account && accounts.some((a) => a.id === r.account)) n.account = r.account
      if (r.market) n.market = String(r.market).toUpperCase()
      if (r.session) n.session = r.session
      if (r.direction === 'long' || r.direction === 'short') n.direction = r.direction
      if (r.setup) n.setup = r.setup
      setNum(n, 'entry', r.entry)
      setNum(n, 'stop', r.stop)
      setNum(n, 'target', r.target)
      setNum(n, 'exit', r.exit)
      setNum(n, 'riskPoints', r.riskPoints)
      setNum(n, 'points', r.points)
      setNum(n, 'confidence', r.confidence)
      if (r.note) n.note = r.note
      return n
    })
  }

  const doStructure = async () => {
    if (!rawNotes.trim()) return notify('paste some raw notes first', false)
    setAiBusy(true)
    try {
      const res = await api<{ result: Record<string, any> }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'structure', text: rawNotes },
      })
      applyStructure(res.result)
      notify('notes structured — review before saving')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ai failed', false)
    }
    setAiBusy(false)
  }

  const onFiles = async (files: File[]) => {
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file)
      setVisionBusy(true)
      try {
        const res = await api<{ result: Record<string, any> }>('/api/admin/ai', {
          method: 'POST',
          body: { action: 'vision', image: dataUrl },
        })
        applyStructure(res.result)
      } catch {}
      setVisionBusy(false)
      try {
        const url = await uploadDataUrl(dataUrl, file.name)
        setScreenshots((s) => [...s, url])
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
  }

  const save = async () => {
    if (!form.account) return notify('pick an account', false)
    if (!form.date) return notify('date required', false)
    if (form.entry === '' || form.exit === '') return notify('entry and exit required', false)
    setSaving(true)
    try {
      await api('/api/admin/trades', {
        method: 'POST',
        body: {
          trade: {
            ...form,
            entry: parseFloat(form.entry),
            stop: form.stop !== '' ? parseFloat(form.stop) : undefined,
            target: form.target !== '' ? parseFloat(form.target) : undefined,
            exit: parseFloat(form.exit),
            riskPoints: form.riskPoints !== '' ? parseFloat(form.riskPoints) : undefined,
            points: form.points !== '' ? parseFloat(form.points) : undefined,
            confidence: form.confidence !== '' ? parseInt(form.confidence, 10) : undefined,
            screenshots,
          },
          oldFile: selected ?? undefined,
        },
      })
      notify(selected ? 'trade updated' : 'trade saved')
      triggerRebuild()
      await load()
      clearForm()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!selected) return
    if (!confirm('delete this trade?')) return
    try {
      await api('/api/admin/trades', { method: 'DELETE', body: { file: selected } })
      notify('trade deleted')
      triggerRebuild()
      await load()
      clearForm()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const account = accounts.find((a) => a.id === form.account)
  const risk = parseFloat(form.riskPoints)
  const pts = parseFloat(form.points)
  const R = Number.isFinite(risk) && risk > 0 && Number.isFinite(pts) ? pts / risk : null
  const pnl = Number.isFinite(pts) ? pts * (account?.pointsValue ?? 2) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ trades</h1>
        <div className="flex gap-2">
          {selected && (
            <Button variant="danger" size="sm" onClick={remove}>delete</Button>
          )}
          <Button size="sm" onClick={clearForm}>new trade</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? 'saving…' : selected ? 'update trade' : 'save trade'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="panel max-h-[70vh] overflow-y-auto">
          <div className="border-b border-line px-3 py-2 text-[11px] uppercase tracking-widest text-dim">
            {trades.length} trades
          </div>
          {trades.map((t) => {
            const d = t.data
            const r = Number(d.riskPoints) > 0 ? Number(d.points) / Number(d.riskPoints) : 0
            const acc = accounts.find((a) => a.id === d.account)
            return (
              <button
                key={t.file}
                onClick={() => selectTrade(t)}
                className={`block w-full border-b border-line/60 px-3 py-2.5 text-left transition-colors hover:bg-raise ${
                  selected === t.file ? 'bg-raise' : ''
                }`}
              >
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink">{d.date}</span>
                  <span className={r > 0 ? 'text-up' : r < 0 ? 'text-down' : 'text-dim'}>
                    {r > 0 ? '+' : ''}{r.toFixed(2)}R
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-dim">
                  {acc ? `${acc.firm} ${acc.sizeLabel}` : d.account} · {d.direction} ·{' '}
                  <span className={Number(d.points) >= 0 ? 'text-up' : 'text-down'}>
                    {Number(d.points) >= 0 ? '+' : ''}{Number(d.points)}pts
                  </span>
                </div>
              </button>
            )
          })}
          {trades.length === 0 && (
            <div className="px-3 py-6 text-[12px] text-faint">no trades yet</div>
          )}
        </div>

        <div className="space-y-6">
          <Card title={selected ? `edit ${selected.replace(/\.md$/, '')}` : 'new trade'}>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="raw notes → AI">
                  <TextArea
                    rows={3}
                    placeholder="paste your notes… e.g. 'ORB long on NY open, entered 20800.5, stop 20795, targeted 10 pts, took half…'"
                    value={rawNotes}
                    onChange={(e) => setRawNotes(e.target.value)}
                  />
                </Field>
                <div className="flex flex-col gap-2">
                  <Button onClick={doStructure} disabled={aiBusy || !rawNotes.trim()}>
                    {aiBusy ? 'thinking…' : 'structure with AI →'}
                  </Button>
                  <ImageDropZone onFiles={onFiles} label={visionBusy ? 'reading screenshot…' : 'paste a trade screenshot →'} className="flex-1" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Field label="date">
                  <TextInput type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
                </Field>
                <Field label="account">
                  <Select value={form.account} onChange={(e) => set('account', e.target.value)}>
                    <option value="">— pick account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.firm} {a.sizeLabel}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="market">
                  <TextInput value={form.market} onChange={(e) => set('market', e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Field label="session">
                  <Select value={form.session} onChange={(e) => set('session', e.target.value)}>
                    <option value="">—</option>
                    <option value="asia">asia</option>
                    <option value="london">london</option>
                    <option value="ny-am">ny-am</option>
                    <option value="ny-pm">ny-pm</option>
                    <option value="ny">ny</option>
                  </Select>
                </Field>
                <Field label="direction">
                  <Select value={form.direction} onChange={(e) => set('direction', e.target.value)}>
                    <option value="long">long</option>
                    <option value="short">short</option>
                  </Select>
                </Field>
                <Field label="setup">
                  <TextInput value={form.setup} onChange={(e) => set('setup', e.target.value)} placeholder="orb, fvg, sweep…" />
                </Field>
                <Field label="confidence 1-5">
                  <NumInput value={form.confidence} onChange={(e) => set('confidence', e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <Field label="entry">
                  <NumInput value={form.entry} onChange={(e) => set('entry', e.target.value)} placeholder="20800.5" />
                </Field>
                <Field label="stop">
                  <NumInput value={form.stop} onChange={(e) => set('stop', e.target.value)} placeholder="auto" />
                </Field>
                <Field label="target">
                  <NumInput value={form.target} onChange={(e) => set('target', e.target.value)} placeholder="opt" />
                </Field>
                <Field label="exit">
                  <NumInput value={form.exit} onChange={(e) => set('exit', e.target.value)} placeholder="20810.5" />
                </Field>
                <Field label="risk pts">
                  <NumInput value={form.riskPoints} onChange={(e) => set('riskPoints', e.target.value)} placeholder="auto" />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="points">
                  <NumInput value={form.points} onChange={(e) => set('points', e.target.value)} placeholder="auto" />
                </Field>
                <Field label="note">
                  <TextInput value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="one-line summary" />
                </Field>
              </div>

              {(R !== null || pnl !== null) && (
                <div className="flex items-center gap-6 border border-line bg-bg px-3 py-2 text-[13px]">
                  <span className="text-dim">preview</span>
                  <span className={R !== null && R > 0 ? 'text-up' : R !== null && R < 0 ? 'text-down' : 'text-ink'}>
                    {R !== null ? `${R > 0 ? '+' : ''}${R.toFixed(2)}R` : 'R —'}
                  </span>
                  <span className="text-dim">·</span>
                  <span className={pnl !== null && pnl >= 0 ? 'text-up' : pnl !== null ? 'text-down' : 'text-ink'}>
                    {pnl !== null ? `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}` : '$ —'}
                  </span>
                  {selected && <span className="ml-auto text-[11px] text-faint">{selected}</span>}
                </div>
              )}

              <Field label={`screenshots (${screenshots.length})`}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {screenshots.map((s) => (
                    <div key={s} className="relative border border-line bg-bg">
                      <img src={s} alt="" className="h-24 w-full object-cover" />
                      <button
                        onClick={() => setScreenshots((x) => x.filter((y) => y !== s))}
                        className="absolute right-1 top-1 border border-line bg-bg px-1.5 text-[11px] text-down hover:border-down"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
