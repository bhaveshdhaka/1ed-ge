import { useCallback, useEffect, useRef, useState } from 'react'
import { api, todayStr, fileToDataUrl, uploadDataUrl, notifyChanged, triggerRebuild, setPasteSink, fetchRebuildState, bus } from '../api'
import { fmtDay } from '../../../lib/dates'
import { Card, Button, Field, TextInput, NumInput, TextArea, Select } from '../ui'
import { MarketCard } from '../MarketCard'
import { ImageDropZone } from '../ImageDropZone'
import { MarkdownEditor } from '../MarkdownEditor'
import { IngestPanel } from '../IngestPanel'
import { DayRail } from '../DayRail'
import { TradeCard } from '../TradeCard'
import { StatusLine } from '../StatusLine'

export interface AccRow { id: string; firm: string; sizeLabel: string; pointsValue: number }
interface HabitDef { slug: string; name: string; emoji?: string; color: string }
export interface DayListItem { file: string; date: string; mood: number | null; trades: number; R?: number | null }
interface DayImage { id: string; dataUrl: string; url: string }
interface ExecForm { account: string; size: string }
export interface TradeForm {
  market: string; session: string; direction: 'long' | 'short'; setup: string
  entry: string; stop: string; target: string; exit: string; riskPoints: string; points: string
  confidence: string; note: string; model: string; commentary: string
  models: string[]
  screenshots: string[]; executions: ExecForm[]
}

interface MomentForm {
  at: string; type: string; text: string; tradeIdx: string; author: string; images: string[]
}

const emptyTrade = (): TradeForm => ({
  market: 'MNQ', session: '', direction: 'long', setup: '',
  entry: '', stop: '', target: '', exit: '', riskPoints: '', points: '',
  confidence: '', note: '', model: '', commentary: '', models: [], screenshots: [], executions: [],
})

const toTradeForm = (t: any): TradeForm => ({
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
  model: String(t.model ?? ''),
  commentary: String(t.commentary ?? ''),
  models: Array.isArray(t.models) && t.models.length ? t.models.map(String) : t.model ? [String(t.model)] : [],
  screenshots: [],
  executions: Array.isArray(t.accounts) && t.accounts.length
    ? t.accounts.map((a: string) => ({ account: a, size: '' }))
    : [],
})

