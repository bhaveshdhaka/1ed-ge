import { useCallback, useEffect, useRef, useState } from 'react'
import { api, notifyChanged } from '../api'
import { Card, Button, Field, Select, TextInput } from '../ui'
import { MarkdownEditor } from '../MarkdownEditor'
import { type PeriodType, PERIOD_TYPES } from '../../../lib/periods'

interface PeriodOpt {
  anchor: string
  label: string
}
interface ReviewBody {
  file: string
  data: { title?: string }
  body: string
}

export function ReviewTab({ notify, gotoReview }: { notify: (m: string, ok?: boolean) => void; gotoReview?: { type: string; anchor: string } | null }) {
  const [periods, setPeriods] = useState<Record<PeriodType, PeriodOpt[]>>({
    week: [],
    month: [],
    quarter: [],
    half: [],
    year: [],
  })
  const [sel, setSel] = useState<{ type: PeriodType; anchor: string } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [comparison, setComparison] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState<{ key: string; title: string; body: string; comparison: string } | null>(null)
  const loadSeq = useRef(0)

  const loadPeriods = useCallback(async () => {
    try {
      const res = await api<{ ok: boolean; periods: Record<PeriodType, PeriodOpt[]> }>('/api/admin/reviews')
      setPeriods(res.periods)
      setSel((prev) => {
        const t: PeriodType = prev?.type ?? 'week'
        const list = res.periods[t] ?? []
        const a = prev && list.some((p) => p.anchor === prev.anchor) ? prev.anchor : (list[0]?.anchor ?? '')
        return a ? { type: t, anchor: a } : null
      })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'reviews load failed', false)
    }
  }, [notify])

  useEffect(() => {
    loadPeriods()
  }, [loadPeriods])

  const loadReview = useCallback(
    async (type: PeriodType, anchor: string) => {
      const id = ++loadSeq.current
      try {
        const res = await api<{ ok: boolean; review: ReviewBody | null; comparison: string | null }>(
          `/api/admin/reviews?type=${type}&anchor=${encodeURIComponent(anchor)}`,
        )
        if (loadSeq.current !== id) return
        const title = res.review?.data?.title ?? ''
        const body = res.review?.body ?? ''
        const comparison = res.comparison ?? ''
        setTitle(title)
        setBody(body)
        setComparison(comparison)
        setLoaded(true)
        setSaved({ key: `${type}-${anchor}`, title, body, comparison })
      } catch (e) {
        if (loadSeq.current !== id) return
        notify(e instanceof Error ? e.message : 'review load failed', false)
      }
    },
    [notify],
  )

  useEffect(() => {
    setLoaded(false)
    if (sel && sel.anchor) loadReview(sel.type, sel.anchor)
  }, [sel, loadReview])

  useEffect(() => {
    if (!gotoReview) return
    const t = gotoReview.type as PeriodType
    if (PERIOD_TYPES.includes(t)) {
      if (dirty && !confirm('unsaved review changes — discard and open the requested review?')) return
      setSel({ type: t, anchor: gotoReview.anchor })
    }
  }, [gotoReview])

  const pickType = (t: PeriodType) => {
    if (dirty && !confirm('unsaved review changes — discard and switch period?')) return
    const list = periods[t] ?? []
    setSel(list[0] ? { type: t, anchor: list[0].anchor } : null)
  }

  const generate = async () => {
    if (!sel) return
    setGenerating(true)
    try {
      const res = await api<{ ok: boolean; comparison: string }>('/api/admin/reviews', {
        method: 'POST',
        body: { action: 'compare', type: sel.type, anchor: sel.anchor },
      })
      setComparison(res.comparison)
      setSaved((prev) => (prev ? { ...prev, comparison: res.comparison } : prev))
      notify(`comparison generated — queued for rebuild`)
      notifyChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'compare failed', false)
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!sel) return
    try {
      await api('/api/admin/reviews', {
        method: 'POST',
        body: { type: sel.type, anchor: sel.anchor, title, body },
      })
      // Persist the (possibly edited) comparison too — direct save, no regeneration.
      if (comparison.trim()) {
        await api('/api/admin/reviews', {
          method: 'POST',
          body: { action: 'compare-save', type: sel.type, anchor: sel.anchor, comparison },
        })
      }
      notify(`review ${sel.type}-${sel.anchor} saved — queued for rebuild`)
      notifyChanged()
      setSaved({ key: `${sel.type}-${sel.anchor}`, title, body, comparison })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  const list = sel ? (periods[sel.type] ?? []) : []
  const key = sel ? `${sel.type}-${sel.anchor}` : ''
  const dirty =
    loaded &&
    (!saved ||
      saved.key !== key ||
      saved.title !== title ||
      saved.body !== body ||
      saved.comparison !== comparison)

  return (
    <div className="space-y-6">
      <h1 className="text-xl">/ reviews</h1>

      <Card title="period" actions={<span className="text-[11px] text-faint">derived from logged days</span>}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="type">
            <Select value={sel?.type ?? 'week'} onChange={(e) => pickType(e.target.value as PeriodType)}>
              {PERIOD_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="anchor">
            <Select
              value={sel?.anchor ?? ''}
              onChange={(e) => {
                if (dirty && !confirm('unsaved review changes — discard and switch period?')) return
                setSel({ type: sel?.type ?? 'week', anchor: e.target.value })
              }}
              disabled={!list.length}
            >
              {list.map((p) => (
                <option key={p.anchor} value={p.anchor}>{p.label} — {p.anchor}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {sel ? (
        <Card
          title={`${sel.type} ${sel.anchor} — review`}
          actions={
            <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
              save
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label="title">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="week 32 — review" />
            </Field>
            <MarkdownEditor label="review markdown" rows={18} value={body} onChange={setBody} />
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-[11px] text-faint">
                comparison — AI facts, you write the reflection
              </span>
              <Button size="sm" onClick={generate} disabled={generating}>
                {generating ? 'generating…' : 'generate comparison'}
              </Button>
            </div>
            <MarkdownEditor label="comparison markdown" rows={10} value={comparison} onChange={setComparison} />
            {loaded && !dirty && <p className="mt-3 text-[11px] text-faint">saved — queued for rebuild</p>}
          </div>
        </Card>
      ) : (
        <Card title="no periods yet">
          <p className="text-[12px] text-faint">no logged days yet — reviews appear once there is day data.</p>
        </Card>
      )}
    </div>
  )
}
