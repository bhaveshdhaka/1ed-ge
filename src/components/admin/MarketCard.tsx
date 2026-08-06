import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { Card, Button } from './ui'

interface NewsItem {
  time: string
  title: string
}
interface NewsDay {
  date: string
  verified: boolean
  cachedAt?: string
  red: NewsItem[]
  orange: NewsItem[]
}
interface Refresh {
  running: boolean
  ok: boolean | null
  finishedAt: number | null
  error?: string | null
}

export function MarketCard() {
  const [today, setToday] = useState('')
  const [news, setNews] = useState<NewsDay | null>(null)
  const [refresh, setRefresh] = useState<Refresh | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ today: string; news: NewsDay | null; refresh: Refresh | null }>('/api/admin/market')
      setToday(res.today)
      setNews(res.news)
      setRefresh(res.refresh)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const refreshNow = async () => {
    setBusy(true)
    try {
      await api('/api/admin/market', { method: 'POST' })
      const deadline = Date.now() + 180000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await api<{ refresh: Refresh | null }>('/api/admin/market')
        if (!st.refresh?.running) break
      }
    } catch {}
    setBusy(false)
    load()
  }

  const red = news?.red ?? []
  const orange = news?.orange ?? []

  return (
    <Card
      title={`market · ${today || '—'}`}
      actions={<span data-mkt-live className="text-[12px] text-dim">—</span>}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {red.map((n) => (
          <span key={'r' + n.time + n.title} className="text-[13px] text-down">
            red {n.time} hkt — {n.title}
          </span>
        ))}
        {orange.map((n) => (
          <span key={'o' + n.time + n.title} className="text-[13px] opacity-70 text-warn">
            orange {n.time} hkt — {n.title}
          </span>
        ))}
        {red.length === 0 && orange.length === 0 && (
          <span className="text-[12px] text-faint">no major USD news for today.</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
        <span>cached {news?.cachedAt ? new Date(news.cachedAt).toLocaleString() : '—'}</span>
        {(refresh?.running || busy) && <span className="text-warn">refreshing… (fetch + rebuild ~30s)</span>}
        {!refresh?.running && refresh?.error && <span className="text-down">last refresh failed — {refresh.error}</span>}
        <span className="ml-auto">
          <Button size="sm" onClick={refreshNow} disabled={busy || refresh?.running}>
            ↻ refresh news
          </Button>
        </span>
      </div>
    </Card>
  )
}
