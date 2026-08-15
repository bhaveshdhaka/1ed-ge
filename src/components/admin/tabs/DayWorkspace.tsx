import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, todayStr, fileToDataUrl, uploadDataUrl, notifyChanged, triggerRebuild, bus } from '../api'
import { fmtDay, fmtDayWUpper } from '../../../lib/dates'
import { nowHkt, addDaysIso } from '../../../lib/sessions'
import { hktHHMM } from '../../../lib/clock'
import { Card, Button, TextInput } from '../ui'
import { DayRail } from '../DayRail'
import { TradeList } from '../TradeCard'
import { WriteZone, type ReflectionObligation } from '../WriteZone'
import { NotificationDrawer } from '../NotificationDrawer'
import { HabitRow } from '../HabitRow'
import { IngestSheet } from '../IngestSheet'
import { TradovateSheet, type TradovateLedgerEntry } from '../TradovateSheet'
import { DayPickerSheet } from '../DayPickerSheet'
import { ghostTextOn } from '../useGhostText'
import { toast } from 'sonner'
import { TRADOVATE_EXCURSION_NOTE, tradovateMentalStopSaved } from '../../../lib/copy'

export interface AccRow { id: string; firm: string; sizeLabel: string; pointsValue: number }
export interface HabitDef { slug: string; name: string; emoji?: string; color: string; kind?: string; target?: number }
export interface DayListItem { file: string; date: string; mood: number | null; trades: number; R?: number | null }
interface ExecForm { account: string; size: string }
export interface TradeForm {
  market: string; session: string; direction: 'long' | 'short'; setup: string
  entry: string; stop: string; target: string; exit: string; riskPoints: string; points: string
  confidence: string; note: string; model: string; commentary: string
  models: string[]
  screenshots: string[]; executions: ExecForm[]
}

