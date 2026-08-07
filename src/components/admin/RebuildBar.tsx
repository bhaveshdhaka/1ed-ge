import { useCallback, useEffect, useRef, useState } from 'react'
import { bus, fetchRebuildState, triggerRebuild, type PendingChange, type RebuildRecord } from './api'
import { fmtDay } from '../../lib/dates'

function dateFromLabel(label: string): string | null {
  const m = label.match(/\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : null
}

export function RebuildBar() {
  const [pending, setPending] = useState<PendingChange[]>([])
  const [rebuilds, setRebuilds] = useState<RebuildRecord[]>([])
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [flash, setFlash] = useState<{ msg: string; link?: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const flashedRef = useRef<string | null>(null)
  const last = rebuilds[0]

  const load = useCallback(async () => {
    try {
      const res = await fetchRebuildState()
      setPending(res.pending)
      setRebuilds(res.rebuilds)
      setRunning(!!res.build?.running)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const off = bus.on(load)
    const id = setInterval(load, 4000)
    return () => {
      off()
      clearInterval(id)
    }
  }, [load])

  // elapsed timer while a build runs
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // flash "N changes live" when a rebuild finishes, with a publish link
  useEffect(() => {
    const latest = rebuilds[0]
    if (!latest) return
    if (running || !latest.ok || !latest.applied.length) return
    if (flashedRef.current === latest.at) return
    flashedRef.current = latest.at
    const n = latest.applied.length
    const date = latest.applied.map(dateFromLabel).find(Boolean)
    setFlash({
      msg: `${n} change${n === 1 ? '' : 's'} live`,
      link: date ? `/day/${fmtDay(date)}` : undefined,
    })
    const t = setTimeout(() => setFlash(null), 8000)
    return () => clearTimeout(t)
  }, [running, rebuilds])

  const rebuild = async () => {
    setExpanded(true)
    setElapsed(0)
    try {
      await triggerRebuild()
      setRunning(true)
    } catch {
      setRunning(false)
    }
    setTimeout(load, 600)
  }

  const lastRebuild = rebuilds[0]
  const idle = pending.length === 0 && !running

  return (
    <div
      className={`sticky top-0 z-40 border-b border-line backdrop-blur ${
        idle ? 'bg-panel/80' : 'bg-panel/95'
      }`}
    >
      {idle ? (
        // collapsed: slim "published" strip
        <div className="shell flex items-center gap-x-4 py-1.5 text-[12px]">
          <button onClick={() => setExpanded((e) => !e)} className="flex h-8 items-center gap-2 text-[12px]">
            <span className="text-up">● published</span>
            <span className="text-faint">{expanded ? '▾' : '▸'}</span>
          </button>
          {flash && (
            <span className="flex items-center gap-2 text-up">
              ✓ {flash.msg}
              {flash.link && (
                <a href={flash.link} target="_blank" className="text-accent underline underline-offset-4 hover:text-ink">
                  view →
                </a>
              )}
            </span>
          )}
          {lastRebuild && !flash && (
            <span className="text-faint">last rebuilt {new Date(lastRebuild.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
      ) : (
        // expanded: pending changes + rebuild control
        <div className="shell flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[12px]">
          <button onClick={() => setExpanded((e) => !e)} className="flex h-8 items-center gap-2 text-[13px]">
            {running ? (
              <span className="text-warn">● rebuilding… {elapsed}s</span>
            ) : (
              <span className="text-warn">● {pending.length} draft change{pending.length === 1 ? '' : 's'} — not published</span>
            )}
            <span className="text-faint">{expanded ? '▾' : '▸'}</span>
          </button>
          <div className="ml-auto flex items-center gap-3">
            {flash && (
              <span className="flex items-center gap-2 text-up">
                ✓ {flash.msg}
                {flash.link && (
                  <a href={flash.link} target="_blank" className="text-accent underline underline-offset-4 hover:text-ink">
                    view →
                  </a>
                )}
              </span>
            )}
            <button
              onClick={rebuild}
              disabled={running || pending.length === 0}
              className="flex h-9 items-center border border-up/60 px-3 text-up transition-colors hover:bg-up/10 disabled:opacity-40"
            >
              {running ? 'building…' : 'rebuild to publish'}
            </button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="shell border-t border-line pb-2">
          {last && last.ok === false && (
            <div role="alert" className="border border-down bg-down/10 px-3 py-2 text-[12px] text-down">
              ✗ build failed at {new Date(last.at).toLocaleTimeString()} — {last.error ?? 'see the rebuild log'}. your changes are still pending; fix and rebuild again.
            </div>
          )}
          {running ? (
            <p className="py-1 text-[12px] text-faint">
              rebuilding the site — static pages update in place, no restart needed. you can keep working.
            </p>
          ) : pending.length === 0 ? (
            <p className="py-1 text-[12px] text-faint">nothing queued — the site reflects the latest build.</p>
          ) : (
            <ul className="space-y-0.5 py-1">
              {pending.map((c, i) => (
                <li key={i} className="flex items-baseline gap-3 text-[12px]">
                  <span className="text-faint">{new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-ink">{c.label}</span>
                  {c.detail && <span className="text-dim">{c.detail}</span>}
                </li>
              ))}
            </ul>
          )}
          {lastRebuild && (
            <p className="border-t border-line/60 pt-1 text-[11px] text-faint">
              last rebuild: {lastRebuild.ok ? 'ok' : 'failed'} ·{' '}
              {new Date(lastRebuild.at).toLocaleString()} ·{' '}
              {lastRebuild.applied.length ? `${lastRebuild.applied.length} change(s) applied` : 'no changes'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
