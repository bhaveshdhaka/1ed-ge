import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Card, Button, Stat, inputCls } from '../ui'
import type { Tab } from '../AdminApp'
import type { AccountRuleStatus } from '../../../lib/account-rules'
import { nextModifiedHoursDay, cmeModifiedCt, ctToHktHhmm, type ModifiedHoursDay } from '../../../lib/market'
import { fmtDayW } from '../../../lib/dates'

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
  const [accLive, setAccLive] = useState<{ id: string; stage: string; status: AccountRuleStatus }[] | null>(null)

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
    // Live per-account rule status (net/dd · today/day · breach · consistency).
    try {
      const res = await api<{ accounts: { id: string; stage?: unknown; status?: AccountRuleStatus }[] }>(
        '/api/admin/accounts',
      )
      setAccLive(
        res.accounts
          .filter((a) => a.status)
          .map((a) => ({ id: a.id, stage: String(a.stage ?? ''), status: a.status! })),
      )
    } catch {}
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

  // The owner only looks at zen — surface the next modified-hours CME day
  // here so they don't get caught in thin-volume Asia-hours mess.
  const modifiedHours = nextModifiedHoursDay(status.today, 180)
  const modifiedHoursLine = (m: ModifiedHoursDay): string => {
    const away =
      m.daysAway === 0 ? 'today' :
      m.daysAway === 1 ? 'tomorrow' :
      m.daysAway < 14  ? `in ${m.daysAway} days` :
      m.daysAway < 60  ? `in ${Math.round(m.daysAway / 7)} weeks` :
                          `in ${Math.round(m.daysAway / 30)} months`
    const mt = cmeModifiedCt(m.iso)
    const hkt = mt ? ctToHktHhmm(m.iso, mt.hh, mt.mm) : '--:--'
    const kind = m.kind === 'early-halt' ? `early halt ${hkt} hkt` : `early close ${hkt} hkt`
    return `next modified-hours day: ${fmtDayW(m.iso)} (${m.reason}) — ${kind}, ${away}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ overview</h1>
        <div className="flex items-center gap-3 text-[12px] text-dim">
          <span>today: {status.today}</span>
          <a href="/" target="_blank" className="text-accent hover:text-ink">view site →</a>
        </div>
      </div>

      {modifiedHours && (
        <div
          className={`flex flex-wrap items-center gap-2 border px-3 py-2 text-[13px] ${
            modifiedHours.daysAway <= 2
              ? 'border-warn/50 bg-warn/5 text-warn'
              : 'border-line bg-panel/40 text-dim'
          }`}
          role={modifiedHours.daysAway <= 2 ? 'alert' : 'status'}
        >
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              modifiedHours.kind === 'early-halt' ? 'bg-warn' : 'bg-warn opacity-60'
            }`}
            aria-hidden
          />
          <span>{modifiedHoursLine(modifiedHours)}</span>
          <a
            href={`/day/${modifiedHours.iso}`}
            target="_blank"
            className="ml-auto text-[12px] text-faint hover:text-ink"
          >
            open day →
          </a>
        </div>
      )}

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
        title="accounts — live"
        actions={<span className="text-[11px] text-faint">owner-dictated rules · refreshes here</span>}
      >
        {accLive && accLive.length > 0 ? (
          <div className="space-y-2 text-[13px]">
            {accLive.map((a) => {
              const s = a.status
              const fmt = (n: number) => `${n > 0 ? '+' : ''}$${Math.round(n).toLocaleString()}`
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line/60 pb-2 last:border-0"
                >
                  <span className="w-32 text-ink">{a.id}</span>
                  <span className="text-dim">
                    net {fmt(s.netPnl)} / {s.drawdownLimit != null ? `$${s.drawdownLimit.toLocaleString()}` : '—'} dd
                    {s.dailyLossLimit ? ` · today ${fmt(s.todayPnl)} / $${s.dailyLossLimit.toLocaleString()} day` : ''}
                  </span>
                  {s.breach === 'drawdown' && <span className="text-down">● breached — drawdown</span>}
                  {s.breach === 'daily' && <span className="text-down">● breached — daily</span>}
                  <span className={s.consistencyApplies ? 'text-up' : 'text-dim'}>
                    consistency: {s.consistencyApplies ? `applies (${a.stage})` : 'n/a'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[13px] text-faint">{accLive ? 'no accounts yet' : 'loading…'}</p>
        )}
      </Card>

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
