import { useCallback, useEffect, useState } from 'react'
import { api, notifyChanged } from '../api'
import { Card, Button, Field, Select, TextInput } from '../ui'
import { MarkdownEditor } from '../MarkdownEditor'

type PeriodType = 'week' | 'month' | 'quarter' | 'half' | 'year'
const TYPES: PeriodType[] = ['week', 'month', 'quarter', 'half', 'year']

interface PeriodOpt {
  anchor: string
  label: string
}
interface ReviewBody {
  file: string
  data: { title?: string }
  body: string
}

export function ReviewTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
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
  const [loadedKey, setLoadedKey] = useState('')

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
      try {
        const res = await api<{ ok: boolean; review: ReviewBody | null }>(
          `/api/admin/reviews?type=${type}&anchor=${encodeURIComponent(anchor)}`,
        )
        setTitle(res.review?.data?.title ?? '')
        setBody(res.review?.body ?? '')
        setLoadedKey(`${type}-${anchor}`)
      } catch (e) {
        notify(e instanceof Error ? e.message : 'review load failed', false)
      }
    },
    [notify],
  )

  useEffect(() => {
    if (sel && sel.anchor) loadReview(sel.type, sel.anchor)
  }, [sel, loadReview])

  const pickType = (t: PeriodType) => {
    const list = periods[t] ?? []
    setSel(list[0] ? { type: t, anchor: list[0].anchor } : null)
  }

  const save = async () => {
    if (!sel) return
    try {
      await api('/api/admin/reviews', {
        method: 'POST',
        body: { type: sel.type, anchor: sel.anchor, title, body },
      })
      notify(`review ${sel.type}-${sel.anchor} saved — queued for rebuild`)
      notifyChanged()
      setLoadedKey(`${sel.type}-${sel.anchor}`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  const list = sel ? (periods[sel.type] ?? []) : []
  const key = sel ? `${sel.type}-${sel.anchor}` : ''
  const dirty = !loadedKey || loadedKey !== key

  return (
    <div className="space-y-6">
      <h1 className="text-xl">/ reviews</h1>

      <Card title="period" actions={<span className="text-[11px] text-faint">derived from logged days</span>}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="type">
            <Select value={sel?.type ?? 'week'} onChange={(e) => pickType(e.target.value as PeriodType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="anchor">
            <Select
              value={sel?.anchor ?? ''}
              onChange={(e) => setSel({ type: sel?.type ?? 'week', anchor: e.target.value })}
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
          </div>
          {!dirty && <p className="mt-3 text-[11px] text-faint">saved — queued for rebuild</p>}
        </Card>
      ) : (
        <Card title="no periods yet">
          <p className="text-[12px] text-faint">no logged days yet — reviews appear once there is day data.</p>
        </Card>
      )}
    </div>
  )
}
