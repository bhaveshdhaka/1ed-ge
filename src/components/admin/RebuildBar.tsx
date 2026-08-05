import { useCallback, useEffect, useState } from 'react'
import { bus, fetchRebuildState, triggerRebuild, type PendingChange, type RebuildRecord } from './api'

export function RebuildBar() {
  const [pending, setPending] = useState<PendingChange[]>([])
  const [rebuilds, setRebuilds] = useState<RebuildRecord[]>([])
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

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

  // flash "N changes live" when a rebuild finishes
  useEffect(() => {
    const latest = rebuilds[0]
    if (!latest) return
    if (!running && latest.ok && latest.applied.length) {
      const n = latest.applied.length
      setFlash(`${n} change${n === 1 ? '' : 's'} live`)
      const t = setTimeout(() => setFlash(null), 5000)
      return () => clearTimeout(t)
    }
  }, [running, rebuilds])

  const rebuild = async () => {
    setRunning(true)
    await triggerRebuild()
    setTimeout(load, 600)
  }

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur">
      <div className="shell flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[12px]">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-[13px]"
        >
          <span className={pending.length ? 'text-warn' : 'text-up'}>
            {pending.length ? `● ${pending.length} pending change${pending.length === 1 ? '' : 's'}` : '● up to date'}
          </span>
          <span className="text-faint">{expanded ? '▾' : '▸'}</span>
        </button>
        {pending.length > 0 && (
          <span className="text-faint">will take effect on rebuild</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {flash && <span className="text-up">✓ {flash}</span>}
          {running && <span className="text-warn">rebuilding… (~8s)</span>}
          <button
            onClick={rebuild}
            disabled={running || pending.length === 0}
            className="border border-up/60 px-2.5 py-0.5 text-up transition-colors hover:bg-up/10 disabled:opacity-40"
          >
            {running ? 'building…' : 'rebuild now'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="shell border-t border-line pb-2">
          {pending.length === 0 ? (
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
          {rebuilds.length > 0 && (
            <p className="border-t border-line/60 pt-1 text-[11px] text-faint">
              last rebuild: {rebuilds[0].ok ? 'ok' : 'failed'} ·{' '}
              {new Date(rebuilds[0].at).toLocaleString()} ·{' '}
              {rebuilds[0].applied.length ? `${rebuilds[0].applied.length} change(s) applied` : 'no changes'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
