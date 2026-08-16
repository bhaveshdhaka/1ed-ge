import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { Button, TextInput, TextArea } from './ui'

/**
 * RoutinesPanel — full interactive routine panels for the DayWorkspace.
 * Shows done/not-done toggles for each routine activity.
 * Clicking a done toggle or the label expands the full routine panel inline.
 */

/* ────────────────────────────────────────────
 * Types & constants
 * ──────────────────────────────────────────── */

type Activity = 'quiet' | 'nature' | 'exercise' | 'intentions' | 'rewiring' | '21days' | 'mindmovie'

interface RoutineRecord {
  file: string
  date: string
  activity: string
  completedAt: string
  minutes?: number
  mood?: string
  practice?: string
}

const ACTIVITIES: { id: Activity; label: string; icon: string; isRoutine: boolean }[] = [
  { id: 'quiet', label: 'quiet', icon: '🎧', isRoutine: true },
  { id: 'nature', label: 'nature', icon: '🌿', isRoutine: true },
  { id: 'exercise', label: 'exercise', icon: '💪', isRoutine: true },
  { id: 'intentions', label: 'intentions', icon: '✍️', isRoutine: true },
  { id: 'rewiring', label: 're-wiring', icon: '🧠', isRoutine: true },
  { id: '21days', label: '21 days', icon: '📅', isRoutine: true },
  { id: 'mindmovie', label: 'mind movie', icon: '🎬', isRoutine: false },
]

const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('en-CA')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

/* ────────────────────────────────────────────
 * SVG Ring Timer (reusable)
 * ──────────────────────────────────────────── */

function RingTimer({ remaining, total, size = 160, strokeW = 8 }: { remaining: number; total: number; size?: number; strokeW?: number }) {
  const r = (size - strokeW) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? remaining / total : 0
  const offset = circ * (1 - pct)
  return (
    <svg width={size} height={size} className="mx-auto block" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={strokeW} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--color-accent)" strokeWidth={strokeW}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s ease', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="text-2xl font-semibold" fill="var(--color-ink)" style={{ fontFamily: 'var(--font-mono)' }}>
        {fmtTime(remaining)}
      </text>
    </svg>
  )
}

/* ────────────────────────────────────────────
 * Timer hook
 * ──────────────────────────────────────────── */

function useTimer(initialMinutes: number) {
  const total = initialMinutes * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const remainingRef = useRef(remaining)

  const onTick = useRef<() => void>(() => {})

  // keep refs in sync
  useEffect(() => { remainingRef.current = remaining }, [remaining])

  const stop = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const start = useCallback(() => {
    if (running) {
      stop()
      return
    }
    if (remainingRef.current <= 0) {
      setRemaining(total)
      remainingRef.current = total
    }
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1
        if (next <= 0) {
          stop()
          onTick.current()
          return 0
        }
        return next
      })
    }, 1000)
  }, [running, stop, total])

  const reset = useCallback((mins?: number) => {
    stop()
    const t = (mins ?? initialMinutes) * 60
    setRemaining(t)
    remainingRef.current = t
  }, [stop, initialMinutes])

  // cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return { remaining, total, running, start, stop, reset, setRemaining, onTick }
}

/* ────────────────────────────────────────────
 * Mind Movie IndexedDB helpers
 * ──────────────────────────────────────────── */

interface MovieClip {
  id: string
  kind: string
  url: string
  ts: number
}

function openMovieDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open('mindmovie', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('clips')) db.createObjectStore('clips', { keyPath: 'id' })
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function allMovieClips(): Promise<MovieClip[]> {
  const db = await openMovieDb()
  return new Promise((res, rej) => {
    const tx = db.transaction('clips', 'readonly')
    const out: MovieClip[] = []
    tx.objectStore('clips').openCursor().onsuccess = (e) => {
      const cur = (e.target as IDBRequest).result
      if (cur) { out.push(cur.value); cur.continue() } else res(out.sort((a, b) => b.ts - a.ts))
    }
    tx.onerror = () => rej(tx.error)
  })
}

