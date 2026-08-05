import { useCallback, useEffect, useRef, useState } from 'react'
import { api, todayStr, fileToDataUrl, uploadDataUrl, notifyChanged, triggerRebuild, setPasteSink } from '../api'
import { Card, Button, Field, TextInput, NumInput, TextArea, Select } from '../ui'
import { ImageDropZone } from '../ImageDropZone'
import { JournalEditor } from '../JournalEditor'

interface AccRow { id: string; firm: string; sizeLabel: string; pointsValue: number }
interface HabitDef { slug: string; name: string; emoji?: string; color: string }
interface DayListItem { file: string; date: string; mood: number | null; trades: number }
interface DayImage { id: string; dataUrl: string; url: string }
interface ExecForm { account: string; size: string }
interface TradeForm {
  market: string; session: string; direction: 'long' | 'short'; setup: string
  entry: string; stop: string; target: string; exit: string; riskPoints: string; points: string
  confidence: string; note: string; screenshots: string[]; executions: ExecForm[]
}

const emptyTrade = (): TradeForm => ({
  market: 'MNQ', session: '', direction: 'long', setup: '',
  entry: '', stop: '', target: '', exit: '', riskPoints: '', points: '',
  confidence: '', note: '', screenshots: [], executions: [],
})

export function DayWorkspace({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [date, setDate] = useState(todayStr())
  const [daysList, setDaysList] = useState<DayListItem[]>([])
  const [accounts, setAccounts] = useState<AccRow[]>([])
  const [habitDefs, setHabitDefs] = useState<HabitDef[]>([])

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

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState('')
  const [featuredImage, setFeaturedImage] = useState('')
  const [content, setContent] = useState('')

  const [dayText, setDayText] = useState('')
  const [dayImages, setDayImages] = useState<DayImage[]>([])
  const dayImagesRef = useRef<DayImage[]>([])

  const [editing, setEditing] = useState<string | null>(null)
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dayBusy, setDayBusy] = useState(false)
  const [screenBusy, setScreenBusy] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const markDirty = () => setDirty(true)

  const load = useCallback(
    async (d: string) => {
      setLoading(true)
      setEditing(null)
      setExpandedTrade(null)
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

        let j: { data: any; content: string } | null = null
        try {
          j = await api<{ entry: { data: any; content: string } }>(
            `/api/admin/journal?file=${encodeURIComponent(`${d}.mdx`)}`,
          ).then((r) => ({ data: r.entry.data, content: r.entry.content }))
        } catch {}
        setTitle(String(j?.data?.day ?? ''))
        setSummary(String(j?.data?.summary ?? ''))
        setTags(Array.isArray(j?.data?.tags) ? j.data.tags.join(', ') : '')
        setFeaturedImage(String(j?.data?.featuredImage ?? ''))
        setContent(j?.content ?? '')

        setDirty(false)
      } catch (e) {
        notify(e instanceof Error ? e.message : 'load failed', false)
      }
      setLoading(false)
    },
    [notify],
  )

  const loadDays = useCallback(async () => {
    try {
      const res = await api<{ days: DayListItem[] }>('/api/admin/days')
      setDaysList(res.days)
    } catch {}
  }, [])

  useEffect(() => {
    load(date)
    loadDays()
  }, [date, load, loadDays])

  useEffect(() => {
    setPasteSink((files) => addDayImages(files))
    return () => setPasteSink(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectDate = (d: string) => {
    if (!d || d === date) return
    if (dirty && !confirm(`unsaved changes on ${date} — discard and open ${d}?`)) return
    setDate(d)
  }

  const setTrade = (i: number, patch: Partial<TradeForm>) => {
    setTrades((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
    markDirty()
  }

  // ---------- capture: paste everything, AI builds the day ----------
  const addDayImages = async (files: File[]) => {
    const items: DayImage[] = []
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f)
        const url = await uploadDataUrl(dataUrl, f.name)
        items.push({ id: Math.random().toString(36).slice(2), dataUrl, url })
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
    if (!items.length) return
    const next = [...dayImagesRef.current, ...items]
    dayImagesRef.current = next
    setDayImages(next)
    markDirty()
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => runStructure(next), 900)
  }

  const removeDayImage = (id: string) => {
    const next = dayImagesRef.current.filter((i) => i.id !== id)
    dayImagesRef.current = next
    setDayImages(next)
  }

  const autoFeatured = () => {
    if (!featuredImage) {
      const candidates = [
        ...deviceScreens,
        ...trades.flatMap((t) => t.screenshots),
      ]
      if (candidates.length) setFeaturedImage(candidates[0])
    }
  }

  const applyStructured = (r: any, imgs: DayImage[]) => {
    if (r.mood) setMood(String(r.mood))
    if (r.sleepHours) setSleepHours(String(r.sleepHours))
    if (r.sleepQuality) setSleepQuality(String(r.sleepQuality))
    if (r.habits && typeof r.habits === 'object') setHabits((h) => ({ ...h, ...r.habits }))
    const dv = r.device
    if (dv) {
      if (dv.iphoneHours != null) setIphoneHours(String(dv.iphoneHours))
      if (dv.socialHours != null) setSocialHours(String(dv.socialHours))
      if (dv.macHours != null) setMacHours(String(dv.macHours))
      if (dv.notes) setDeviceNotes((n) => (n ? n + ' · ' : '') + dv.notes)
    }
    const devUrls = (r.deviceScreens ?? []).map((i: number) => imgs[i]?.url).filter(Boolean)
    if (devUrls.length) setDeviceScreens((s) => [...new Set([...s, ...devUrls])])
    if (Array.isArray(r.trades) && r.trades.length) {
      setTrades(
        r.trades.map((t: any) => ({
          market: String(t.market ?? 'MNQ'),
          session: String(t.session ?? ''),
          direction: t.direction === 'short' ? ('short' as const) : ('long' as const),
          setup: String(t.setup ?? ''),
          entry: t.entry != null ? String(t.entry) : '',
          stop: t.stop != null ? String(t.stop) : '',
          target: t.target != null ? String(t.target) : '',
          exit: t.exit != null ? String(t.exit) : '',
          riskPoints: t.riskPoints != null ? String(t.riskPoints) : '',
          points: t.points != null ? String(t.points) : '',
          confidence: t.confidence ? String(t.confidence) : '',
          note: String(t.note ?? ''),
          screenshots: (t.screenshotIndices ?? []).map((i: number) => imgs[i]?.url).filter(Boolean),
          executions: Array.isArray(t.accounts) && t.accounts.length
            ? t.accounts.map((a: string) => ({ account: a, size: '' }))
            : [],
        })),
      )
    }
    const j = r.journal
    if (j) {
      if (j.title) setTitle(String(j.title))
      if (j.summary) setSummary(String(j.summary))
      if (Array.isArray(j.tags) && j.tags.length) setTags(j.tags.join(', '))
      if (j.draft) {
        setContent((c) => (c && c.trim() ? c : String(j.draft)))
        if (!content && j.draft) {
          // draft landed — surface it
        }
      }
    }
    setDirty(true)
    setTimeout(autoFeatured, 0)
  }

  const runStructure = async (imgs?: DayImage[]) => {
    const images = imgs ?? dayImagesRef.current
    if (!dayText.trim() && images.length === 0) return notify('paste text or screenshots first', false)
    setDayBusy(true)
    try {
      const res = await api<{ result: any }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'day', text: dayText, images: images.map((i) => i.dataUrl) },
      })
      applyStructured(res.result, images)
      setDayText('')
      dayImagesRef.current = []
      setDayImages([])
      notify('day built from your evidence — review, override if needed, then save')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ai failed', false)
    }
    setDayBusy(false)
  }

  // ---------- reflection: AI draft from today's data ----------
  const daySnapshot = () =>
    [
      `date: ${date}`,
      mood ? `mood: ${mood}/5` : '',
      sleepHours || sleepQuality ? `sleep: ${sleepHours || '?'}h quality ${sleepQuality || '?'}/5` : '',
      Object.keys(habits).length ? `habits done: ${Object.entries(habits).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}` : '',
      iphoneHours || socialHours || macHours
        ? `screen: iphone ${iphoneHours || '?'}h, social ${socialHours || '?'}h, mac ${macHours || '?'}h${deviceNotes ? ` — ${deviceNotes}` : ''}`
        : deviceNotes
          ? `screen note: ${deviceNotes}`
          : '',
      trades.length
        ? trades.map((t, i) => {
            const risk = t.riskPoints !== '' ? parseFloat(t.riskPoints) : t.stop !== '' && t.entry !== '' ? Math.abs(parseFloat(t.entry) - parseFloat(t.stop)) : NaN
            const pts = t.points !== '' ? parseFloat(t.points) : t.entry !== '' && t.exit !== '' ? (t.direction === 'long' ? parseFloat(t.exit) - parseFloat(t.entry) : parseFloat(t.entry) - parseFloat(t.exit)) : NaN
            const R = Number.isFinite(risk) && risk > 0 && Number.isFinite(pts) ? (pts / risk).toFixed(2) : '?'
            const accs = t.executions.filter((e) => e.account).map((e) => e.account).join(', ')
            return `trade ${i + 1}: ${t.direction} ${t.market} ${t.setup || 'no-setup'} ${t.session || ''} entry ${t.entry} stop ${t.stop || '?'} exit ${t.exit} points ${Number.isFinite(pts) ? pts : '?'} R ${R}${accs ? ` on ${accs}` : ''}${t.note ? ` — ${t.note}` : ''}`
          }).join('\n')
        : 'no trades',
    ].filter(Boolean).join('\n')

  const runDraft = async () => {
    if (content.trim() && !confirm('replace the current reflection with a fresh AI draft?')) return
    setDraftBusy(true)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'draft', text: daySnapshot() },
      })
      setContent(res.result)
      markDirty()
      notify('draft written — edit it, then save')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ai failed', false)
    }
    setDraftBusy(false)
  }

  // ---------- save ----------
  const save = async (rebuild = false) => {
    setSaving(true)
    try {
      await api('/api/admin/days', {
        method: 'POST',
        body: {
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
        },
      })

      if (title.trim() || summary.trim() || tags.trim() || content.trim() || featuredImage) {
        await api('/api/admin/journal', {
          method: 'POST',
          body: {
            date,
            day: title.trim() || undefined,
            summary: summary.trim() || undefined,
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
            featuredImage: featuredImage.trim() || undefined,
            content,
          },
        })
      }

      setDirty(false)
      notifyChanged()
      if (rebuild) triggerRebuild()
      notify(rebuild ? `day ${date} saved — rebuild started` : `day ${date} saved — queued for rebuild`)
      await load(date)
      await loadDays()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
    setSaving(false)
  }

  const removeDay = async () => {
    if (!confirm(`hard-delete day ${date}? the day record and its journal are removed permanently.`)) return
    try {
      await api('/api/admin/days', { method: 'DELETE', body: { date } })
      try {
        await api('/api/admin/journal', { method: 'DELETE', body: { file: `${date}.mdx` } })
      } catch {}
      notify(`day ${date} deleted — queued for rebuild`)
      notifyChanged()
      setDate(todayStr())
      await loadDays()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  // ---------- helpers ----------
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
        markDirty()
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

  const idx = daysList.findIndex((d) => d.date === date)
  const prevDay = idx < daysList.length - 1 ? daysList[idx + 1] : null
  const nextDay = idx > 0 ? daysList[idx - 1] : null

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

  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.firm} ${a.sizeLabel}` : id
  }
  const tradeR = (t: TradeForm) => {
    const risk = t.riskPoints !== '' ? parseFloat(t.riskPoints) : t.stop !== '' && t.entry !== '' ? Math.abs(parseFloat(t.entry) - parseFloat(t.stop)) : NaN
    const pts = t.points !== '' ? parseFloat(t.points) : t.entry !== '' && t.exit !== '' ? (t.direction === 'long' ? parseFloat(t.exit) - parseFloat(t.entry) : parseFloat(t.entry) - parseFloat(t.exit)) : NaN
    if (!Number.isFinite(risk) || !Number.isFinite(pts) || risk <= 0) return null
    return { R: pts / risk, pts }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl">/ day</h1>
          <span className={`text-[12px] ${dirty ? 'text-warn' : 'text-faint'}`}>{dirty ? '● unsaved' : 'saved'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => save(false)} disabled={saving}>{saving ? 'saving…' : 'save'}</Button>
          <Button size="sm" variant="primary" onClick={() => save(true)} disabled={saving}>save &amp; rebuild</Button>
          {daysList.some((d) => d.date === date) && (
            <Button size="sm" variant="danger" onClick={removeDay}>delete day</Button>
          )}
          <TextInput type="date" value={date} onChange={(e) => selectDate(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[210px_1fr]">
        <aside className="panel max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 border-b border-line bg-panel px-3 py-2 text-[11px] uppercase tracking-widest text-dim">
            {daysList.length} days
          </div>
          <div className="flex items-center justify-between border-b border-line/60 px-2 py-1.5 text-[12px]">
            <button disabled={!prevDay} onClick={() => prevDay && selectDate(prevDay.date)} className="text-dim hover:text-ink disabled:opacity-30">← newer</button>
            <span className="text-faint">{date}</span>
            <button disabled={!nextDay} onClick={() => nextDay && selectDate(nextDay.date)} className="text-dim hover:text-ink disabled:opacity-30">older →</button>
          </div>
          {daysList.map((d) => (
            <button
              key={d.file}
              onClick={() => selectDate(d.date)}
              className={`block w-full border-b border-line/60 px-3 py-2 text-left text-[12px] transition-colors hover:bg-raise ${d.date === date ? 'bg-raise text-ink' : 'text-dim'}`}
            >
              <div className="flex items-center justify-between">
                <span>{d.date}</span>
                {d.mood && <span className="text-faint">mood {d.mood}</span>}
              </div>
              <div className="text-[11px] text-faint">{d.trades} trades</div>
            </button>
          ))}
          {daysList.length === 0 && <div className="px-3 py-6 text-[12px] text-faint">no days yet</div>}
        </aside>

        <div className="space-y-6">
          {loading ? (
            <Card title="loading"><p className="text-[13px] text-faint">loading…</p></Card>
          ) : (
            <>
              {/* ---------- CAPTURE ---------- */}
              <Card title="capture — paste everything, AI builds the day">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <TextArea
                    rows={2}
                    placeholder="free text: what happened, how you felt, the trades… or just paste screenshots."
                    value={dayText}
                    onChange={(e) => { setDayText(e.target.value); markDirty() }}
                  />
                  <div className="flex items-end">
                    <Button onClick={() => runStructure()} disabled={dayBusy || (!dayText.trim() && dayImagesRef.current.length === 0)}>
                      {dayBusy ? 'reading everything…' : 'build this day →'}
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <ImageDropZone onFiles={addDayImages} label="paste screenshots — trade charts, screen-time, notes. the AI sorts them." />
                </div>
                {dayImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-3 md:grid-cols-6">
                    {dayImages.map((img) => (
                      <div key={img.id} className="relative border border-line bg-bg">
                        <img src={img.url} alt="" className="h-16 w-full object-cover" />
                        <button onClick={() => removeDayImage(img.id)} className="absolute right-1 top-1 border border-line bg-bg px-1.5 text-[11px] text-down hover:border-down">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ---------- DAY SUMMARY (evidence-first) ---------- */}
              <Card title={`day — ${date}`}>
                <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                  {/* mood */}
                  <div className="border-b border-line/60 pb-3">
                    <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">mood</div>
                    {editing === 'mood' ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((m) => (
                            <button key={m} onClick={() => { setMood(String(m)); setEditing(null) }}
                              className={`h-8 w-8 border text-[13px] ${mood === String(m) ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-dim'}`}>{m}</button>
                          ))}
                        </div>
                        <Button size="sm" onClick={() => setEditing(null)}>done</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[15px] text-ink">
                        {mood ? `${mood}/5` : '—'}
                        <button onClick={() => setEditing('mood')} className="text-[11px] text-faint hover:text-accent" title="correct">✎</button>
                      </div>
                    )}
                  </div>

                  {/* sleep */}
                  <div className="border-b border-line/60 pb-3">
                    <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">sleep</div>
                    {editing === 'sleep' ? (
                      <div className="flex items-center gap-2">
                        <NumInput value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className="w-24" placeholder="7.5" />
                        <NumInput value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} className="w-20" placeholder="quality" />
                        <Button size="sm" onClick={() => setEditing(null)}>done</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[15px] text-ink">
                        {sleepHours ? `${sleepHours}h` : '—'}{sleepQuality ? ` · ${sleepQuality}/5` : ''}
                        <button onClick={() => setEditing('sleep')} className="text-[11px] text-faint hover:text-accent">✎</button>
                      </div>
                    )}
                  </div>

                  {/* screen-time — values come from the screenshot */}
                  <div className="md:col-span-2 border-b border-line/60 pb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-widest text-dim">screen time</span>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-[11px] text-accent hover:text-ink">
                          {screenBusy ? 'reading…' : '＋ paste screenshot'}
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onDeviceScreens(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                        </label>
                        {editing === 'screen' && <Button size="sm" onClick={() => setEditing(null)}>done</Button>}
                      </div>
                    </div>
                    {editing === 'screen' ? (
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="iphone (h)"><NumInput value={iphoneHours} onChange={(e) => setIphoneHours(e.target.value)} /></Field>
                        <Field label="social (h)"><NumInput value={socialHours} onChange={(e) => setSocialHours(e.target.value)} /></Field>
                        <Field label="mac (h)"><NumInput value={macHours} onChange={(e) => setMacHours(e.target.value)} /></Field>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-soft">
                        <span>iphone <span className="text-ink">{iphoneHours || '—'}h</span></span>
                        <span>social <span className="text-ink">{socialHours || '—'}h</span></span>
                        <span>mac <span className="text-ink">{macHours || '—'}h</span></span>
                        {deviceNotes && <span className="text-dim">— {deviceNotes}</span>}
                        <button onClick={() => setEditing('screen')} className="text-[11px] text-faint hover:text-accent">✎</button>
                      </div>
                    )}
                    {deviceScreens.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-6">
                        {deviceScreens.map((s) => (
                          <div key={s} className="relative border border-line bg-bg">
                            <img src={s} alt="" className="h-14 w-full object-cover" />
                            <button onClick={() => setDeviceScreens((x) => x.filter((y) => y !== s))} className="absolute right-0.5 top-0.5 border border-line bg-bg px-1 text-[10px] text-down hover:border-down">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* habits */}
                  <div className="md:col-span-2">
                    <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">habits</div>
                    <div className="flex flex-wrap gap-2">
                      {habitDefs.map((h) => {
                        const done = habits[h.slug] === true
                        return (
                          <button
                            key={h.slug}
                            onClick={() => { setHabits((x) => ({ ...x, [h.slug]: !done })); markDirty() }}
                            className={`border px-2.5 py-1 text-[12px] transition-colors ${done ? 'border-transparent text-bg' : 'border-line2 text-dim hover:border-accent'}`}
                            style={done ? { background: h.color } : {}}
                          >
                            {h.emoji ?? '·'} {h.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* trades */}
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-widest text-dim">trades ({trades.length})</span>
                    <Button size="sm" onClick={() => { setTrades((ts) => [...ts, emptyTrade()]); setExpandedTrade(trades.length); markDirty() }}>+ add trade</Button>
                  </div>
                  <div className="space-y-2">
                    {trades.map((t, ti) => {
                      const r = tradeR(t)
                      const open = expandedTrade === ti
                      return (
                        <div key={ti} className="border border-line bg-bg">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                            <button
                              onClick={() => { setExpandedTrade(open ? null : ti); markDirty() }}
                              className="flex flex-1 items-baseline gap-3 text-left"
                            >
                              <span className="text-[12px] text-faint">{open ? '▾' : '▸'}</span>
                              <span className="text-[14px] text-ink">
                                {t.direction === 'long' ? '▲' : '▼'} {t.market || 'MNQ'}
                              </span>
                              <span className="text-[12px] text-dim">{t.setup || '—'} · {t.session || '—'}</span>
                            </button>
                            <span className={`text-[13px] ${r && r.R > 0 ? 'text-up' : r && r.R < 0 ? 'text-down' : 'text-dim'}`}>
                              {r ? `${r.R > 0 ? '+' : ''}${r.R.toFixed(2)}R` : '—'}
                            </span>
                            <span className={`text-[12px] ${r && r.pts >= 0 ? 'text-up' : r ? 'text-down' : 'text-dim'}`}>
                              {r ? `${r.pts >= 0 ? '+' : ''}${r.pts}pts` : ''}
                            </span>
                            {t.executions.filter((e) => e.account).length > 0 && (
                              <span className="text-[11px] text-dim">{t.executions.filter((e) => e.account).map((e) => accountLabel(e.account)).join(' · ')}</span>
                            )}
                            {t.screenshots[0] && <img src={t.screenshots[0]} alt="" className="h-8 w-12 border border-line object-cover" />}
                            <Button size="sm" variant="danger" onClick={() => setTrades((ts) => ts.filter((_, j) => j !== ti))}>×</Button>
                          </div>
                          {open && (
                            <div className="border-t border-line p-3">
                              <div className="grid gap-2 md:grid-cols-5">
                                <Field label="market"><TextInput value={t.market} onChange={(e) => setTrade(ti, { market: e.target.value })} /></Field>
                                <Field label="session">
                                  <Select value={t.session} onChange={(e) => setTrade(ti, { session: e.target.value })}>
                                    <option value="">—</option>
                                    {['asia', 'london', 'ny-am', 'ny-pm', 'ny'].map((s) => <option key={s} value={s}>{s}</option>)}
                                  </Select>
                                </Field>
                                <Field label="direction">
                                  <Select value={t.direction} onChange={(e) => setTrade(ti, { direction: e.target.value as 'long' | 'short' })}>
                                    <option value="long">long</option><option value="short">short</option>
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
                                      <Select value={e.account} onChange={(ev) => setTrades((ts) => ts.map((x, j) => j === ti ? { ...x, executions: x.executions.map((y, k) => k === ei ? { ...y, account: ev.target.value } : y) } : x))} className="flex-1">
                                        <option value="">— account —</option>
                                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.firm} {a.sizeLabel}</option>)}
                                      </Select>
                                      <TextInput value={e.size} onChange={(ev) => setTrades((ts) => ts.map((x, j) => j === ti ? { ...x, executions: x.executions.map((y, k) => k === ei ? { ...y, size: ev.target.value } : y) } : x))} className="w-20" placeholder="1" />
                                      <Button size="sm" variant="danger" onClick={() => setTrades((ts) => ts.map((x, j) => j === ti ? { ...x, executions: x.executions.filter((_, k) => k !== ei) } : x))}>×</Button>
                                    </div>
                                  ))}
                                  <Button size="sm" onClick={() => setTrades((ts) => ts.map((x, j) => j === ti ? { ...x, executions: [...x.executions, { account: '', size: '' }] } : x))}>+ execution</Button>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <ImageDropZone onFiles={(fs) => onTradeScreens(ti, fs)} label="paste this trade's chart →" className="!py-2" />
                                <div className="grid flex-1 grid-cols-4 gap-2">
                                  {t.screenshots.map((s) => (
                                    <div key={s} className="relative border border-line bg-bg">
                                      <img src={s} alt="" className="h-14 w-full object-cover" />
                                      <button onClick={() => setTrade(ti, { screenshots: t.screenshots.filter((y) => y !== s) })} className="absolute right-0.5 top-0.5 border border-line bg-bg px-1 text-[10px] text-down hover:border-down">×</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {trades.length === 0 && <p className="text-[12px] text-faint">no trades — paste charts above to build the day.</p>}
                  </div>
                </div>
              </Card>

              {/* ---------- REFLECTION ---------- */}
              <Card
                title="reflection"
                actions={
                  <Button size="sm" variant="primary" onClick={runDraft} disabled={draftBusy}>
                    {draftBusy ? 'drafting…' : 'AI draft from today'}
                  </Button>
                }
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="title"><TextInput value={title} onChange={(e) => { setTitle(e.target.value); markDirty() }} placeholder="AI suggests" /></Field>
                  <Field label="summary"><TextInput value={summary} onChange={(e) => { setSummary(e.target.value); markDirty() }} placeholder="one line" /></Field>
                  <Field label="tags (comma)"><TextInput value={tags} onChange={(e) => { setTags(e.target.value); markDirty() }} placeholder="discipline, revenge" /></Field>
                </div>
                <div className="mt-3">
                  <JournalEditor key={date + (content ? '-c' : '-e')} initialContent={content} onChange={(md) => { setContent(md); markDirty() }} />
                </div>
                {featuredImage && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-[11px] uppercase tracking-widest text-dim">featured</span>
                    <img src={featuredImage} alt="" className="h-12 w-20 border border-line object-cover" />
                    <TextInput value={featuredImage} onChange={(e) => { setFeaturedImage(e.target.value); markDirty() }} className="flex-1" />
                  </div>
                )}
              </Card>

              {/* ---------- FOOTER ---------- */}
              <div className="flex flex-wrap items-center gap-6 border border-line bg-bg px-4 py-3 text-[13px]">
                <span className="text-dim">day</span>
                <span className="num-up">{dayTotals.R > 0 ? '+' : ''}{dayTotals.R.toFixed(2)}R</span>
                <span className="text-dim">·</span>
                <span className={dayTotals.pts >= 0 ? 'text-up' : 'text-down'}>{dayTotals.pts >= 0 ? '+' : ''}{dayTotals.pts.toFixed(1)}pts</span>
                <span className="text-dim">·</span>
                <span className={dayTotals.pnl >= 0 ? 'text-up' : 'text-down'}>{dayTotals.pnl >= 0 ? '+' : ''}${Math.round(dayTotals.pnl).toLocaleString()}</span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => save(false)} disabled={saving}>{saving ? 'saving…' : 'save'}</Button>
                  <Button size="sm" variant="primary" onClick={() => save(true)} disabled={saving}>save &amp; rebuild</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