export interface ThoughtForm {
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
  onDirtyChange,
  onNavigateLibrary,
  onDayStatusChange,
  gotoDay,
  pendingReflections,
  pendingPeriods,
  pendingChanges,
  onRebuild,
  onNavigateToDay,
  onNavigateToReview,
}: {
  onDirtyChange?: (dirty: boolean) => void
  onNavigateLibrary?: () => void
  onDayStatusChange?: (status: 'unsaved' | 'saved' | 'published' | 'none') => void
  gotoDay?: string
  pendingReflections?: { date: string; label: string; overdue: boolean }[]
  pendingPeriods?: { type: string; anchor: string }[]
  pendingChanges?: number
  onRebuild?: () => void
  onNavigateToDay?: (date: string) => void
  onNavigateToReview?: (type: string, anchor: string) => void
}) {
  const [date, setDate] = useState(todayStr())
  const [daysList, setDaysList] = useState<DayListItem[]>([])
  const [journalDates, setJournalDates] = useState<string[]>([])
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
  const [stream, setStream] = useState<ThoughtForm[]>([])

  const [ingestOpen, setIngestOpen] = useState(false)
  const [tradovateOpen, setTradovateOpen] = useState(false)
  const [tvLedger, setTvLedger] = useState<TradovateLedgerEntry[]>([])
  const [slEdits, setSlEdits] = useState<Record<string, string>>({})
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null)
  const [expandAll, setExpandAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  // ghost-text assist — polled so the ⌘K `view → ghost-text` toggle applies live (same-tab
  // localStorage writes don't fire the `storage` event)
  const [ghostOn, setGhostOn] = useState(ghostTextOn)

  // IngestSheet still takes the notify(m, ok) callback shape — route it to sonner.
  const sheetNotify = (m: string, ok?: boolean) => {
    if (ok === false) toast.error(m)
    else toast.success(m)
  }

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
      setExpandedTrade(null)
      setExpandAll(false)
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
        setTvLedger(Array.isArray(day?.draft?.tradovate) ? day.draft.tradovate : [])
        setSlEdits({})
        setStream((day?.stream ?? []).map(toThoughtForm))
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
        toast.error(e instanceof Error ? e.message : 'load failed')
      }
      setLoading(false)
    },
    [],
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
    // journal dates (reflection posts) — powers the pending-obligation set
    api<{ entries: { data: { date?: string } }[] }>('/api/admin/journal')
      .then((r) => setJournalDates((r.entries ?? []).map((e) => String(e.data?.date ?? '')).filter(Boolean)))
      .catch(() => {})
  }, [date, load, loadDays])

  // 1s poll of the ghost-text localStorage flag (setState bails when unchanged)
  useEffect(() => {
    const id = setInterval(() => setGhostOn((v) => (ghostTextOn() === v ? v : ghostTextOn())), 1000)
    return () => clearInterval(id)
  }, [])

  const setTrade = (i: number, patch: Partial<TradeForm>) => {
    setTrades((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
    markDirty()
  }

  const toThoughtForm = (m: any): ThoughtForm => ({
    at: String(m?.at ?? ''),
    type: String(m?.type ?? 'note'),
    text: String(m?.text ?? ''),
    tradeIdx: m?.tradeIdx != null ? String(m.tradeIdx) : '',
    author: String(m?.author ?? ''),
    images: Array.isArray(m?.images) ? m.images.map(String) : [],
  })
  const thoughtPayload = (m: ThoughtForm) => ({
    at: m.at || hktHHMM(new Date()),
    type: m.type,
    ...(m.text.trim() ? { text: m.text.trim() } : {}),
    ...(m.type === 'trade' && m.tradeIdx !== '' ? { tradeIdx: parseInt(m.tradeIdx, 10) } : {}),
    ...(m.author.trim() ? { author: m.author.trim() } : {}),
    ...(m.images.length ? { images: m.images } : {}),
  })
  /** publish a thought/quote from the WriteZone composer. Saves immediately with the new thought included. */
  const publishThought = (type: string, text: string, author?: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const m: ThoughtForm = { at: '', type, text: trimmed, tradeIdx: '', author: author ?? '', images: [] }
    const updatedStream = [...stream, m]
    setStream(updatedStream)
    markDirty()
    // Save with the new thought included — don't rely on stale React state
    api('/api/admin/days', {
      method: 'POST',
      body: { ...dayPayload(), stream: updatedStream.map(thoughtPayload), silent: true },
    }).catch(() => {})
    toast.success('thought published')
  }
  /** publish a trade from the WriteZone composer: add the trade, then stream it. */
  const publishTrade = (trade: Partial<TradeForm>) => {
    const nextTrade: TradeForm = {
      market: trade.market?.trim() || 'MNQ',
      session: trade.session ?? '',
      direction: trade.direction === 'short' ? 'short' : 'long',
      setup: trade.setup ?? '',
      entry: String(trade.entry ?? ''),
      stop: String(trade.stop ?? ''),
      target: String(trade.target ?? ''),
      exit: String(trade.exit ?? ''),
      riskPoints: String(trade.riskPoints ?? ''),
      points: String(trade.points ?? ''),
      confidence: String(trade.confidence ?? ''),
      note: String(trade.note ?? ''),
      model: String(trade.model ?? ''),
      commentary: String(trade.commentary ?? ''),
      models: trade.models?.length ? trade.models.map(String) : trade.model ? [String(trade.model)] : [],
      screenshots: trade.screenshots ?? [],
      executions: (trade.executions ?? []).filter((e) => e.account).map((e) => ({ account: e.account, size: e.size ?? '' })),
    }
    const tradeIndex = trades.length
    const updatedTrades = [...trades, nextTrade]
    const updatedStream = [...stream, { at: '', type: 'trade', text: '', tradeIdx: String(tradeIndex), author: '', images: [] } as ThoughtForm]
    setTrades(updatedTrades)
    setStream(updatedStream)
    markDirty()
    api('/api/admin/days', {
      method: 'POST',
      body: { ...dayPayload(), trades: serializeTrades(updatedTrades), stream: updatedStream.map(thoughtPayload), silent: true },
    }).catch(() => {})
    toast.success('trade added — queued for rebuild')
  }
  /** publish a trade card straight to the stream as a trade thought (same pattern as publishThought). */
  const publishTradeThought = (ti: number) => {
    const m: ThoughtForm = { at: '', type: 'trade', text: '', tradeIdx: String(ti), author: '', images: [] }
    setStream((s) => [...s, m])
    markDirty()
    saveSilent() // immediate — don't wait for the 2s debounce on explicit publish
    toast.success('trade added to the stream — queued for rebuild')
  }
  const unstreamThought = (i: number) => {
    setStream((s) => s.filter((_, j) => j !== i))
    markDirty()
  }

  const selectDate = (d: string) => {
    if (!d || d === date) return
    if (dirty && !confirm(`unsaved changes on ${date} — discard and open ${d}?`)) return
    setDate(d)
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
      toast.success('draft written — edit it, then save')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ai failed')
    }
    setDraftBusy(false)
  }

  // ---------- save ----------
  const dayPayload = () => ({
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
    stream: stream.map(thoughtPayload),
    ...(reflection.trim()
      ? {
          draft: {
            ...(reflection.trim() ? { reflection: reflection.trim() } : {}),
          },
        }
      : {}),
  })

  const serializeTrades = (ts: TradeForm[]) =>
    ts.map((t) => ({
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
    }))

  const save = async (rebuild = false) => {
    setSaving(true)
    try {
      await api('/api/admin/days', {
        method: 'POST',
        body: dayPayload(),
      })

      clearDirty()
      notifyChanged()
      if (rebuild) {
        try {
          await triggerRebuild()
        } catch {
          toast.error('saved, but the rebuild failed to start')
        }
      }
      await load(date)
      await loadDays()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'save failed')
    }
    setSaving(false)
  }

  /** Silent autosave — writes the file, skips the pending-change queue, no toast. */
  const saveSilent = async () => {
    try {
      await api('/api/admin/days', {
        method: 'POST',
        body: { ...dayPayload(), silent: true },
      })
      clearDirty()
    } catch {
      // autosave is best-effort; the debounce will retry on the next change
    }
  }

  // debounced autosave: 2s after the last change, flush a silent save
  useEffect(() => {
    if (!dirty) return
    const id = setTimeout(() => saveSilent(), 2000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, date, mood, sleepHours, sleepQuality, habits, reflection, trades, stream])

  // flush on window blur too (walking away from the admin saves what's typed)
  useEffect(() => {
    const onWinBlur = () => {
      if (dirty) saveSilent()
    }
    window.addEventListener('blur', onWinBlur)
    return () => window.removeEventListener('blur', onWinBlur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty])

  const publishReflection = async () => {
    if (!reflection.trim()) return toast.error('write a reflection draft first')
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
      toast.success('reflection published — queued for rebuild')
      notifyChanged()
      // keep the day record (draft.reflection) in sync + flush the debounce
      markDirty()
      saveSilent() // immediate — don't wait for the 2s debounce on explicit publish
    } catch {
      toast.error('publish failed — the draft is safe, retry')
    }
    setSaving(false)
  }

  const saveMentalStop = async (key: string) => {
    const raw = slEdits[key]
    const mentalStop = raw !== '' && raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null
    if (mentalStop == null) return toast.error('enter a mental SL price first')
    try {
      await api('/api/admin/tradovate/mental-stop', {
        method: 'POST',
        body: { date, key, mentalStop },
      })
      toast.success(tradovateMentalStopSaved(tvLedger.filter((t) => t.needsStop && t.key !== key).length))
      notifyChanged()
      await load(date)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'save failed')
    }
  }

  const removeDay = async () => {
    if (!confirm(`hard-delete day ${date}? the day record and its journal are removed permanently.`)) return
    try {
      await api('/api/admin/days', { method: 'DELETE', body: { date } })
      try {
        await api('/api/admin/journal', { method: 'DELETE', body: { file: `${date}.mdx` } })
      } catch {}
      toast('day deleted')
      notifyChanged()
      // Load today's data immediately so the form reflects today, not the deleted day
      const t = todayStr()
      await load(t)
      setDate(t)
      await loadDays()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'delete failed')
    }
  }

  // ---------- helpers ----------
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
        toast.error(e instanceof Error ? e.message : 'upload failed')
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


  // ---------- reflection obligation (Z5) ----------
  // Adapted to the real `accountabilityStatus()` API: it returns only counts
  // ({ pendingDays, pendingPeriods }), not per-date data, and DayWorkspace does
  // not hold DayData[]/reviews. The same rules are applied here per-date:
  // Mon–Fri, no journal post, past the 03:00-HKT-next-day grace.
  const weekday = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`).getUTCDay()
    return d >= 1 && d <= 5
  }
  const pendingObligationDates = useMemo(() => {
    const out = new Set<string>()
    const journal = new Set(journalDates)
    const now = nowHkt()
    const today = now.slice(0, 10)
    for (const d of daysList) {
      if (d.date > today) continue
      if (!weekday(d.date)) continue
      if (journal.has(d.date)) continue
      const due = `${addDaysIso(d.date, 1)}T03:00`
      if (now.slice(0, 16) >= due) out.add(d.date)
    }
    return out
  }, [daysList, journalDates])
  const obligation = useMemo(() => {
    const posted = content.trim().length > 0
    if (!weekday(date) || posted) return { type: 'daily', status: 'done' as const }
    const dueIso = `${addDaysIso(date, 1)}T03:00`
    const now = nowHkt()
    // Day reflection: "due tonight" until 03:00 next day, then "overdue".
    if (now.slice(0, 16) >= dueIso) return { type: 'daily', status: 'overdue' as const }
    return { type: 'daily', status: 'grace' as const }
  }, [date, content])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hasDayRecord = daysList.some((d) => d.date === date)

  const dayStatus: 'unsaved' | 'saved' | 'published' | 'none' = dirty
    ? 'unsaved'
    : content.trim()
      ? 'published'
      : hasDayRecord
        ? 'saved'
        : 'none'

  useEffect(() => {
    onDayStatusChange?.(dayStatus)
  }, [dayStatus, onDayStatusChange])

  useEffect(() => {
    if (gotoDay && gotoDay !== date) selectDate(gotoDay)
  }, [gotoDay, date])

  // day-level keyboard shortcuts (global save handled in AdminApp)
  useEffect(() => {
    const offSave = bus.on('save', () => save(false))
    const offRebuild = bus.on('save-rebuild', () => save(true))
    // ⌘S flush — force an immediate silent save (skips the 2s debounce)
    const offFlushSave = bus.on('flush-save', () => saveSilent())
    const offPrev = bus.on('prev-day', () => prevDay && selectDate(prevDay.date))
    const offNext = bus.on('next-day', () => nextDay && selectDate(nextDay.date))
    const offToday = bus.on('today', () => selectDate(todayStr()))
    // ⌘K palette commands open the sheets (DayWorkspace mounts after go('day'))
    const offOpenIngest = bus.on('open-ingest', () => setIngestOpen(true))
    const offOpenDayPicker = bus.on('open-day-picker', () => setDayPickerOpen(true))
    return () => {
      offSave()
      offRebuild()
      offFlushSave()
      offPrev()
      offNext()
      offToday()
      offOpenIngest()
      offOpenDayPicker()
    }
  })

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl">/ day</h1>
          <span className="text-xs text-faint">{fmtDayWUpper(date)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasDayRecord && (
            <a href={`/day/${fmtDay(date)}`} target="_blank" className="flex h-9 items-center border border-line px-2.5 text-xs text-accent transition-colors hover:border-accent">
              view live →
            </a>
          )}
          <TextInput type="date" aria-label="day date" value={date} onChange={(e) => selectDate(e.target.value)} className="h-9 w-40" />
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-[44px_1fr]">
        <DayRail
          days={daysList}
          selectedDate={date}
          onSelectDate={selectDate}
          allDatesIso={daysList.map((d) => d.date)}
          pendingObligationDates={pendingObligationDates}
        />

        <div className="space-y-3 md:space-y-4">
          {loading ? (
            <Card title="loading"><p className="text-sm text-faint">loading…</p></Card>
          ) : (
            <>
              {/* ---------- Z1 WRITE ZONE ---------- */}
              <WriteZone
                date={date}
                stream={stream}
                trades={trades}
                models={models.map(({ slug, name }) => ({ slug, name }))}
                accounts={accounts}
                reflection={reflection}
                content={content}
                previewHref={`/day/${fmtDay(date)}`}
                onPublishThought={publishThought}
                onPublishTrade={publishTrade}
                onPublishReflection={publishReflection}
                onReflectionChange={(v) => { setReflection(v); markDirty() }}
                onAIDraft={runDraft}
                draftBusy={draftBusy}
                saving={saving}
                obligation={obligation}
                ghostTextEnabled={ghostOn}
                onUnstream={unstreamThought}
              />

              {/* ---------- Z2 HABITS ---------- */}
              <HabitRow
                  habitDefs={habitDefs}
                  habits={habits}
                  onToggle={(slug) => { setHabits((x) => ({ ...x, [slug]: !(x[slug] === true) })); markDirty() }}
                  onAdjust={(slug, delta) => { setHabits((x) => { const cur = typeof x[slug] === 'number' ? (x[slug] as number) : 0; return { ...x, [slug]: Math.max(0, cur + delta) } as Record<string, boolean> }); markDirty() }}
                  onNavigateLibrary={onNavigateLibrary ?? (() => {})}
                />

                {/* ---------- Z3 TRADES ---------- */}
                <div id="sec-trades" className="mt-3 md:mt-5 scroll-mt-20">
                  <div className="panel">
                    <div className="card-hd">
                      <span className="card-ico">📈</span>
                      <span className="card-lbl">trades</span>
                      <span className="card-sub">{trades.length}</span>
                      <div className="ml-auto flex items-center gap-2">
                      {trades.length > 0 && (
                        <Button size="sm" onClick={() => { setExpandAll((e) => !e); setExpandedTrade(null) }}>
                          {expandAll ? 'collapse all' : 'expand all'}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => { setTrades((ts) => [...ts, emptyTrade()]); setExpandAll(false); setExpandedTrade(trades.length); markDirty() }}>+ add trade</Button>
                      <button
                        type="button"
                        onClick={() => setIngestOpen(true)}
                        className="flex h-8 items-center border border-line2 px-2.5 text-xs text-dim transition-colors hover:border-accent hover:text-ink"
                      >
                        ⤓ import trades ▸
                      </button>
                      <button
                        type="button"
                        onClick={() => setTradovateOpen(true)}
                        className="flex h-8 items-center border border-line2 px-2.5 text-xs text-dim transition-colors hover:border-accent hover:text-ink"
                      >
                        ⤓ tradovate csv ▸
                      </button>
                    </div>
                  </div>
                  <div className="p-3 md:p-4">
                    <TradeList
                    trades={trades}
                    allModels={models}
                    accountLabel={accountLabel}
                    accounts={accounts}
                    onChange={setTrade}
                    expandedIndex={expandedTrade}
                    expandAll={expandAll}
                    onToggle={(ti) => {
                      if (expandAll) { setExpandAll(false); setExpandedTrade(ti) }
                      else setExpandedTrade(expandedTrade === ti ? null : ti)
                    }}
                    onRemove={(ti) => setTrades((ts) => ts.filter((_, j) => j !== ti))}
                    onTradeScreens={onTradeScreens}
                    onPublish={publishTradeThought}
                    onReorder={(from, to) => {
                      setTrades((ts) => {
                        const next = [...ts]
                        const [moved] = next.splice(from, 1)
                        next.splice(to, 0, moved)
                        return next
                      })
                      markDirty()
                    }}
                  />
                  </div>
                </div>
              </div>

              {/* ---------- Z3b TRADOVATE LEDGER (private) ---------- */}
              {tvLedger.length > 0 && (
                <div className="panel mt-3 md:mt-5">
                  <div className="card-hd">
                    <span className="card-ico">🗂</span>
                    <span className="card-lbl">tradovate ledger</span>
                    <span className="card-sub">{tvLedger.length}</span>
                    <span className="ml-2 border border-line px-1.5 py-0.5 text-3xs uppercase tracking-wide text-faint">private</span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button size="sm" onClick={() => setTradovateOpen(true)}>re-import ▸</Button>
                    </div>
                  </div>
                  <div className="p-3 md:p-4">
                    {tvLedger.filter((t) => t.needsStop).length > 0 && (
                      <div className="mb-3 border border-warn/50 bg-bg p-2 text-xs text-warn">
                        {tvLedger.filter((t) => t.needsStop).length} position{tvLedger.filter((t) => t.needsStop).length === 1 ? '' : 's'} have no recorded stop — add the mental SL below.
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-2xs">
                        <thead>
                          <tr className="border-b border-line">
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">market</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">entry→exit</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">pts</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">accounts</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">SL</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">R</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">mae</th>
                            <th className="whitespace-nowrap px-2 py-1.5 font-normal uppercase tracking-wide text-faint">mfe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tvLedger.map((t) => {
                            const risk = t.stop != null ? Math.abs(t.entry - t.stop) : null
                            const r = risk != null && risk > 0 ? t.points / risk : null
                            const exactMae = t.exitType === 'stop'
                            return (
                              <tr key={t.key} className="border-b border-line/60">
                                <td className="whitespace-nowrap px-2 py-1.5">
                                  <span className="text-ink">{t.direction === 'long' ? '▲' : '▼'} {t.market}</span>
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{t.entry}→{t.exit}</td>
                                <td className={`whitespace-nowrap px-2 py-1.5 tabular-nums ${t.points >= 0 ? 'text-up' : 'text-down'}`}>{t.points >= 0 ? '+' : ''}{t.points}</td>
                                <td className="whitespace-nowrap px-2 py-1.5">
                                  <span className="flex flex-wrap gap-1">
                                    {t.accounts.map((a, i) => (
                                      <span key={i} className={`border px-1 py-0.5 font-mono text-3xs ${a.internalId ? 'border-line text-dim' : 'border-warn/50 text-warn'}`}>
                                        {a.internalId ?? a.platformId ?? '—'}
                                        {a.platformId && !a.internalId ? ' ?' : ''}
                                      </span>
                                    ))}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5">
                                  {t.needsStop ? (
                                    <div className="flex items-center gap-1">
                                      <TextInput
                                        type="number"
                                        step="0.25"
                                        value={slEdits[t.key] ?? ''}
                                        onChange={(e) => setSlEdits((m) => ({ ...m, [t.key]: e.target.value }))}
                                        placeholder="mental SL"
                                        aria-label={`mental stop for ${t.key}`}
                                        className="w-20 px-1.5 py-1 text-2xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => saveMentalStop(t.key)}
                                        className="border border-accent/50 px-1.5 py-1 text-3xs uppercase tracking-wide text-accent hover:border-accent"
                                      >
                                        set
                                      </button>
                                    </div>
                                  ) : (
                                    <span className={`tabular-nums text-dim ${t.stopSource === 'mental' ? 'italic' : ''}`}>
                                      {t.stop}
                                      {t.stopSource === 'recorded' ? ' ↯' : t.stopSource === 'mental' ? ' ✎' : ''}
                                    </span>
                                  )}
                                </td>
                                <td className={`whitespace-nowrap px-2 py-1.5 tabular-nums ${r == null ? 'text-faint' : t.points > 0 ? 'text-up' : t.points < 0 ? 'text-down' : 'text-dim'}`}>
                                  {r == null ? '—' : r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0')}
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                                  {t.mae == null ? <span className="text-faint">—</span> : <span className={exactMae ? 'text-ink' : 'text-dim'}>{exactMae ? '' : '≥'}{t.mae}</span>}
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                                  {t.mfe == null ? <span className="text-faint">—</span> : <span className="text-dim">≥{t.mfe}</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-2xs text-faint">imported from tradovate CSVs · private to the admin · {TRADOVATE_EXCURSION_NOTE}</p>
                  </div>
                </div>
              )}

              {/* ---------- FOOTER ---------- */}
              <div className="panel">
                <div className="card-hd">
                  <span className="card-ico">📊</span>
                  <span className="card-lbl">day totals</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:gap-6 p-3 md:p-4 text-sm">
                  <span className="text-dim">day</span>
                  <span className={dayTotals.R > 0 ? 'text-up' : dayTotals.R < 0 ? 'text-down' : 'text-soft'}>{dayTotals.R > 0 ? '+' : ''}{dayTotals.R.toFixed(2)}R</span>
                  <span className="text-dim">·</span>
                  <span className={dayTotals.pts > 0 ? 'text-up' : dayTotals.pts < 0 ? 'text-down' : 'text-soft'}>{dayTotals.pts > 0 ? '+' : ''}{dayTotals.pts.toFixed(1)}pts</span>
                  <span className="text-dim">·</span>
                  <span className={dayTotals.pnl > 0 ? 'text-up' : dayTotals.pnl < 0 ? 'text-down' : 'text-soft'}>{dayTotals.pnl > 0 ? '+' : ''}${Math.round(dayTotals.pnl).toLocaleString()}</span>
                  <span className="ml-auto text-2xs text-faint">autosaves on idle · ⌘S flushes</span>
                  {daysList.some((d) => d.date === date) && (
                    <Button size="sm" variant="danger" onClick={removeDay}>delete day</Button>
                  )}
                </div>
              </div>

              {/* ---------- NOTIFICATIONS (bottom) ---------- */}
              {pendingReflections && pendingPeriods && (
                <div className="flex justify-end">
                  <NotificationDrawer
                    pendingReflections={pendingReflections}
                    pendingPeriods={pendingPeriods}
                    pendingChanges={pendingChanges ?? 0}
                    dayStatus={dayStatus}
                    onRebuild={onRebuild ?? (() => {})}
                    onNavigateToDay={onNavigateToDay ?? (() => {})}
                    onNavigateToReview={onNavigateToReview ?? (() => {})}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <IngestSheet
        open={ingestOpen}
        onOpenChange={setIngestOpen}
        notify={sheetNotify}
        markDirty={markDirty}
        date={date}
        onImported={load}
      />
      <TradovateSheet
        open={tradovateOpen}
        onOpenChange={setTradovateOpen}
        notify={sheetNotify}
        markDirty={markDirty}
        date={date}
        onImported={load}
      />
      <DayPickerSheet
        open={dayPickerOpen}
        onOpenChange={setDayPickerOpen}
        days={daysList}
        selectedDate={date}
        onSelectDate={selectDate}
      />
    </div>
  )
}
