import { useCallback, useEffect, useState } from 'react'
import { api, todayStr, fileToDataUrl, uploadDataUrl, triggerRebuild } from '../api'
import { Card, Button, Field, TextInput, NumInput, TextArea, Select, inputCls } from '../ui'
import { ImageDropZone } from '../ImageDropZone'

interface AccRow {
  id: string
  firm: string
  sizeLabel: string
  pointsValue: number
}
interface HabitDef {
  slug: string
  name: string
  emoji?: string
  color: string
}
interface ExecForm {
  account: string
  size: string
}
interface TradeForm {
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
  screenshots: string[]
  executions: ExecForm[]
}

const emptyTrade = (): TradeForm => ({
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
  screenshots: [],
  executions: [],
})

export function DayLogTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [date, setDate] = useState(todayStr())
  const [mood, setMood] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [sleepQuality, setSleepQuality] = useState('')
  const [habits, setHabits] = useState<Record<string, boolean>>({})
  const [iphoneHours, setIphoneHours] = useState('')
  const [socialHours, setSocialHours] = useState('')
  const [macHours, setMacHours] = useState('')
  const [deviceNotes, setDeviceNotes] = useState('')
  const [deviceScreens, setDeviceScreens] = useState<string[]>([])
  const [trades, setTrades] = useState<TradeForm[]>([])
  const [accounts, setAccounts] = useState<AccRow[]>([])
  const [habitDefs, setHabitDefs] = useState<HabitDef[]>([])
  const [rawNotes, setRawNotes] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [screenBusy, setScreenBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (d: string) => {
      setLoading(true)
      try {
        const res = await api<{ day: any; accounts: AccRow[]; habits: HabitDef[] }>(
          `/api/admin/days?date=${encodeURIComponent(d)}`,
        )
        setAccounts(res.accounts)
        setHabitDefs(res.habits)
        const day = res.day
        setMood(day?.mood ? String(day.mood) : '')
        setSleepHours(day?.sleep?.hours !== undefined ? String(day.sleep.hours) : '')
        setSleepQuality(day?.sleep?.quality ? String(day.sleep.quality) : '')
        setHabits(day?.habits ?? {})
        setIphoneHours(day?.device?.iphoneHours !== undefined ? String(day.device.iphoneHours) : '')
        setSocialHours(day?.device?.socialHours !== undefined ? String(day.device.socialHours) : '')
        setMacHours(day?.device?.macHours !== undefined ? String(day.device.macHours) : '')
        setDeviceNotes(day?.device?.notes ?? '')
        setDeviceScreens(day?.device?.screenshots ?? [])
        setTrades((day?.trades ?? []).map((t: any) => ({
          market: String(t.market ?? 'MNQ'),
          session: String(t.session ?? ''),
          direction: t.direction === 'short' ? 'short' : 'long',
          setup: String(t.setup ?? ''),
          entry: String(t.entry ?? ''),
          stop: String(t.stop ?? ''),
          target: String(t.target ?? ''),
          exit: String(t.exit ?? ''),
          riskPoints: String(t.riskPoints ?? ''),
          points: String(t.points ?? ''),
          confidence: String(t.confidence ?? ''),
          note: String(t.note ?? ''),
          screenshots: t.screenshots ?? [],
          executions: (t.executions ?? []).map((e: any) => ({
            account: String(e.account ?? ''),
            size: String(e.size ?? ''),
          })),
        })))
      } catch (e) {
        notify(e instanceof Error ? e.message : 'load failed', false)
      }
      setLoading(false)
    },
    [notify],
  )

  useEffect(() => {
    load(date)
  }, [date, load])

  const setTrade = (i: number, patch: Partial<TradeForm>) =>
    setTrades((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  const setExec = (ti: number, ei: number, patch: Partial<ExecForm>) =>
    setTrades((ts) =>
      ts.map((t, j) =>
        j === ti
          ? { ...t, executions: t.executions.map((e, k) => (k === ei ? { ...e, ...patch } : e)) }
          : t,
      ),
    )

  const applyStructured = (r: any) => {
    if (r.mood) setMood(String(r.mood))
    if (r.sleepHours) setSleepHours(String(r.sleepHours))
    if (r.sleepQuality) setSleepQuality(String(r.sleepQuality))
    if (Array.isArray(r.trades) && r.trades.length) {
      const mapped = r.trades.map((t: any) => ({
        market: String(t.market ?? 'MNQ'),
        session: String(t.session ?? ''),
        direction: t.direction === 'short' ? ('short' as const) : ('long' as const),
        setup: String(t.setup ?? ''),
        entry: t.entry !== null && t.entry !== undefined ? String(t.entry) : '',
        stop: t.stop !== null && t.stop !== undefined ? String(t.stop) : '',
        target: t.target !== null && t.target !== undefined ? String(t.target) : '',
        exit: t.exit !== null && t.exit !== undefined ? String(t.exit) : '',
        riskPoints: t.riskPoints !== null && t.riskPoints !== undefined ? String(t.riskPoints) : '',
        points: t.points !== null && t.points !== undefined ? String(t.points) : '',
        confidence: t.confidence ? String(t.confidence) : '',
        note: String(t.note ?? ''),
        screenshots: [],
        executions: Array.isArray(t.accounts) && t.accounts.length ? t.accounts.map((a: string) => ({ account: a, size: '' })) : [],
      }))
      setTrades((prev) => [...prev, ...mapped])
    }
  }

  const doStructure = async () => {
    if (!rawNotes.trim()) return notify('paste your day notes first', false)
    setAiBusy(true)
    try {
      const res = await api<{ result: any }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'structure', text: rawNotes },
      })
      applyStructured(res.result)
      notify('day structured — review and save')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ai failed', false)
    }
    setAiBusy(false)
  }

  const onTradeScreens = async (ti: number, files: File[]) => {
    for (const f of files) {
      const dataUrl = await fileToDataUrl(f)
      try {
        const res = await api<{ result: any }>('/api/admin/ai', {
          method: 'POST',
          body: { action: 'vision', image: dataUrl },
        })
        const r = res.result
        const patch: Partial<TradeForm> = {}
        if (r.entry != null) patch.entry = String(r.entry)
        if (r.exit != null) patch.exit = String(r.exit)
        if (r.stop != null) patch.stop = String(r.stop)
        if (r.points != null) patch.points = String(r.points)
        if (r.direction === 'short') patch.direction = 'short'
        if (r.session) patch.session = String(r.session)
        if (Object.keys(patch).length) setTrade(ti, patch)
      } catch {}
      try {
        const url = await uploadDataUrl(dataUrl, f.name)
        setTrades((ts) => ts.map((t, j) => (j === ti ? { ...t, screenshots: [...t.screenshots, url] } : t)))
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
  }

  const onDeviceScreens = async (files: File[]) => {
    setScreenBusy(true)
    for (const f of files) {
      const dataUrl = await fileToDataUrl(f)
      try {
        const res = await api<{ result: any }>('/api/admin/ai', {
          method: 'POST',
          body: { action: 'screentime', image: dataUrl },
        })
        const r = res.result
        if (r.iphoneHours != null) setIphoneHours(String(r.iphoneHours))
        if (r.socialHours != null) setSocialHours(String(r.socialHours))
        if (r.macHours != null) setMacHours(String(r.macHours))
        if (r.note) setDeviceNotes((n) => (n ? n + ' · ' : '') + r.note)
      } catch {}
      try {
        const url = await uploadDataUrl(dataUrl, f.name)
        setDeviceScreens((s) => [...s, url])
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
    setScreenBusy(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        date,
        ...(mood ? { mood: parseInt(mood, 10) } : {}),
        ...(sleepHours || sleepQuality
          ? { sleep: { ...(sleepHours ? { hours: parseFloat(sleepHours) } : {}), ...(sleepQuality ? { quality: parseInt(sleepQuality, 10) } : {}) } }
          : {}),
        habits,
        ...(iphoneHours || socialHours || macHours || deviceNotes || deviceScreens.length
          ? {
              device: {
                ...(iphoneHours ? { iphoneHours: parseFloat(iphoneHours) } : {}),
                ...(socialHours ? { socialHours: parseFloat(socialHours) } : {}),
                ...(macHours ? { macHours: parseFloat(macHours) } : {}),
                ...(deviceNotes ? { notes: deviceNotes } : {}),
                screenshots: deviceScreens,
              },
            }
          : {}),
        trades: trades.map((t) => ({
          ...t,
          entry: parseFloat(t.entry),
          stop: t.stop !== '' ? parseFloat(t.stop) : undefined,
          target: t.target !== '' ? parseFloat(t.target) : undefined,
          exit: parseFloat(t.exit),
          riskPoints: t.riskPoints !== '' ? parseFloat(t.riskPoints) : undefined,
          points: t.points !== '' ? parseFloat(t.points) : undefined,
          confidence: t.confidence !== '' ? parseInt(t.confidence, 10) : undefined,
          executions: t.executions
            .filter((e) => e.account)
            .map((e) => ({ account: e.account, size: e.size !== '' ? parseInt(e.size, 10) : undefined })),
        })),
      }
      await api('/api/admin/days', { method: 'POST', body: payload })
      notify('day saved')
      triggerRebuild()
      await load(date)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
    setSaving(false)
  }

  const dayTotals = trades.reduce(
    (acc, t) => {
      const risk = t.riskPoints !== '' ? parseFloat(t.riskPoints) : t.stop !== '' && t.entry !== '' ? Math.abs(parseFloat(t.entry) - parseFloat(t.stop)) : NaN
      const pts = t.points !== '' ? parseFloat(t.points) : t.entry !== '' && t.exit !== '' ? (t.direction === 'long' ? parseFloat(t.exit) - parseFloat(t.entry) : parseFloat(t.entry) - parseFloat(t.exit)) : NaN
      if (!Number.isFinite(risk) || !Number.isFinite(pts) || risk <= 0) return acc
      acc.R += pts / risk
      acc.pts += pts
      for (const e of t.executions) {
        if (!e.account) continue
        const a = accounts.find((x) => x.id === e.account)
        const size = e.size !== '' ? parseInt(e.size, 10) : 1
        acc.pnl += pts * (a?.pointsValue ?? 2) * size
      }
      return acc
    },
    { R: 0, pts: 0, pnl: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ day log</h1>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? 'saving…' : 'save day'}
          </Button>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {loading ? (
        <Card title="loading"><p className="text-[13px] text-faint">loading…</p></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="mood" className="lg:col-span-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(String(m))}
                    className={`h-9 flex-1 border text-[13px] transition-colors ${
                      mood === String(m) ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-dim hover:border-accent'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Card>
            <Card title="sleep" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="hours">
                  <NumInput value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="7.5" />
                </Field>
                <Field label="quality 1-5">
                  <NumInput value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} placeholder="4" />
                </Field>
              </div>
            </Card>
          </div>

          <Card title="habits">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {habitDefs.map((h) => {
                const done = habits[h.slug] === true
                return (
                  <button
                    key={h.slug}
                    onClick={() => setHabits((x) => ({ ...x, [h.slug]: !done }))}
                    className={`flex items-center justify-between border px-3 py-2.5 text-[13px] transition-colors ${
                      done ? 'border-transparent text-bg' : 'border-line2 text-ink hover:border-accent'
                    }`}
                    style={done ? { background: h.color } : {}}
                  >
                    <span className="flex items-center gap-2">
                      <span>{h.emoji ?? '·'}</span>
                      <span>{h.name}</span>
                    </span>
                    <span className="text-[11px] opacity-70">{done ? '✓' : '·'}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card title="device / screen time">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="iphone screen (h)">
                <NumInput value={iphoneHours} onChange={(e) => setIphoneHours(e.target.value)} placeholder="5.2" />
              </Field>
              <Field label="social media (h)">
                <NumInput value={socialHours} onChange={(e) => setSocialHours(e.target.value)} placeholder="2.1" />
              </Field>
              <Field label="mac (h)">
                <NumInput value={macHours} onChange={(e) => setMacHours(e.target.value)} placeholder="4.5" />
              </Field>
            </div>
            <Field label="notes" className="mt-3">
              <TextInput value={deviceNotes} onChange={(e) => setDeviceNotes(e.target.value)} placeholder="doomscrolled at night…" />
            </Field>
            <div className="mt-3">
              <ImageDropZone onFiles={onDeviceScreens} label={screenBusy ? 'reading screenshots…' : 'paste screen time screenshots →'} />
            </div>
            {deviceScreens.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {deviceScreens.map((s) => (
                  <div key={s} className="relative border border-line bg-bg">
                    <img src={s} alt="" className="h-24 w-full object-cover" />
                    <button
                      onClick={() => setDeviceScreens((x) => x.filter((y) => y !== s))}
                      className="absolute right-1 top-1 border border-line bg-bg px-1.5 text-[11px] text-down hover:border-down"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={`trades (${trades.length})`}>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <TextArea
                  rows={3}
                  placeholder="paste your raw day notes… 'ORB long on NY open, took 2 accounts, stopped out. afternoon revenge risk. slept badly…'"
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                />
                <div className="flex items-end">
                  <Button onClick={doStructure} disabled={aiBusy || !rawNotes.trim()}>
                    {aiBusy ? 'thinking…' : 'structure day with AI →'}
                  </Button>
                </div>
              </div>

              {trades.map((t, ti) => (
                <div key={ti} className="border border-line bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-widest text-dim">trade {ti + 1}</span>
                    <Button size="sm" variant="danger" onClick={() => setTrades((ts) => ts.filter((_, j) => j !== ti))}>remove</Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-5">
                    <Field label="market"><TextInput value={t.market} onChange={(e) => setTrade(ti, { market: e.target.value })} /></Field>
                    <Field label="session">
                      <Select value={t.session} onChange={(e) => setTrade(ti, { session: e.target.value })}>
                        <option value="">—</option>
                        <option value="asia">asia</option>
                        <option value="london">london</option>
                        <option value="ny-am">ny-am</option>
                        <option value="ny-pm">ny-pm</option>
                        <option value="ny">ny</option>
                      </Select>
                    </Field>
                    <Field label="direction">
                      <Select value={t.direction} onChange={(e) => setTrade(ti, { direction: e.target.value as 'long' | 'short' })}>
                        <option value="long">long</option>
                        <option value="short">short</option>
                      </Select>
                    </Field>
                    <Field label="setup"><TextInput value={t.setup} onChange={(e) => setTrade(ti, { setup: e.target.value })} /></Field>
                    <Field label="confidence"><NumInput value={t.confidence} onChange={(e) => setTrade(ti, { confidence: e.target.value })} /></Field>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-5">
                    <Field label="entry"><NumInput value={t.entry} onChange={(e) => setTrade(ti, { entry: e.target.value })} /></Field>
                    <Field label="stop"><NumInput value={t.stop} onChange={(e) => setTrade(ti, { stop: e.target.value })} /></Field>
                    <Field label="target"><NumInput value={t.target} onChange={(e) => setTrade(ti, { target: e.target.value })} /></Field>
                    <Field label="exit"><NumInput value={t.exit} onChange={(e) => setTrade(ti, { exit: e.target.value })} /></Field>
                    <Field label="points"><NumInput value={t.points} onChange={(e) => setTrade(ti, { points: e.target.value })} /></Field>
                  </div>
                  <Field label="note" className="mt-2">
                    <TextInput value={t.note} onChange={(e) => setTrade(ti, { note: e.target.value })} placeholder="what was the story" />
                  </Field>

                  <div className="mt-3">
                    <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">executions (accounts)</div>
                    <div className="space-y-2">
                      {t.executions.map((e, ei) => (
                        <div key={ei} className="flex items-center gap-2">
                          <Select
                            value={e.account}
                            onChange={(ev) => setExec(ti, ei, { account: ev.target.value })}
                            className="flex-1"
                          >
                            <option value="">— account —</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.firm} {a.sizeLabel} · {a.id}</option>
                            ))}
                          </Select>
                          <TextInput
                            value={e.size}
                            onChange={(ev) => setExec(ti, ei, { size: ev.target.value })}
                            className="w-20"
                            placeholder="1"
                          />
                          <Button size="sm" variant="danger" onClick={() => setTrade(ti, { executions: t.executions.filter((_, k) => k !== ei) })}>×</Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={() => setTrade(ti, { executions: [...t.executions, { account: '', size: '' }] })}>
                        + execution
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <ImageDropZone onFiles={(fs) => onTradeScreens(ti, fs)} label="paste trade screenshot →" className="!py-3" />
                    <div className="grid grid-cols-2 gap-2">
                      {t.screenshots.map((s) => (
                        <div key={s} className="relative border border-line bg-bg">
                          <img src={s} alt="" className="h-16 w-full object-cover" />
                          <button
                            onClick={() => setTrade(ti, { screenshots: t.screenshots.filter((y) => y !== s) })}
                            className="absolute right-1 top-1 border border-line bg-bg px-1.5 text-[11px] text-down hover:border-down"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <Button size="sm" onClick={() => setTrades((ts) => [...ts, emptyTrade()])}>+ add trade</Button>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-6 border border-line bg-bg px-4 py-3 text-[13px]">
            <span className="text-dim">day preview</span>
            <span className="num-up">{dayTotals.R > 0 ? '+' : ''}{dayTotals.R.toFixed(2)}R</span>
            <span className="text-dim">·</span>
            <span className={dayTotals.pts >= 0 ? 'text-up' : 'text-down'}>{dayTotals.pts >= 0 ? '+' : ''}{dayTotals.pts.toFixed(1)}pts</span>
            <span className="text-dim">·</span>
            <span className={dayTotals.pnl >= 0 ? 'text-up' : 'text-down'}>{dayTotals.pnl >= 0 ? '+' : ''}${Math.round(dayTotals.pnl).toLocaleString()}</span>
            <Button className="ml-auto" size="sm" variant="primary" onClick={save} disabled={saving}>
              {saving ? 'saving…' : 'save day'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