export function DayWorkspace({
  notify,
  onDirtyChange,
}: {
  notify: (m: string, ok?: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [date, setDate] = useState(todayStr())
  const [daysList, setDaysList] = useState<DayListItem[]>([])
  const [pendingObligationDates, setPendingObligationDates] = useState<Set<string>>(new Set())
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
  const [models, setModels] = useState<{ slug: string; name: string; premise?: string }[]>([])
  const [reflection, setReflection] = useState('')
  const [draftMoments, setDraftMoments] = useState<MomentForm[]>([])
  const [stream, setStream] = useState<MomentForm[]>([])

  const [dayText, setDayText] = useState('')
  const [dayImages, setDayImages] = useState<DayImage[]>([])
  const dayImagesRef = useRef<DayImage[]>([])
  // trades produced by the last AI structure pass — a fresh pass replaces these
  const lastAiTradesRef = useRef<TradeForm[]>([])

  const [editing, setEditing] = useState<string | null>(null)
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null)
  const [expandAll, setExpandAll] = useState(false)
  const [pendingLabels, setPendingLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dayBusy, setDayBusy] = useState(false)
  const [screenBusy, setScreenBusy] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  // wired by Task 11 (autosave) — set to current HH:MM after every autosave succeeds
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const markDirty = () => {
    setDirty(true)
    onDirtyChange?.(true)
  }

  const clearDirty = () => {
    setDirty(false)
    onDirtyChange?.(false)
  }

  const load = useCallback(
    async (d: string) => {
      setLoading(true)
      setEditing(null)
      setExpandedTrade(null)
      setExpandAll(false)
      lastAiTradesRef.current = []
      try {
        const res = await api<{ day: any; accounts: AccRow[]; habits: HabitDef[]; models: { slug: string; name: string; premise?: string }[] }>(
          `/api/admin/days?date=${encodeURIComponent(d)}`,
        )
        setAccounts(res.accounts)
        setHabitDefs(res.habits)
        setModels(res.models ?? [])
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
        setReflection(String(day?.draft?.reflection ?? ''))
        setDraftMoments((day?.draft?.moments ?? []).map(toMomentForm))
        setStream((day?.stream ?? []).map(toMomentForm))
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
          model: String(t.model ?? ''),
          commentary: String(t.commentary ?? ''),
          models: Array.isArray(t.models) && t.models.length ? t.models.map(String) : t.model ? [String(t.model)] : [],
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
        // seed the draft from the published body when no draft exists yet
        setReflection((r) => (r ? r : j?.content ?? ''))

        clearDirty()
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

  const refreshPending = useCallback(async () => {
    try {
      const st = await fetchRebuildState()
      setPendingLabels(st.pending.map((p) => p.label))
    } catch {}
  }, [])

  useEffect(() => {
    load(date)
    loadDays()
    refreshPending()
  }, [date, load, loadDays, refreshPending])

  // keep the published/draft indicator fresh while mounted
  useEffect(() => {
    const id = setInterval(refreshPending, 4000)
    const off = bus.on(refreshPending)
    return () => {
      clearInterval(id)
      off()
    }
  }, [refreshPending])

  useEffect(() => {
    setPasteSink((files) => addDayImages(files))
    return () => setPasteSink(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTrade = (i: number, patch: Partial<TradeForm>) => {
    setTrades((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
    markDirty()
  }

  const toMomentForm = (m: any): MomentForm => ({
    at: String(m?.at ?? ''),
    type: String(m?.type ?? 'note'),
    text: String(m?.text ?? ''),
    tradeIdx: m?.tradeIdx != null ? String(m.tradeIdx) : '',
    author: String(m?.author ?? ''),
    images: Array.isArray(m?.images) ? m.images.map(String) : [],
  })
  const momentPayload = (m: MomentForm) => ({
    at: m.at || '00:00',
    type: m.type,
    ...(m.text.trim() ? { text: m.text.trim() } : {}),
    ...(m.type === 'trade' && m.tradeIdx !== '' ? { tradeIdx: parseInt(m.tradeIdx, 10) } : {}),
    ...(m.author.trim() ? { author: m.author.trim() } : {}),
    ...(m.images.length ? { images: m.images } : {}),
  })
  const setMoment = (i: number, patch: Partial<MomentForm>) => {
    setDraftMoments((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    markDirty()
  }
  const publishMoment = (i: number) => {
    const m = draftMoments[i]
    if (m.type === 'trade' && m.tradeIdx === '') return notify('pick a trade for this moment', false)
    if (m.type !== 'trade' && !m.text.trim() && !m.images.length) return notify('write the moment text or attach an image first', false)
    setStream((s) => [...s, m])
    setDraftMoments((ms) => ms.filter((_, j) => j !== i))
    markDirty()
  }
  /** publish a trade card straight to the stream as a trade moment (same pattern as publishMoment). */
  const publishTradeMoment = (ti: number) => {
    const m: MomentForm = { at: '', type: 'trade', text: '', tradeIdx: String(ti), author: '', images: [] }
    setStream((s) => [...s, m])
    markDirty()
    notify('trade added to the stream — queued for rebuild')
  }
  const unstreamMoment = (i: number) => {
    setStream((s) => s.filter((_, j) => j !== i))
    markDirty()
  }
  const polishMoment = async (i: number) => {
    const m = draftMoments[i]
    if (!m.text.trim()) return notify('write something to polish first', false)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'assist', kind: 'polish', text: m.text },
      })
      setMoment(i, { text: res.result })
      notify('polished — review it, then publish')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'polish failed', false)
    }
  }

  const selectDate = (d: string) => {
    if (!d || d === date) return
    if (dirty && !confirm(`unsaved changes on ${date} — discard and open ${d}?`)) return
    setDate(d)
  }

  // ---------- capture: paste everything, AI builds the day ----------
  const addDayImages = async (files: File[]) => {
    const items: DayImage[] = []
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f)
        items.push({ id: Math.random().toString(36).slice(2), dataUrl, url: '' })
      } catch (e) {
        notify(e instanceof Error ? e.message : 'read failed', false)
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
    if (!featuredImage && deviceScreens.length) setFeaturedImage(deviceScreens[0])
  }

  const applyStructured = (r: any, images?: DayImage[]) => {
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
    if (images?.length && Array.isArray(r.deviceScreens) && (r.deviceScreens as number[]).length) {
      const urls = (r.deviceScreens as number[])
        .filter((idx: number) => idx >= 0 && idx < images.length)
        .map((idx: number) => images[idx].dataUrl)
      if (urls.length) {
        setDeviceScreens((prev: string[]) => [...prev, ...urls])
      }
    }
    if (Array.isArray(r.trades) && r.trades.length) {
      const incomingForms = r.trades.map(toTradeForm)
      if (images?.length) {
        for (let i = 0; i < incomingForms.length; i++) {
          const indices = r.trades[i]?.screenshotIndices as number[] | undefined
          if (indices?.length) {
            incomingForms[i].screenshots = indices
              .filter((idx: number) => idx >= 0 && idx < images.length)
              .map((idx: number) => images[idx].dataUrl)
          }
        }
      }
      const prev = lastAiTradesRef.current
      lastAiTradesRef.current = incomingForms
      // a fresh structure pass replaces the trades from the previous AI pass;
      // trades the owner added or edited since then survive (identity match)
      setTrades((existing) => {
        const kept = prev.length ? existing.filter((t) => !prev.includes(t)) : existing
        return [...kept, ...incomingForms]
      })
    }
    const j = r.journal
    if (j) {
      if (j.title) setTitle(String(j.title))
      if (j.summary) setSummary(String(j.summary))
      if (Array.isArray(j.tags) && j.tags.length) setTags(j.tags.join(', '))
      if (j.draft) {
        setReflection((r) => (r && r.trim() ? r : String(j.draft)))
      }
    }
    markDirty()
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
    if (reflection.trim() && !confirm('replace the current reflection draft with a fresh AI draft?')) return
    setDraftBusy(true)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'draft', text: daySnapshot() },
      })
      setReflection(res.result)
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
          stream: stream.map(momentPayload),
          ...(draftMoments.length || reflection.trim()
            ? {
                draft: {
                  ...(reflection.trim() ? { reflection: reflection.trim() } : {}),
                  ...(draftMoments.length ? { moments: draftMoments.map(momentPayload) } : {}),
                },
              }
            : {}),
        },
      })

      clearDirty()
      notifyChanged()
      if (rebuild) {
        try {
          await triggerRebuild()
        } catch {
          notify('saved, but the rebuild failed to start', false)
        }
        notify(`day ${date} saved — publishing… the bar will flash when it is live`)
      } else {
        notify(`day ${date} saved — queued for rebuild`)
      }
      await load(date)
      await loadDays()
      await refreshPending()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
    setSaving(false)
  }

  const publishReflection = async () => {
    if (!reflection.trim()) return notify('write a reflection draft first', false)
    setSaving(true)
    try {
      await api('/api/admin/journal', {
        method: 'POST',
        body: {
          date,
          day: title.trim() || undefined,
          summary: summary.trim() || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          featuredImage: featuredImage.trim() || undefined,
          content: reflection,
        },
      })
      setContent(reflection)
      notify('reflection published — queued for rebuild')
      notifyChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'publish failed', false)
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
      // Load today's data immediately so the form reflects today, not the deleted day
      const t = todayStr()
      await load(t)
      setDate(t)
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

  const onMomentImages = async (i: number, files: File[]) => {
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f)
        const url = await uploadDataUrl(dataUrl, f.name)
        setDraftMoments((ms) => ms.map((m, j) => (j === i ? { ...m, images: [...m.images, url] } : m)))
        markDirty()
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

  // status-line readouts (footer)
  const totalR = `${dayTotals.R > 0 ? '+' : ''}${dayTotals.R.toFixed(2)}R`
  const tradeCount = trades.length
  const habitsDone = habitDefs.filter((h) => habits[h.slug] === true).length
  const habitsTotal = habitDefs.length
  const showPublishHint = !!reflection.trim() || draftMoments.length > 0

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hasDayRecord = daysList.some((d) => d.date === date)
  const dayPending = pendingLabels.some((l) => l.includes(date))
  const previewHref = `/zen/preview/${date}`
  const editableHint = 'underline decoration-dashed decoration-line2 underline-offset-4 hover:text-accent hover:decoration-accent cursor-pointer'

  // day-level keyboard shortcuts (global save handled in AdminApp)
  useEffect(() => {
    const offSave = bus.on('save', () => save(false))
    const offRebuild = bus.on('save-rebuild', () => save(true))
    const offPrev = bus.on('prev-day', () => prevDay && selectDate(prevDay.date))
    const offNext = bus.on('next-day', () => nextDay && selectDate(nextDay.date))
    const offToday = bus.on('today', () => selectDate(todayStr()))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      offSave()
      offRebuild()
      offPrev()
      offNext()
      offToday()
      window.removeEventListener('keydown', onKey)
    }
  })

  return (
    <div className="space-y-6">
      {/* sticky section jump (desktop) */}
      <div className="sticky top-safe-14 z-30 -mx-2 hidden border-b border-line bg-bg/95 px-2 py-1 backdrop-blur md:block">
        <div className="flex gap-1 overflow-x-auto text-[12px]">
          {[
            ['capture', 'sec-capture'],
            ['day', 'sec-day'],
            ['trades', 'sec-trades'],
            ['moments', 'sec-moments'],
            ['reflection', 'sec-reflection'],
          ].map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)} className="h-8 whitespace-nowrap px-2 text-dim transition-colors hover:text-ink">
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl">/ day</h1>
          <span
            className={`text-[12px] ${
              dirty ? 'text-warn' : dayPending ? 'text-warn' : hasDayRecord || content.trim() ? 'text-up' : 'text-faint'
            }`}
          >
            {dirty ? '● unsaved draft' : dayPending ? '● draft saved · not published' : hasDayRecord || content.trim() ? '● published' : '— no day yet'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasDayRecord && (
            <a href={`/day/${fmtDay(date)}`} target="_blank" className="flex h-9 items-center border border-line px-2.5 text-[12px] text-accent transition-colors hover:border-accent">
              view live →
            </a>
          )}
          <a href={previewHref} target="_blank" className="flex h-9 items-center border border-line px-2.5 text-[12px] text-dim transition-colors hover:border-accent hover:text-ink">
            preview →
          </a>
          {daysList.some((d) => d.date === date) && (
            <Button size="sm" variant="danger" onClick={removeDay}>delete day</Button>
          )}
          <TextInput type="date" aria-label="day date" value={date} onChange={(e) => selectDate(e.target.value)} className="h-9 w-40" />
          <Button size="sm" onClick={() => save(false)} disabled={saving}>{saving ? 'saving…' : 'save'}</Button>
          <Button size="sm" variant="primary" onClick={() => save(true)} disabled={saving}>save &amp; rebuild</Button>
        </div>
      </div>

      <MarketCard />

      <div className="grid gap-6 lg:grid-cols-[44px_1fr]">
        <DayRail
          days={daysList}
          selectedDate={date}
          onSelectDate={selectDate}
          allDatesIso={daysList.map((d) => d.date)}
          pendingObligationDates={pendingObligationDates}
        />

        <div className="space-y-6">
          {loading ? (
            <Card title="loading"><p className="text-[13px] text-faint">loading…</p></Card>
          ) : (
            <>
              {/* ---------- CAPTURE ---------- */}
              <div id="sec-capture" className="scroll-mt-20">
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
                          <img src={img.url || img.dataUrl} alt="" className="h-16 w-full object-cover" />
                          <button onClick={() => removeDayImage(img.id)} className="absolute right-1 top-1 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg text-[11px] text-down hover:border-down">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* ---------- IMPORT ---------- */}
              <IngestPanel notify={notify} markDirty={markDirty} date={date} onImported={load} />

              {/* ---------- DAY SUMMARY (evidence-first, direct-click edit) ---------- */}
              <div id="sec-day" className="scroll-mt-20">
                <Card title={`day — ${date}`}>
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    {/* mood */}
                    <div className="border-b border-line/60 pb-3">
                      <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">mood</div>
                      {editing === 'mood' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((m) => (
                              <button key={m} onClick={() => { setMood(String(m)); setEditing(null); markDirty() }}
                                className={`h-10 w-10 border text-[13px] ${mood === String(m) ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-dim'}`}>{m}</button>
                            ))}
                          </div>
                          <Button size="sm" onClick={() => setEditing(null)}>done</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing('mood')}
                          className={`text-left text-[15px] text-ink ${editableHint}`}
                          title="click to correct"
                        >
                          {mood ? `${mood}/5` : '—'}
                        </button>
                      )}
                    </div>

                    {/* sleep */}
                    <div className="border-b border-line/60 pb-3">
                      <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">sleep</div>
                      {editing === 'sleep' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <NumInput value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className="h-9 w-24" placeholder="7.5" />
                          <NumInput value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} className="h-9 w-20" placeholder="quality" />
                          <Button size="sm" onClick={() => { setEditing(null); markDirty() }}>done</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing('sleep')}
                          className={`text-left text-[15px] text-ink ${editableHint}`}
                          title="click to correct"
                        >
                          {sleepHours ? `${sleepHours}h` : '—'}{sleepQuality ? ` · ${sleepQuality}/5` : ''}
                        </button>
                      )}
                    </div>

                    {/* screen-time — values come from the screenshot */}
                    <div className="md:col-span-2 border-b border-line/60 pb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-widest text-dim">screen time</span>
                        <div className="flex items-center gap-2">
                          <label className="flex h-8 cursor-pointer items-center text-[11px] text-accent hover:text-ink">
                            {screenBusy ? 'reading…' : '＋ paste screenshot'}
                            <input type="file" accept="image/*" multiple className="hidden" aria-label="paste screen time screenshot" onChange={(e) => { onDeviceScreens(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                          </label>
                          {editing === 'screen' && <Button size="sm" onClick={() => { setEditing(null); markDirty() }}>done</Button>}
                        </div>
                      </div>
                      {editing === 'screen' ? (
                        <div className="grid grid-cols-3 gap-3">
                          <Field label="iphone (h)"><NumInput value={iphoneHours} onChange={(e) => setIphoneHours(e.target.value)} /></Field>
                          <Field label="social (h)"><NumInput value={socialHours} onChange={(e) => setSocialHours(e.target.value)} /></Field>
                          <Field label="mac (h)"><NumInput value={macHours} onChange={(e) => setMacHours(e.target.value)} /></Field>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing('screen')}
                          className={`text-left text-[13px] text-soft ${editableHint}`}
                          title="click to correct"
                        >
                          <span>iphone <span className="text-ink">{iphoneHours || '—'}h</span></span>
                          <span className="mx-2 text-faint">·</span>
                          <span>social <span className="text-ink">{socialHours || '—'}h</span></span>
                          <span className="mx-2 text-faint">·</span>
                          <span>mac <span className="text-ink">{macHours || '—'}h</span></span>
                          {deviceNotes && <span className="text-dim"> — {deviceNotes}</span>}
                        </button>
                      )}
                      {deviceScreens.length > 0 && (
                        <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-6">
                          {deviceScreens.map((s) => (
                            <div key={s} className="relative border border-line bg-bg">
                              <img src={s} alt="" className="h-14 w-full object-cover" />
                              <button onClick={() => setDeviceScreens((x) => x.filter((y) => y !== s))} className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg text-[10px] text-down hover:border-down">×</button>
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
                              className={`flex h-9 items-center border px-2.5 text-[12px] transition-colors ${done ? 'border-transparent text-bg' : 'border-line2 text-dim hover:border-accent'}`}
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
                  <div id="sec-trades" className="mt-5 scroll-mt-20">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-widest text-dim">trades ({trades.length})</span>
                      <div className="flex items-center gap-2">
                        {trades.length > 0 && (
                          <Button size="sm" onClick={() => { setExpandAll((e) => !e); setExpandedTrade(null) }}>
                            {expandAll ? 'collapse all' : 'expand all'}
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { setTrades((ts) => [...ts, emptyTrade()]); setExpandAll(false); setExpandedTrade(trades.length); markDirty() }}>+ add trade</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {trades.map((t, ti) => (
                        <TradeCard
                          key={ti}
                          index={ti}
                          trade={{ ...t, models: (t as any).models ?? (t.model ? [t.model] : []) }}
                          allModels={models}
                          accountLabel={accountLabel}
                          accounts={accounts}
                          onChange={(patch) => setTrade(ti, patch)}
                          expanded={expandAll || expandedTrade === ti}
                          onToggle={() => {
                            if (expandAll) { setExpandAll(false); setExpandedTrade(ti) }
                            else setExpandedTrade(expandedTrade === ti ? null : ti)
                          }}
                          onRemove={() => setTrades((ts) => ts.filter((_, j) => j !== ti))}
                          onTradeScreens={(fs) => onTradeScreens(ti, fs)}
                          onPublish={() => publishTradeMoment(ti)}
                        />
                      ))}
                      {trades.length === 0 && <p className="text-[12px] text-faint">no trades — paste charts above to build the day.</p>}
                    </div>
                  </div>
                </Card>
              </div>

              {/* ---------- MOMENTS (stream) ---------- */}
              <div id="sec-moments" className="scroll-mt-20">
                <Card
                  title={`moments — stream (${stream.length} live · ${draftMoments.length} draft)`}
                  actions={
                    <Button size="sm" onClick={() => { setDraftMoments((ms) => [...ms, { at: '', type: 'note', text: '', tradeIdx: '', author: '', images: [] }]); markDirty() }}>
                      + new moment
                    </Button>
                  }
                >
                  {draftMoments.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="text-[11px] uppercase tracking-widest text-warn">draft moments — not public</div>
                      {draftMoments.map((m, i) => {
                        const tradeShots = trades[parseInt(m.tradeIdx, 10)]?.screenshots ?? []
                        return (
                        <div key={i} className="border border-line bg-bg p-3">
                          <div className="grid gap-2 md:grid-cols-[64px_130px_1fr]">
                            <Field label="at (HH:MM)"><TextInput value={m.at} onChange={(e) => setMoment(i, { at: e.target.value })} placeholder="08:30" /></Field>
                            <Field label="type">
                              <Select value={m.type} onChange={(e) => setMoment(i, { type: e.target.value })}>
                                {['trade', 'note', 'quote'].map((t) => <option key={t} value={t}>{t}</option>)}
                              </Select>
                            </Field>
                            {m.type === 'trade' ? (
                              <Field label="trade">
                                <Select value={m.tradeIdx} onChange={(e) => setMoment(i, { tradeIdx: e.target.value })}>
                                  <option value="">—</option>
                                  {trades.map((_, ti) => <option key={ti} value={ti}>trade {ti + 1}</option>)}
                                </Select>
                              </Field>
                            ) : (
                              <Field label={m.type === 'quote' ? 'text (the quote)' : 'text'}>
                                <TextInput value={m.text} onChange={(e) => setMoment(i, { text: e.target.value })} placeholder="what you want to say" />
                              </Field>
                            )}
                          </div>
                          {m.type === 'quote' && (
                            <div className="mt-2">
                              <Field label="author"><TextInput value={m.author} onChange={(e) => setMoment(i, { author: e.target.value })} /></Field>
                            </div>
                          )}
                          {m.type === 'trade' ? (
                            <div className="mt-2">
                              <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">charts on this trade</div>
                              {tradeShots.length ? (
                                <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                                  {tradeShots.map((s) => (
                                    <div key={s} className="border border-line bg-bg">
                                      <img src={s} alt="" className="h-14 w-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-faint">no charts on this trade yet — attach them in the trades section</p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2">
                              <ImageDropZone onFiles={(fs) => onMomentImages(i, fs)} label="attach images →" />
                              {m.images.length > 0 && (
                                <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-6">
                                  {m.images.map((s, si) => (
                                    <div key={`${si}:${s}`} className="relative border border-line bg-bg">
                                      <img src={s} alt="" className="h-14 w-full object-cover" />
                                      <button onClick={() => setMoment(i, { images: m.images.filter((_, j) => j !== si) })} className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg px-1 text-[10px] text-down hover:border-down">×</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="primary" onClick={() => publishMoment(i)}>publish →</Button>
                            {m.text.trim() && (
                              <Button size="sm" onClick={() => polishMoment(i)}>AI polish</Button>
                            )}
                            <Button size="sm" variant="danger" onClick={() => { setDraftMoments((ms) => ms.filter((_, j) => j !== i)); markDirty() }}>×</Button>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                  {stream.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-widest text-up">live moments — public after rebuild</div>
                      {stream.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 border border-line bg-bg px-3 py-2">
                          <span className="text-[11px] text-faint">{m.at || '--:--'}</span>
                          <span className="text-[11px] text-dim">{m.type}</span>
                          <span className="flex-1 text-[13px] text-ink">
                            {m.type === 'trade'
                              ? m.tradeIdx !== '' ? `trade ${parseInt(m.tradeIdx, 10) + 1} · ${trades[parseInt(m.tradeIdx, 10)]?.setup ?? ''}` : 'trade'
                              : m.text}
                            {m.author ? ` — ${m.author}` : ''}
                          </span>
                          <Button size="sm" variant="danger" onClick={() => unstreamMoment(i)}>×</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {stream.length === 0 && draftMoments.length === 0 && (
                    <p className="text-[12px] text-faint">nothing on the stream yet — add a draft moment and publish it.</p>
                  )}
                </Card>
              </div>

              {/* ---------- REFLECTION ---------- */}
              <div id="sec-reflection" className="scroll-mt-20">
                <Card
                  title="reflection — draft (private until published)"
                  actions={
                    <div className="flex items-center gap-2">
                      <a href={previewHref} target="_blank" className="flex h-9 items-center border border-line px-2.5 text-[12px] text-dim transition-colors hover:border-accent hover:text-ink">
                        preview day →
                      </a>
                      <Button size="sm" variant="primary" onClick={runDraft} disabled={draftBusy}>
                        {draftBusy ? 'drafting…' : 'AI draft from today'}
                      </Button>
                      <Button size="sm" onClick={publishReflection} disabled={saving || !reflection.trim()}>
                        {content.trim() ? 'republish reflection' : 'publish reflection'}
                      </Button>
                    </div>
                  }
                >
                  {content.trim() && (
                    <div className="mb-3 border border-line bg-bg px-3 py-2 text-[12px] text-up">
                      ● published to /journal{content.trim() === reflection.trim() ? ' — draft matches live' : ' — draft differs, republish to overwrite'}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="title"><TextInput value={title} onChange={(e) => { setTitle(e.target.value); markDirty() }} placeholder="AI suggests" /></Field>
                    <Field label="summary"><TextInput value={summary} onChange={(e) => { setSummary(e.target.value); markDirty() }} placeholder="one line" /></Field>
                    <Field label="tags (comma)"><TextInput value={tags} onChange={(e) => { setTags(e.target.value); markDirty() }} placeholder="discipline, revenge" /></Field>
                  </div>
                  <div className="mt-3">
                    <MarkdownEditor value={reflection} onChange={(md) => { setReflection(md); markDirty() }} label="reflection draft" />
                  </div>
                  {featuredImage && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[11px] uppercase tracking-widest text-dim">featured</span>
                      <img src={featuredImage} alt="" className="h-12 w-20 border border-line object-cover" />
                      <TextInput value={featuredImage} onChange={(e) => { setFeaturedImage(e.target.value); markDirty() }} className="flex-1" />
                    </div>
                  )}
                </Card>
              </div>

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

      <StatusLine
        date={date}
        totalR={totalR}
        tradeCount={tradeCount}
        habitsDone={habitsDone}
        habitsTotal={habitsTotal}
        savedAt={savedAt}
        showPublishHint={showPublishHint}
      />
    </div>
  )
}
