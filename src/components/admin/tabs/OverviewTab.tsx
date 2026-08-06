import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Card, Button, Stat, inputCls } from '../ui'
import type { Tab } from '../AdminApp'

interface Status {
  env: { adminSecretSet: boolean; openrouterKeySet: boolean; modelStructure: string; modelVision: string }
  today: string
  counts: { days: number; todayTrades: number; journal: number; habits: number; accounts: number; payouts: number; coach: number; media: number }
  habitsDoneToday: number
  journalToday: boolean
  todayDay: { trades?: unknown[]; device?: { screenshots?: string[] } } | null
  build: { running?: boolean; ok?: boolean | null; finishedAt?: number } | null
}

export function OverviewTab({
  notify,
  go,
}: {
  notify: (m: string, ok?: boolean) => void
  go: (t: Tab) => void
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [briefDraft, setBriefDraft] = useState('')
  const [briefBusy, setBriefBusy] = useState(false)

  const loadBrief = useCallback(async () => {
    try {
      const res = await api<{ brief: { date: string; body: string } | null }>('/api/admin/brief')
      setBriefDraft(res.brief?.body ?? '')
    } catch {}
  }, [])

  useEffect(() => {
    loadBrief()
  }, [loadBrief])

  const load = useCallback(async () => {
    try {
      setStatus(await api<Status>('/api/admin/status'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load')
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const doRebuild = useCallback(async () => {
    setRebuilding(true)
    try {
      await api('/api/admin/rebuild', { method: 'POST' })
      notify('rebuild started')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'rebuild failed', false)
    }
    setRebuilding(false)
    setTimeout(load, 500)
  }, [load, notify])

  const genBrief = async () => {
    setBriefBusy(true)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'brief', date: status?.today },
      })
      setBriefDraft(res.result)
      notify('brief drafted — review and save')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'brief failed', false)
    }
    setBriefBusy(false)
  }

  const saveBrief = async () => {
    if (!status || !briefDraft.trim()) return
    try {
      await api('/api/admin/brief', { method: 'POST', body: { date: status.today, text: briefDraft } })
      notify('brief saved — queued for rebuild')
      loadBrief()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  if (error) {
    return (
      <Card title="connection">
        <p className="text-[13px] text-down">{error}</p>
      </Card>
    )
  }
  if (!status) return <Card title="loading"><p className="text-[13px] text-faint">loading…</p></Card>

  const habitCount = status.counts.habits
  const screenLogged = !!status.todayDay?.device?.screenshots?.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ overview</h1>
        <div className="flex items-center gap-3 text-[12px] text-dim">
          <span>today: {status.today}</span>
          <a href="/" target="_blank" className="text-accent hover:text-ink">view site →</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
        <Stat label="days logged" value={status.counts.days} />
        <Stat label="journal entries" value={status.counts.journal} />
        <Stat label="accounts" value={status.counts.accounts} />
        <Stat label="payouts" value={status.counts.payouts} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="today">
          <div className="space-y-3 text-[13px] text-soft">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span>trades taken</span>
              <span className={status.counts.todayTrades > 0 ? 'text-up' : 'text-dim'}>
                {status.counts.todayTrades}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span>habits done</span>
              <span className={status.habitsDoneToday === habitCount && habitCount ? 'text-up' : 'text-ink'}>
                {status.habitsDoneToday}/{habitCount}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span>screen time logged</span>
              <span className={screenLogged ? 'text-up' : 'text-dim'}>{screenLogged ? 'yes' : 'no'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span>journal written</span>
              <span className={status.journalToday ? 'text-up' : 'text-dim'}>
                {status.journalToday ? 'yes' : 'no'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="primary" onClick={() => go('day')}>open today's workspace →</Button>
              <Button size="sm" onClick={() => go('accounts')}>manage accounts →</Button>
              <Button size="sm" onClick={() => go('coach')}>talk to coach →</Button>
            </div>
          </div>
        </Card>

        <Card
          title="build"
          actions={
            <Button size="sm" onClick={doRebuild} disabled={rebuilding || status.build?.running}>
              {status.build?.running ? 'building…' : 'rebuild now'}
            </Button>
          }
        >
          <div className="space-y-2 text-[13px] text-soft">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span>status</span>
              <span className={status.build?.running ? 'text-warn' : status.build?.ok === false ? 'text-down' : 'text-up'}>
                {status.build?.running ? 'running' : status.build ? 'idle' : 'never run'}
              </span>
            </div>
            {status.build?.finishedAt && (
              <div className="flex items-center justify-between border-b border-line/60 pb-2">
                <span>last build</span>
                <span className="text-dim">
                  {status.build.ok === false ? 'failed · ' : ''}
                  {new Date(status.build.finishedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
            <p className="pt-1 text-[12px] leading-relaxed text-dim">
              public pages are static — after you save a day, journal, account or payout, the site
              rebuilds (~8s) so the public numbers update.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="daily brief"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={genBrief} disabled={briefBusy}>
              {briefBusy ? 'writing…' : 'AI draft'}
            </Button>
            <Button size="sm" variant="primary" onClick={saveBrief} disabled={!briefDraft.trim()}>
              save
            </Button>
          </div>
        }
      >
        {briefDraft.trim() ? (
          <textarea
            value={briefDraft}
            onChange={(e) => setBriefDraft(e.target.value)}
            rows={7}
            className={`${inputCls} w-full resize-y`}
            aria-label="daily brief"
          />
        ) : (
          <p className="text-[13px] text-faint">
            no brief for today yet — “AI draft” writes a short pre-market brief from today’s sessions, the
            red/orange events, and your most recent day. the numbers come from verified data; the AI only
            writes the prose.
          </p>
        )}
        <p className="mt-2 text-[11px] text-faint">public on the homepage + day page once rebuilt</p>
      </Card>

      <Card title="system">
        <div className="grid gap-2 text-[13px] md:grid-cols-3">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <span className="text-dim">admin secret</span>
            <span className={status.env.adminSecretSet ? 'text-up' : 'text-down'}>
              {status.env.adminSecretSet ? 'set' : 'MISSING'}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <span className="text-dim">openrouter key</span>
            <span className={status.env.openrouterKeySet ? 'text-up' : 'text-down'}>
              {status.env.openrouterKeySet ? 'set' : 'MISSING'}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <span className="text-dim">models</span>
            <span className="text-faint">{status.env.modelStructure} · {status.env.modelVision}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
