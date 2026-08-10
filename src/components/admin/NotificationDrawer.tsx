import { useEffect, useRef, useState } from 'react'
import { Button } from './ui'

interface NotificationDrawerProps {
  pendingReflections: { date: string; label: string; overdue: boolean }[]
  pendingPeriods: { type: string; anchor: string }[]
  pendingChanges: number
  dayStatus: 'unsaved' | 'saved' | 'published' | 'none'
  onRebuild: () => void
  onNavigateToDay: (date: string) => void
  onNavigateToReview: (type: string, anchor: string) => void
}

export function NotificationDrawer(props: NotificationDrawerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const total = props.pendingReflections.length + props.pendingPeriods.length + props.pendingChanges

  const statusDot = {
    unsaved: 'text-warn',
    saved: 'text-warn',
    published: 'text-up',
    none: 'text-faint',
  }[props.dayStatus]

  const statusText = {
    unsaved: 'unsaved draft',
    saved: 'saved · not published',
    published: 'published',
    none: 'no day yet',
  }[props.dayStatus]

  const today = new Date().toISOString().slice(0, 10)
  const overdue = props.pendingReflections.filter((p) => p.overdue)
  const grace = props.pendingReflections.filter((p) => !p.overdue && p.date === today)
  const otherGrace = props.pendingReflections.filter((p) => !p.overdue && p.date !== today)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="notifications"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center border border-line2 text-[13px] text-dim transition-colors hover:border-accent hover:text-ink md:h-11"
      >
        <span aria-hidden="true">🔔</span>
        {total > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center bg-line2 px-1 text-[10px] text-dim">
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 border border-line bg-panel shadow-2xl">
          <div className="border-b border-line px-3 py-2 text-[11px] uppercase tracking-widest text-dim">
            pending ({total})
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* pending reflections */}
            <div className="border-b border-line p-3">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-soft">reflections</div>
              {overdue.length === 0 && grace.length === 0 && otherGrace.length === 0 ? (
                <p className="text-[12px] text-faint">no pending reflections</p>
              ) : (
                <ul className="space-y-1.5">
                  {overdue.map((p) => (
                    <li key={p.date}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToDay(p.date); setOpen(false) }}
                        className="flex w-full items-center justify-between text-left text-[12px] text-down hover:text-ink"
                      >
                        <span>{p.label}</span>
                        <span className="text-[10px] uppercase">overdue</span>
                      </button>
                    </li>
                  ))}
                  {grace.map((p) => (
                    <li key={p.date}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToDay(p.date); setOpen(false) }}
                        className="flex w-full items-center justify-between text-left text-[12px] text-warn hover:text-ink"
                      >
                        <span>{p.label}</span>
                        <span className="text-[10px] uppercase">due tonight</span>
                      </button>
                    </li>
                  ))}
                  {otherGrace.map((p) => (
                    <li key={p.date}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToDay(p.date); setOpen(false) }}
                        className="w-full text-left text-[12px] text-dim hover:text-ink"
                      >
                        {p.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* pending period reviews */}
            <div className="border-b border-line p-3">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-soft">period reviews</div>
              {props.pendingPeriods.length === 0 ? (
                <p className="text-[12px] text-faint">no pending period reviews</p>
              ) : (
                <ul className="space-y-1.5">
                  {props.pendingPeriods.map((p) => (
                    <li key={`${p.type}-${p.anchor}`}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToReview(p.type, p.anchor); setOpen(false) }}
                        className="w-full text-left text-[12px] text-dim hover:text-ink"
                      >
                        {p.type} {p.anchor}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* site updates */}
            <div className="p-3">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-soft">site updates</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-dim">pending changes</span>
                  <span className={props.pendingChanges > 0 ? 'text-warn' : 'text-up'}>
                    {props.pendingChanges}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-dim">today</span>
                  <span className={`${statusDot} flex items-center gap-1`}>
                    <span>●</span>
                    {statusText}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => { props.onRebuild(); setOpen(false) }}
                  disabled={props.pendingChanges === 0}
                >
                  rebuild to publish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