async function addMovieClip(file: File) {
  const db = await openMovieDb()
  const rec = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: file.type.startsWith('video') ? 'video' : 'image',
    url: URL.createObjectURL(file),
    ts: Date.now(),
  }
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('clips', 'readwrite')
    tx.objectStore('clips').put(rec)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

async function delMovieClip(id: string) {
  const db = await openMovieDb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('clips', 'readwrite')
    tx.objectStore('clips').delete(id)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

/* ────────────────────────────────────────────
 * Main RoutinesPanel
 * ──────────────────────────────────────────── */

export function RoutinesPanel({ date }: { date: string }) {
  const [records, setRecords] = useState<RoutineRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [derived, setDerived] = useState<{ quietDone?: boolean }>({})
  const [expanded, setExpanded] = useState<Activity | null>(null)
  const [saving, setSaving] = useState(false)

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
    // Mind movie is device-local, not an API routine
    if (activity === 'mindmovie') {
      setExpanded((prev) => (prev === 'mindmovie' ? null : 'mindmovie'))
      return
    }
    const existing = records.find((r) => r.activity === activity)
    if (existing) {
      // Already done — expand/collapse panel
      setExpanded((prev) => (prev === activity ? null : activity))
      return
    }
    // Not yet done — mark complete
    setSaving(true)
    try {
      await api('/api/admin/routines', {
        method: 'POST',
        body: JSON.stringify({ activity, date }),
      })
      await load()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const saveWithData = async (activity: Activity, data: Record<string, unknown>) => {
    setSaving(true)
    try {
      await api('/api/admin/routines', {
        method: 'POST',
        body: JSON.stringify({ activity, date, ...data }),
      })
      await load()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const isDone = (activity: Activity): boolean => {
    if (activity === 'mindmovie') return false // always clickable, device-local
    if (activity === 'quiet') return derived.quietDone ?? records.some((r) => r.activity === 'quiet')
    return records.some((r) => r.activity === activity)
  }

  const getMinutes = (activity: Activity): number | undefined => {
    const rec = records.find((r) => r.activity === activity)
    return rec?.minutes
  }

  const getRecordsFor = (activity: Activity): RoutineRecord[] => {
    return records.filter((r) => r.activity === activity)
  }

  const doneCount = ACTIVITIES.filter((a) => a.isRoutine && isDone(a.id)).length
  const routineCount = ACTIVITIES.filter((a) => a.isRoutine).length

  return (
    <div className="panel mt-3 md:mt-5">
      <div className="card-hd">
        <span className="card-ico">🧘</span>
        <span className="card-lbl">routines</span>
        <span className="card-sub">{doneCount}/{routineCount}</span>
        {saving && <span className="tmr">saving…</span>}
      </div>
      <div className="p-3 md:p-4">
        {loading ? (
          <p className="text-xs text-faint">loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => {
                const done = isDone(a.id)
                const mins = getMinutes(a.id)
                const isExpanded = expanded === a.id
                const isClickable = done || a.id === 'mindmovie'
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors min-h-[36px] ${
                      done
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : a.id === 'mindmovie' && isExpanded
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-line text-dim hover:border-accent/30 hover:text-ink'
                    }`}
                  >
                    <span>{a.icon}</span>
                    <span className="font-medium">{a.label}</span>
                    {done && mins != null && (
                      <span className="text-3xs text-accent/70">{mins}m</span>
                    )}
                    {isClickable && (
                      <span className="text-accent">{isExpanded ? '▾' : '✓'}</span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-3xs text-faint">
              tracked on HKT day spine · quiet syncs to habits · re-wiring derives from 20m+ quiet
            </p>
          </>
        )}

        {/* ── Expanded panels ── */}
        {expanded === 'quiet' && (
          <QuietTimerPanel
            date={date}
            records={getRecordsFor('quiet')}
            onSave={(data) => saveWithData('quiet', data)}
          />
        )}
        {expanded === 'nature' && (
          <NatureTimerPanel
            date={date}
            records={getRecordsFor('nature')}
            onSave={(data) => saveWithData('nature', data)}
          />
        )}
        {expanded === 'exercise' && (
          <ExercisePanel
            date={date}
            records={getRecordsFor('exercise')}
            onSave={(data) => saveWithData('exercise', data)}
          />
        )}
        {expanded === 'intentions' && (
          <IntentionsPanel
            date={date}
            records={getRecordsFor('intentions')}
            onSave={(data) => saveWithData('intentions', data)}
          />
        )}
        {expanded === 'rewiring' && (
          <RewiringPanel
            date={date}
            records={getRecordsFor('rewiring')}
            quietDone={derived.quietDone ?? false}
            quietMinutes={records.filter(r => r.activity === 'quiet' && (r.minutes ?? 0) >= 20).length > 0 ? 20 : 0}
            onSave={(data) => saveWithData('rewiring', data)}
          />
        )}
        {expanded === '21days' && (
          <TwentyOneDaysPanel
            date={date}
            records={getRecordsFor('21days')}
            onSave={(data) => saveWithData('21days', data)}
          />
        )}
        {expanded === 'mindmovie' && (
          <MindMoviePanel />
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
 * Quiet Timer Panel
 * ──────────────────────────────────────────── */

function QuietTimerPanel({ date, records, onSave }: {
  date: string
  records: RoutineRecord[]
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const timers = useTimer(20)
  const [customMin, setCustomMin] = useState('')
  const [status, setStatus] = useState('ready')

  // Wire onTick to auto-save
  useEffect(() => {
    timers.onTick.current = () => {
      setStatus('complete · saved')
      const mins = Math.round(timers.total / 60)
      onSave({ minutes: mins, completedAt: new Date().toISOString() })
    }
  }, [timers.total, onSave])

  const todayMinutes = records
    .filter((r) => r.date === date)
    .reduce((sum, r) => sum + (r.minutes ?? 0), 0)

  const allRecords = records.filter((r) => r.minutes != null)

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">quiet timer</div>
      <div className="text-center">
        <RingTimer remaining={timers.remaining} total={timers.total} size={140} strokeW={7} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {[5, 10, 20, 30].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { timers.reset(m); setStatus(`${m} min set`) }}
              className="capsule cursor-pointer hover:border-accent/50 hover:text-ink"
            >
              +{m} min
            </button>
          ))}
          <input
            type="number" min="1" max="240" placeholder="own"
            value={customMin}
            onChange={(e) => setCustomMin(e.target.value)}
            onBlur={() => {
              const v = Number(customMin)
              if (v > 0) { timers.reset(v); setStatus(`${v} min set`) }
            }}
            className="input w-20 text-center text-xs"
          />
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="primary" onClick={timers.start} className="min-h-[40px] px-6">
            {timers.running ? 'Pause' : 'Begin'}
          </Button>
          <Button onClick={() => { timers.reset(); setStatus('ready') }} className="min-h-[40px]">
            Reset
          </Button>
        </div>
        {status && <p className="mt-2 text-2xs text-accent">{status}</p>}
      </div>
      {/* Session log */}
      {todayMinutes > 0 && (
        <div className="mt-4 well p-3">
          <div className="text-2xs uppercase tracking-widest text-dim mb-2">
            today · {todayMinutes} min total
          </div>
          <div className="flex flex-col gap-1">
            {allRecords.filter(r => r.date === date).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-soft">
                <span>{r.minutes} min</span>
                <span className="text-3xs text-faint">{fmtDateTime(r.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
 * Nature Timer Panel
 * ──────────────────────────────────────────── */

function NatureTimerPanel({ date, records, onSave }: {
  date: string
  records: RoutineRecord[]
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const timers = useTimer(20)
  const [status, setStatus] = useState('ready')
  const [customMin, setCustomMin] = useState('')

  useEffect(() => {
    timers.onTick.current = () => {
      setStatus('complete')
      const mins = Math.round(timers.total / 60)
      onSave({ minutes: mins, completedAt: new Date().toISOString() })
    }
  }, [timers.total, onSave])

  const todayMinutes = records
    .filter((r) => r.date === date)
    .reduce((sum, r) => sum + (r.minutes ?? 0), 0)

  const allRecords = records.filter((r) => r.minutes != null)

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">nature timer</div>
      <div className="text-center">
        <RingTimer remaining={timers.remaining} total={timers.total} size={140} strokeW={7} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {[5, 10, 20].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { timers.reset(m); setStatus(`${m} min set`) }}
              className="capsule cursor-pointer hover:border-accent/50 hover:text-ink"
            >
              +{m} min
            </button>
          ))}
          <input
            type="number" min="1" max="240" placeholder="own"
            value={customMin}
            onChange={(e) => setCustomMin(e.target.value)}
            onBlur={() => {
              const v = Number(customMin)
              if (v > 0) { timers.reset(v); setStatus(`${v} min set`) }
            }}
            className="input w-20 text-center text-xs"
          />
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="primary" onClick={timers.start} className="min-h-[40px] px-6">
            {timers.running ? 'Pause' : 'Begin'}
          </Button>
          <Button onClick={() => { timers.reset(); setStatus('ready') }} className="min-h-[40px]">
            Reset
          </Button>
        </div>
        {status && <p className="mt-2 text-2xs text-accent">{status}</p>}
      </div>
      {todayMinutes > 0 && (
        <div className="mt-4 well p-3">
          <div className="text-2xs uppercase tracking-widest text-dim mb-2">
            today · {todayMinutes} min total
          </div>
          <div className="flex flex-col gap-1">
            {allRecords.filter(r => r.date === date).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-soft">
                <span>{r.minutes} min</span>
                <span className="text-3xs text-faint">{fmtDateTime(r.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
 * Exercise Panel
 * ──────────────────────────────────────────── */

const EXERCISES = [
  { id: 'ex1', label: "Trevor's Mini Mind Movie Meditation", meta: 'Audio · 20 Minutes' },
  { id: 'ex2', label: 'Full Moon Meditation', meta: 'Audio · 20 min' },
]

function ExercisePanel({ date, records, onSave }: {
  date: string
  records: RoutineRecord[]
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const rec = records.find(r => r.date === date)
      if (rec?.practice) return new Set(JSON.parse(rec.practice))
    } catch {}
    return new Set<string>()
  })
  const [saving, setSaving] = useState(false)
  const todayRec = records.find(r => r.date === date)

  const toggleEx = async (id: string) => {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChecked(next)
    setSaving(true)
    try {
      await onSave({ practice: JSON.stringify([...next]) })
    } finally {
      setSaving(false)
    }
  }

  const done = todayRec != null || checked.size > 0

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">daily exercises</div>
      <p className="text-xs text-dim mb-3">Small daily actions create extraordinary results over time.</p>
      <div className="flex flex-col gap-2">
        {EXERCISES.map((ex) => (
          <label key={ex.id} className="flex items-start gap-3 rounded-lg border border-line bg-raise/50 p-3 cursor-pointer hover:border-accent/30">
            <input
              type="checkbox"
              checked={checked.has(ex.id)}
              onChange={() => toggleEx(ex.id)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <div>
              <div className="text-sm font-semibold text-ink">{ex.label}</div>
              <div className="text-xs text-dim">{ex.meta}</div>
            </div>
          </label>
        ))}
      </div>
      {done && (
        <p className="mt-3 text-2xs text-accent">
          {checked.size}/{EXERCISES.length} completed
          {saving && <span className="ml-2 text-faint">saving…</span>}
        </p>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
 * Intentions Panel (5 Ps)
 * ──────────────────────────────────────────── */

const P_FIELDS = [
  { key: 'purpose', label: 'Purpose', placeholder: 'Your deepest why…' },
  { key: 'pursuit', label: 'Pursuit', placeholder: 'What you are moving toward…' },
  { key: 'process', label: 'Process', placeholder: 'The daily actions…' },
  { key: 'position', label: 'Position', placeholder: 'How you hold yourself…' },
  { key: 'perspective', label: 'Perspective', placeholder: 'The lens you choose…' },
]

function IntentionsPanel({ date, records, onSave }: {
  date: string
  records: RoutineRecord[]
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const savedRec = records.find(r => r.date === date)

  const [values, setValues] = useState<Record<string, string>>(() => {
    if (savedRec?.practice) {
      try { return JSON.parse(savedRec.practice) } catch {}
    }
    return {}
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(savedRec?.completedAt ?? null)

  const handleSave = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await onSave({ practice: JSON.stringify(values), completedAt: now })
      setSavedAt(now)
    } finally {
      setSaving(false)
    }
  }

  const hasValues = Object.values(values).some((v) => v.trim().length > 0)

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">intentions · 5 Ps</div>
      <p className="text-2xs text-faint mb-3">{date}</p>
      <div className="flex flex-col gap-3">
        {P_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <TextInput
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving || !hasValues} className="min-h-[40px]">
          {saving ? 'Saving…' : 'Save Intentions'}
        </Button>
        {savedAt && (
          <span className="text-2xs text-accent">✓ saved {fmtDateTime(savedAt)}</span>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
 * Re-Wiring Panel
 * ──────────────────────────────────────────── */

function RewiringPanel({ date, records, onSave, quietDone, quietMinutes }: {
  date: string
  records: RoutineRecord[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  quietDone: boolean
  quietMinutes: number
}) {
  const todayRec = records.find(r => r.date === date)
  const [practice, setPractice] = useState(todayRec?.practice ?? '')
  const [saving, setSaving] = useState(false)
  const unlocked = quietDone && quietMinutes >= 20

  const handleSave = async () => {
    if (!practice.trim()) return
    setSaving(true)
    try {
      await onSave({ practice: practice.trim(), completedAt: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">re-wiring · neural practice</div>
      {!unlocked ? (
        <div className="well p-4 text-center">
          <p className="text-sm text-dim">
            🔒 Complete 20+ minutes of quiet time today to unlock re-wiring.
          </p>
          <p className="mt-1 text-2xs text-faint">
            {quietDone ? `${quietMinutes} min quiet so far — need 20 min` : 'No quiet session today yet'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-dim mb-3">
            Treat your 20 minutes as a formal business appointment with the subconscious.
          </p>
          <label className="label">neural practice note</label>
          <TextArea
            rows={3}
            placeholder="What neural pathway are you reinforcing today?"
            value={practice}
            onChange={(e) => setPractice(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={handleSave} disabled={saving || !practice.trim()} className="min-h-[40px]">
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <a
              href="/api/admin/assets/rewiring-appointment.ics"
              download
              className="btn min-h-[40px]"
            >
              📅 Apple · .ics
            </a>
            {todayRec && (
              <span className="text-2xs text-accent">✓ saved</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
 * Mind Movie Panel
 * ──────────────────────────────────────────── */

function MindMoviePanel() {
  const [clips, setClips] = useState<MovieClip[]>([])

  const loadClips = useCallback(async () => {
    try {
      const all = await allMovieClips()
      setClips(all)
    } catch {}
  }, [])

  useEffect(() => { loadClips() }, [loadClips])

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      await addMovieClip(f)
    }
    await loadClips()
  }

  const handleDelete = async (id: string) => {
    await delMovieClip(id)
    await loadClips()
  }

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">mind movie</div>
      <p className="text-xs text-dim mb-3">Clip gallery — these live only on this device (IndexedDB).</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <label className="btn btn-primary min-h-[40px] cursor-pointer px-4 text-sm">
          📷 Take a photo
          <input
            type="file" accept="image/*" capture="environment"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </label>
        <label className="btn min-h-[40px] cursor-pointer px-4 text-sm">
          🎥 Record video
          <input
            type="file" accept="video/*" capture="environment"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </label>
        <label className="btn min-h-[40px] cursor-pointer px-4 text-sm">
          🖼 Gallery
          <input
            type="file" accept="image/*,video/*" multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </label>
      </div>

      {clips.length === 0 ? (
        <div className="well p-6 text-center text-sm text-dim">
          Nothing captured yet — your clips live only on this device.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {clips.map((c) => (
            <div key={c.id} className="panel-flat relative overflow-hidden group">
              {c.kind === 'video' ? (
                <video src={c.url} className="h-40 w-full object-cover" controls muted playsInline />
              ) : (
                <img src={c.url} className="h-40 w-full object-cover" alt="mind movie clip" />
              )}
              <button
                onClick={() => handleDelete(c.id)}
                className="absolute right-1.5 top-1.5 rounded-full bg-bg/80 px-2 py-1 text-2xs text-dim backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
 * 21 Days Panel
 * ──────────────────────────────────────────── */

function TwentyOneDaysPanel({ date, records, onSave }: {
  date: string
  records: RoutineRecord[]
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const todayRec = records.find(r => r.date === date)
  const [saving, setSaving] = useState(false)

  // Generate last 21 days
  const days: { date: string; dayNum: number; label: string }[] = []
  for (let i = 20; i >= 0; i--) {
    const d = new Date(date + 'T00:00:00+08:00')
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    days.push({ date: ds, dayNum: 21 - i, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) })
  }

  // For now count records across all activities (simplified — each day that has routines counts toward the 21)
  const completedDays = new Set<string>()
  for (const r of records) {
    if (r.date) completedDays.add(r.date)
  }
  // Also count the day-spine habits for quiet-time sync
  const progress = days.filter(d => completedDays.has(d.date)).length

  const practices = [
    { id: 'mental-diet', title: '7-Day Mental Diet', blurb: 'Only chosen thoughts. Change the channel whenever the old ones return.' },
    { id: 'window-shopping', title: 'Structured Window Shopping', blurb: 'Observe what you desire with awe, without urgency.' },
    { id: 'own', title: 'My own practice', blurb: 'Define your daily reset for the Reticular Activating System.' },
  ]

  const selectPractice = async (pid: string) => {
    setSaving(true)
    try {
      await onSave({ practice: pid, completedAt: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-sep pt-4">
      <div className="card-lbl mb-3">21-day practice</div>
      <p className="text-xs text-dim mb-4">
        Reticular Activating System reset. No streaks. Only certainty. Twenty-one days to re-tune your RAS.
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-2xs text-dim">progress</span>
          <span className="text-xs font-semibold text-accent">{progress}/21</span>
        </div>
        <div className="h-2 w-full rounded-full bg-line overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(progress / 21) * 100}%` }}
          />
        </div>
      </div>

      {/* 3×7 Grid */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {days.map((d) => {
          const isComplete = completedDays.has(d.date)
          const isToday = d.date === date
          return (
            <div
              key={d.date}
              title={d.label}
              className={`flex flex-col items-center justify-center rounded-md border p-1.5 text-center min-h-[44px] ${
                isComplete
                  ? 'border-accent/50 bg-accent/10'
                  : isToday
                    ? 'border-accent/30 bg-raise'
                    : 'border-line bg-bg'
              }`}
            >
              <span className={`text-3xs ${isComplete ? 'text-accent' : 'text-faint'}`}>
                {d.dayNum}
              </span>
              {isComplete && <span className="text-accent text-3xs">✓</span>}
            </div>
          )
        })}
      </div>

      {/* Practice picker */}
      {!todayRec && (
        <>
          <div className="card-lbl mb-2">choose your practice</div>
          <div className="flex flex-col gap-2">
            {practices.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPractice(p.id)}
                disabled={saving}
                className="panel-flat group flex items-start gap-3 p-3 text-left transition-colors hover:border-accent/50 cursor-pointer"
              >
                <div className="card-ico mt-0.5 text-faint">✓</div>
                <div>
                  <div className="text-sm font-semibold text-ink">{p.title}</div>
                  <div className="mt-1 text-xs text-dim leading-relaxed">{p.blurb}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {todayRec && (
        <div className="well p-4 mt-3">
          <p className="text-xs text-accent">
            ✓ Practice selected: {practices.find(p => p.id === todayRec.practice)?.title ?? todayRec.practice}
          </p>
        </div>
      )}
      {saving && <p className="mt-2 text-2xs text-faint">saving…</p>}
    </div>
  )
}
