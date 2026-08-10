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
        className="flex h-10 w-10 items-center justify-center border border-line2 text-sm text-dim transition-colors hover:border-accent hover:text-ink md:h-11"
      >
        <span aria-hidden="true">🔔</span>
        {total > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center bg-line2 px-1 text-3xs text-dim">
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className="panel absolute bottom-full right-0 z-50 mb-2 w-80">
          <div className="card-hd">
            <span className="card-ico" aria-hidden="true">🔔</span>
            <span className="card-lbl">notifications</span>
            <span className="card-sub">{total} pending</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* pending reflections */}
            <div className="border-b border-line">
              <div className="card-hd">
                <span className="card-lbl">reflections</span>
              </div>
              <div className="p-3">
              {overdue.length === 0 && grace.length === 0 && otherGrace.length === 0 ? (
                <p className="text-xs text-faint">no pending reflections</p>
              ) : (
                <ul className="space-y-1.5">
                  {overdue.map((p) => (
                    <li key={p.date}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToDay(p.date); setOpen(false) }}
                        className="flex w-full items-center justify-between text-left text-xs text-down hover:text-ink"
                      >
                        <span>{p.label}</span>
                        <span className="text-3xs uppercase">overdue</span>
                      </button>
                    </li>
                  ))}
                  {grace.map((p) => (
                    <li key={p.date}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToDay(p.date); setOpen(false) }}
                        className="flex w-full items-center justify-between text-left text-xs text-warn hover:text-ink"
                      >
                        <span>{p.label}</span>
                        <span className="text-3xs uppercase">due tonight</span>
                      </button>
                    </li>
                  ))}
                  {otherGrace.map((p) => (
                    <li key={p.date}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToDay(p.date); setOpen(false) }}
                        className="w-full text-left text-xs text-dim hover:text-ink"
                      >
                        {p.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>

            {/* pending period reviews */}
            <div className="border-b border-line">
              <div className="card-hd">
                <span className="card-lbl">period reviews</span>
              </div>
              <div className="p-3">
              {props.pendingPeriods.length === 0 ? (
                <p className="text-xs text-faint">no pending period reviews</p>
              ) : (
                <ul className="space-y-1.5">
                  {props.pendingPeriods.map((p) => (
                    <li key={`${p.type}-${p.anchor}`}>
                      <button
                        type="button"
                        onClick={() => { props.onNavigateToReview(p.type, p.anchor); setOpen(false) }}
                        className="flex w-full items-center justify-between text-left text-xs text-dim hover:text-ink"
                      >
                        <span>{p.type} {p.anchor}</span>
                        <span className="text-3xs uppercase text-warn">due today</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>

            {/* site updates */}
            <div className="card-hd">
              <span className="card-lbl">site updates</span>
            </div>
            <div className="p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dim">pending changes</span>
                  <span className={props.pendingChanges > 0 ? 'text-warn' : 'text-up'}>
                    {props.pendingChanges}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
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
