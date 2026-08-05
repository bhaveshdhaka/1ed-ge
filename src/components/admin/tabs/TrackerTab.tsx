import { useCallback, useEffect, useState } from 'react'
import { api, todayStr, triggerRebuild } from '../api'
import { Card, Button, Field, TextInput, inputCls } from '../ui'

interface HabitRow {
  slug: string
  name: string
  emoji?: string
  color?: string
  description?: string
}
interface LogRow {
  file: string
  date: string
  values?: Record<string, boolean>
  note?: string
}

export function TrackerTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [habits, setHabits] = useState<HabitRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [date, setDate] = useState(todayStr())
  const [values, setValues] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ habits: HabitRow[]; logs: LogRow[] }>('/api/admin/tracker')
      setHabits(res.habits)
      setLogs(res.logs)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const selectDate = (d: string) => {
    setDate(d)
    const log = logs.find((l) => l.date === d)
    setValues({ ...(log?.values ?? {}) })
    setNote(String(log?.note ?? ''))
  }

  const toggle = (slug: string) => setValues((v) => ({ ...v, [slug]: !v[slug] }))

  const save = async () => {
    setSaving(true)
    try {
      await api('/api/admin/tracker', {
        method: 'POST',
        body: { action: 'saveLog', date, values, note: note.trim() || undefined },
      })
      notify(`habit log saved for ${date}`)
      triggerRebuild()
      await load()
      selectDate(date)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
    setSaving(false)
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { key: k, label: `${d.getMonth() + 1}/${d.getDate()}` }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ tracker</h1>
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? 'saving…' : 'save day'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card
            title="log a day"
            actions={
              <TextInput
                type="date"
                value={date}
                onChange={(e) => selectDate(e.target.value)}
                className="w-40"
              />
            }
          >
            <div className="grid gap-2 md:grid-cols-2">
              {habits.map((h) => {
                const done = !!values[h.slug]
                return (
                  <button
                    key={h.slug}
                    onClick={() => toggle(h.slug)}
                    className={`flex items-center justify-between border px-3 py-3 text-left transition-colors ${
                      done ? 'border-transparent' : 'border-line2 bg-bg hover:border-accent'
                    }`}
                    style={done ? { background: h.color ?? '#4ade80', color: '#0a0a0c' } : {}}
                  >
                    <span className="flex items-center gap-2 text-[14px]">
                      <span>{h.emoji ?? '·'}</span>
                      <span className={done ? 'font-semibold' : 'text-ink'}>{h.name}</span>
                    </span>
                    <span className="text-[12px] opacity-70">{done ? '✓ done' : 'not done'}</span>
                  </button>
                )
              })}
              {habits.length === 0 && <p className="text-[12px] text-faint">define habits below first</p>}
            </div>
            <Field label="note" className="mt-4">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="anything worth remembering about today" />
            </Field>
          </Card>

          <Card title="last 7 days">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    <th className="th w-40">habit</th>
                    {last7.map((d) => (
                      <th key={d.key} className="th text-center">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {habits.map((h) => (
                    <tr key={h.slug}>
                      <td className="td text-ink">{h.emoji ?? '·'} {h.name}</td>
                      {last7.map((d) => {
                        const log = logs.find((l) => l.date === d.key)
                        const v = log?.values?.[h.slug]
                        return (
                          <td key={d.key} className="td text-center">
                            <button
                              onClick={() => selectDate(d.key)}
                              className="h-6 w-6 border"
                              style={
                                v === true
                                  ? { background: h.color ?? '#4ade80', borderColor: 'transparent' }
                                  : { borderColor: '#26262c' }
                              }
                              title={`${d.key} — ${v === undefined ? 'not logged' : v ? 'done' : 'missed'}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-faint">click a cell to open that day. empty = not logged.</p>
          </Card>
        </div>

        <HabitEditor habits={habits} onChanged={async () => { await load(); notify('habits updated') }} notify={notify} />
      </div>
    </div>
  )
}

function HabitEditor({
  habits,
  onChanged,
  notify,
}: {
  habits: HabitRow[]
  onChanged: () => Promise<void>
  notify: (m: string, ok?: boolean) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, HabitRow>>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const saveHabit = async (slug: string) => {
    const d = drafts[slug]
    if (!d || !d.name.trim()) return
    try {
      await api('/api/admin/tracker', {
        method: 'POST',
        body: { action: 'saveHabit', slug, name: d.name, emoji: d.emoji, color: d.color, description: d.description },
      })
      await onChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  const removeHabit = async (slug: string) => {
    if (!confirm(`delete habit "${slug}"?`)) return
    try {
      await api('/api/admin/tracker', { method: 'POST', body: { action: 'deleteHabit', slug } })
      await onChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const addHabit = async () => {
    if (!name.trim()) return
    try {
      await api('/api/admin/tracker', {
        method: 'POST',
        body: { action: 'saveHabit', name: name.trim() },
      })
      setName('')
      setAdding(false)
      await onChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'add failed', false)
    }
  }

  return (
    <Card title="habits">
      <div className="space-y-3">
        {habits.map((h) => {
          const d = drafts[h.slug] ?? h
          return (
            <div key={h.slug} className="border border-line bg-bg p-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={d.color ?? '#4ade80'}
                  className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                  onChange={(e) => setDrafts((x) => ({ ...x, [h.slug]: { ...d, color: e.target.value } }))}
                />
                <input
                  value={d.emoji ?? ''}
                  onChange={(e) => setDrafts((x) => ({ ...x, [h.slug]: { ...d, emoji: e.target.value } }))}
                  className={`${inputCls} w-14`}
                  placeholder="🙂"
                />
                <input
                  value={d.name}
                  onChange={(e) => setDrafts((x) => ({ ...x, [h.slug]: { ...d, name: e.target.value } }))}
                  className={inputCls}
                />
              </div>
              <input
                value={d.description ?? ''}
                onChange={(e) => setDrafts((x) => ({ ...x, [h.slug]: { ...d, description: e.target.value } }))}
                className={`${inputCls} mt-2`}
                placeholder="description"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => saveHabit(h.slug)}>save</Button>
                <Button size="sm" variant="danger" onClick={() => removeHabit(h.slug)}>delete</Button>
              </div>
            </div>
          )
        })}

        {adding ? (
          <div className="border border-dashed border-line2 p-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              className={inputCls}
              placeholder="new habit name"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="primary" onClick={addHabit}>add</Button>
              <Button size="sm" onClick={() => { setAdding(false); setName('') }}>cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>+ add habit</Button>
        )}
      </div>
    </Card>
  )
}
