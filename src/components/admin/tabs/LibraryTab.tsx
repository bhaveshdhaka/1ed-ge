import { useCallback, useEffect, useState } from 'react'
import { api, notifyChanged } from '../api'
import { Card, Button, Field, TextInput, TextArea, Select } from '../ui'

interface LibRow {
  slug: string
  file: string
  [k: string]: unknown
}
interface LibState {
  habits: LibRow[]
  models: LibRow[]
  rules: LibRow[]
  quotes: LibRow[]
}

type Section = 'habits' | 'models' | 'rules' | 'quotes'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'habits', label: 'habits' },
  { id: 'models', label: 'models' },
  { id: 'rules', label: 'rules' },
  { id: 'quotes', label: 'quotes' },
]

export function LibraryTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [data, setData] = useState<LibState>({ habits: [], models: [], rules: [], quotes: [] })
  const [section, setSection] = useState<Section>('habits')
  const [editing, setEditing] = useState<LibRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<LibState>('/api/admin/library')
      setData(res)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'library load failed', false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!editing) return
    const body: Record<string, unknown> = { action: 'save', kind: section }
    if (editing.slug) body.slug = editing.slug
    const d = editing as Record<string, any>
    if (section === 'habits') {
      body.name = d.name ?? ''
      body.emoji = d.emoji ?? ''
      body.color = d.color ?? '#4ade80'
      body.description = d.description ?? ''
      body.kind = d.kind ?? 'bool'
      body.target = d.kind === 'count' ? Number(d.target ?? 0) : undefined
      body.category = d.category ?? 'general'
      body.order = Number(d.order ?? 0)
      body.active = d.active !== false
    } else if (section === 'models') {
      body.name = d.name ?? ''
      body.premise = d.premise ?? ''
      body.rules = String(Array.isArray(d.rules) ? d.rules.join('\n') : (d.rules ?? '')).split('\n').map((r: string) => r.trim()).filter(Boolean)
      body.status = d.status ?? 'active'
      body.order = Number(d.order ?? 0)
    } else if (section === 'rules') {
      body.title = d.title ?? ''
    } else {
      body.text = d.text ?? ''
      body.author = d.author ?? ''
    }
    try {
      await api('/api/admin/library', { method: 'POST', body })
      notify(`saved ${section.slice(0, -1)} — queued for rebuild`)
      notifyChanged()
      setEditing(null)
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
  }

  const remove = async (row: LibRow) => {
    if (!confirm(`delete ${section.slice(0, -1)} "${row.slug}"?`)) return
    try {
      await api('/api/admin/library', { method: 'POST', body: { action: 'delete', kind: section, slug: row.slug } })
      notify('deleted — queued for rebuild')
      notifyChanged()
      setEditing(null)
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const rows = data[section]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ library</h1>
        <div className="flex gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setEditing(null) }}
              aria-pressed={section === s.id}
              className={`h-10 px-3 text-[13px] ${section === s.id ? 'bg-raise text-ink' : 'text-dim hover:text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card
        title={`${section} (${rows.length})`}
        actions={
          <Button size="sm" onClick={() => setEditing({ slug: '', file: '' })}>
            + new {section.slice(0, -1)}
          </Button>
        }
      >
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.file} className="flex items-center gap-3 border border-line bg-bg px-3 py-2">
              <button
                onClick={() => setEditing({ ...row })}
                className="flex flex-1 items-baseline gap-3 text-left"
              >
                <span className="text-[13px] text-ink">
                  {section === 'habits' && row.emoji ? `${row.emoji} ` : ''}
                  {String(row.name ?? row.title ?? row.text ?? row.slug)}
                </span>
                <span className="text-[11px] text-faint">{row.slug}</span>
              </button>
              <Button size="sm" variant="danger" onClick={() => remove(row)}>×</Button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-[12px] text-faint">no {section} yet — add one.</p>}
        </div>
      </Card>

      {editing && (
        <Card title={`edit ${section.slice(0, -1)} — ${editing.slug || 'new'}`}>
          <EditorForm
            section={section}
            value={editing}
            onChange={(patch) => setEditing({ ...editing, ...patch })}
          />
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={save}>save</Button>
            <Button onClick={() => setEditing(null)}>cancel</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function EditorForm({
  section,
  value,
  onChange,
}: {
  section: Section
  value: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}) {
  const d = value as Record<string, any>
  if (section === 'habits') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="name"><TextInput value={d.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} /></Field>
        <Field label="emoji"><TextInput value={d.emoji ?? ''} onChange={(e) => onChange({ emoji: e.target.value })} /></Field>
        <Field label="color"><TextInput value={d.color ?? ''} onChange={(e) => onChange({ color: e.target.value })} placeholder="#4ade80" /></Field>
        <Field label="category">
          <Select value={d.category ?? 'general'} onChange={(e) => onChange({ category: e.target.value })}>
            {['health', 'trading', 'discipline', 'mind', 'environment', 'general'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="kind">
          <Select value={d.kind ?? 'bool'} onChange={(e) => onChange({ kind: e.target.value })}>
            <option value="bool">bool (tick)</option>
            <option value="count">count (number)</option>
          </Select>
        </Field>
        {d.kind === 'count' && (
          <Field label="target"><TextInput type="number" value={d.target ?? ''} onChange={(e) => onChange({ target: e.target.value })} /></Field>
        )}
        <Field label="order"><TextInput type="number" value={d.order ?? 0} onChange={(e) => onChange({ order: e.target.value })} /></Field>
        <Field label="description"><TextInput value={d.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-[13px] text-dim">
          <input type="checkbox" checked={d.active !== false} onChange={(e) => onChange({ active: e.target.checked })} />
          active
        </label>
      </div>
    )
  }
  if (section === 'models') {
    return (
      <div className="grid gap-3">
        <Field label="name"><TextInput value={d.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} /></Field>
        <Field label="premise"><TextInput value={d.premise ?? ''} onChange={(e) => onChange({ premise: e.target.value })} /></Field>
        <Field label="rules (one per line)">
          <TextArea rows={5} value={Array.isArray(d.rules) ? d.rules.join('\n') : (d.rules ?? '')} onChange={(e) => onChange({ rules: e.target.value })} placeholder={'flat by 11:00am ct\none entry per range'} />
        </Field>
        <Field label="status">
          <Select value={d.status ?? 'active'} onChange={(e) => onChange({ status: e.target.value })}>
            {['active', 'paused', 'retired'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="order"><TextInput type="number" value={d.order ?? 0} onChange={(e) => onChange({ order: e.target.value })} /></Field>
      </div>
    )
  }
  if (section === 'rules') {
    return <Field label="rule text"><TextArea rows={3} value={d.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
  }
  return (
    <div className="grid gap-3">
      <Field label="quote text"><TextArea rows={3} value={d.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} /></Field>
      <Field label="author"><TextInput value={d.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} /></Field>
    </div>
  )
}
