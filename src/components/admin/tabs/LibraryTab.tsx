import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api, notifyChanged } from '../api'
import { Card, Button, Field, TextInput, TextArea, Select } from '../ui'
import { DEFAULT_HABIT_COLOR } from '../../../lib/constants'
import { useDndSensors } from '../TradeCard'

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
      body.color = d.color ?? DEFAULT_HABIT_COLOR
      body.description = d.description ?? ''
      body.type = d.kind ?? 'bool'
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

  /**
   * dnd-kit drag-reorder: optimistically apply the dragged order, then PATCH
   * only the rows whose `order` actually changed (sequential, action: reorder
   * merges the field into the existing frontmatter).
   */
  const persistReorder = useCallback(
    async (next: LibRow[]) => {
      const prev = new Map(data[section].map((r) => [r.slug, Number(r.order ?? 0)]))
      const changed = next.filter((r) => prev.get(r.slug) !== Number(r.order ?? 0))
      setData((d) => ({ ...d, [section]: next }))
      if (changed.length === 0) return
      try {
        for (const r of changed) {
          await api('/api/admin/library', {
            method: 'POST',
            body: { action: 'reorder', kind: section, slug: r.slug, order: Number(r.order ?? 0) },
          })
        }
        notify(`reordered ${changed.length} ${section.slice(0, -1)}${changed.length > 1 ? 's' : ''} — queued for rebuild`)
        notifyChanged()
        await load()
      } catch (e) {
        notify(e instanceof Error ? e.message : 'reorder failed', false)
        await load() // restore server truth
      }
    },
    [data, section, load, notify],
  )

  // habits + models carry a persisted `order` sort key — display them sorted
  // so drag-reorder is meaningful and survives a reload. rules/quotes have no
  // order field and keep plain filename order.
  const rows = useMemo(() => {
    const r = data[section]
    return section === 'habits' || section === 'models'
      ? [...r].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0) || String(a.file).localeCompare(String(b.file)))
      : r
  }, [data, section])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ library</h1>
        <div className="seg">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setEditing(null) }}
              aria-pressed={section === s.id}
              className={`min-h-[36px] rounded-[9px] px-3.5 text-xs transition-colors ${
                section === s.id ? 'seg-on' : 'text-dim hover:text-ink'
              }`}
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
          {section === 'habits' || section === 'models' ? (
            <SortableLibRows
              rows={rows}
              section={section}
              onEdit={(row) => setEditing({ ...row })}
              onRemove={remove}
              onReorder={persistReorder}
            />
          ) : (
            rows.map((row) => (
              <div key={row.file} className="flex items-center gap-3 border border-line bg-bg px-3 py-2">
                <button
                  onClick={() => setEditing({ ...row })}
                  className="flex flex-1 items-baseline gap-3 text-left"
                >
                  <span className="text-sm text-ink">
                    {String(row.name ?? row.title ?? row.text ?? row.slug)}
                  </span>
                  <span className="text-2xs text-faint">{row.slug}</span>
                </button>
                <Button size="sm" variant="danger" onClick={() => remove(row)}>×</Button>
              </div>
            ))
          )}
          {rows.length === 0 && <p className="text-xs text-faint">no {section} yet — add one.</p>}
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
        <Field label="color"><TextInput value={d.color ?? ''} onChange={(e) => onChange({ color: e.target.value })} placeholder={DEFAULT_HABIT_COLOR} /></Field>
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
        <Field label="description"><TextInput value={d.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-dim">
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
          <TextArea rows={5} value={Array.isArray(d.rules) ? d.rules.join('\n') : (d.rules ?? '')} onChange={(e) => onChange({ rules: e.target.value })} placeholder={'flat by 18:00 hkt\none entry per range'} />
        </Field>
        <Field label="status">
          <Select value={d.status ?? 'active'} onChange={(e) => onChange({ status: e.target.value })}>
            {['active', 'paused', 'retired'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
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

/* ------------------------------------------------------------------ */
/* SortableLibRows — dnd-kit drag-reorder for the library (habits +    */
/* models; the persisted `order` sort key). Same pattern as TradeCard  */
/* / ThoughtsSurface: useSortable rows, ⠿ handle, 60% drag preview.    */
/* rules/quotes have no `order` field — not sortable (TODO: add one).  */
/* ------------------------------------------------------------------ */

interface SortableLibRowsProps {
  rows: LibRow[]
  section: Section
  onEdit: (row: LibRow) => void
  onRemove: (row: LibRow) => void
  onReorder: (next: LibRow[]) => void
}

function SortableLibRows({ rows, section, onEdit, onRemove, onReorder }: SortableLibRowsProps) {
  const sensors = useDndSensors()
  const ids = rows.map((r) => r.file)

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(rows, oldIndex, newIndex).map((r, i) => ({ ...r, order: i })))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {rows.map((row) => (
            <SortableLibRow key={row.file} id={row.file} row={row} section={section} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableLibRow({
  id,
  row,
  section,
  onEdit,
  onRemove,
}: {
  id: string
  row: LibRow
  section: Section
  onEdit: (row: LibRow) => void
  onRemove: (row: LibRow) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined }}
      className="group flex items-center gap-3 border border-line bg-bg px-3 py-2"
    >
      {/* dnd-kit drag handle — always visible (library rows are short and the
          owner drags on iOS where hover doesn't exist); ≥36px, coarse-pointer
          min-height 44px comes from the .zen-app button rule in app.css */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`reorder ${section.slice(0, -1)} ${row.slug}`}
        title="drag to reorder"
        className="flex h-9 w-8 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
      >
        ⠿
      </button>
      <button onClick={() => onEdit(row)} className="flex flex-1 items-baseline gap-3 text-left">
        <span className="text-sm text-ink">
          {section === 'habits' && row.emoji ? `${row.emoji} ` : ''}
          {String(row.name ?? row.title ?? row.text ?? row.slug)}
        </span>
        <span className="text-2xs text-faint">{row.slug}</span>
      </button>
      <Button size="sm" variant="danger" onClick={() => onRemove(row)}>×</Button>
    </div>
  )
}
