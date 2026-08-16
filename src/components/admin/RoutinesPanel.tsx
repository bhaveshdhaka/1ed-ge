import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/**
 * RoutinesPanel — compact routine status for the DayWorkspace.
 * Shows done/not-done toggles for each routine activity.
 * Quiet/nature get timer indicators. Shares auth context with admin.
 */

type Activity = 'quiet' | 'nature' | 'exercise' | 'intentions' | 'rewiring' | '21days'

interface RoutineRecord {
  date: string
  activity: string
  completedAt: string
  minutes?: number
  mood?: string
  practice?: string
}

const ACTIVITIES: { id: Activity; label: string; icon: string }[] = [
  { id: 'quiet', label: 'quiet', icon: '🎧' },
  { id: 'nature', label: 'nature', icon: '🌿' },
  { id: 'exercise', label: 'exercise', icon: '💪' },
  { id: 'intentions', label: 'intentions', icon: '✍️' },
  { id: 'rewiring', label: 're-wiring', icon: '🧠' },
  { id: '21days', label: '21 days', icon: '📅' },
]

export function RoutinesPanel({ date }: { date: string }) {
  const [records, setRecords] = useState<RoutineRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [derived, setDerived] = useState<{ quietDone?: boolean }>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ ok: boolean; records: RoutineRecord[]; derived?: { quietDone?: boolean } }>(
        `/api/admin/routines?date=${date}`
      )
      setRecords(res.records ?? [])
      setDerived(res.derived ?? {})
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (activity: Activity) => {
    const existing = records.find((r) => r.activity === activity)
    if (existing) return // already done — don't duplicate

    try {
      await api('/api/admin/routines', {
        method: 'POST',
        body: JSON.stringify({ activity, date }),
      })
      await load()
    } catch {
      // silent
    }
  }

  const isDone = (activity: Activity): boolean => {
    if (activity === 'quiet') return derived.quietDone ?? records.some((r) => r.activity === 'quiet')
    return records.some((r) => r.activity === activity)
  }

  const getMinutes = (activity: Activity): number | undefined => {
    const rec = records.find((r) => r.activity === activity)
    return rec?.minutes
  }

  const doneCount = ACTIVITIES.filter((a) => isDone(a.id)).length

  return (
    <div className="panel">
      <div className="card-hd">
        <span className="card-ico">🧘</span>
        <span className="card-lbl">routines</span>
        <span className="card-sub">{doneCount}/{ACTIVITIES.length}</span>
        <span className="ml-2 border border-line px-1.5 py-0.5 text-3xs uppercase tracking-wide text-faint">private</span>
      </div>
      <div className="p-3 md:p-4">
        {loading ? (
          <p className="text-xs text-faint">loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => {
              const done = isDone(a.id)
              const mins = getMinutes(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors min-h-[36px] ${
                    done
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-line text-dim hover:border-accent/30 hover:text-ink'
                  }`}
                >
                  <span>{a.icon}</span>
                  <span className="font-medium">{a.label}</span>
                  {done && mins != null && (
                    <span className="text-3xs text-accent/70">{mins}m</span>
                  )}
                  {done && (
                    <span className="text-accent">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        <p className="mt-2 text-3xs text-faint">
          tracked on HKT day spine · quiet syncs to habits · re-wiring derives from 20m+ quiet
        </p>
      </div>
    </div>
  )
}
