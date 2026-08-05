import { useCallback, useEffect, useState } from 'react'
import { api, todayStr, notifyChanged, triggerRebuild } from '../api'
import { Card, Button, Field, TextInput, inputCls } from '../ui'
import { JournalEditor } from '../JournalEditor'

interface EntryRow {
  file: string
  slug: string
  data: Record<string, any>
  preview: string
}

export function JournalTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState('')
  const [mood, setMood] = useState('')
  const [featuredImage, setFeaturedImage] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api<{ entries: EntryRow[] }>('/api/admin/journal')
      setEntries(res.entries)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const selectEntry = async (e: EntryRow) => {
    try {
      const res = await api<{ entry: { file: string; data: Record<string, any>; content: string } }>(
        `/api/admin/journal?file=${encodeURIComponent(e.file)}`,
      )
      const d = res.entry.data
      setSelected(e.file)
      setDate(String(d.date ?? todayStr()))
      setDay(String(d.day ?? ''))
      setSummary(String(d.summary ?? ''))
      setTags(Array.isArray(d.tags) ? d.tags.join(', ') : '')
      setMood(String(d.mood ?? ''))
      setFeaturedImage(String(d.featuredImage ?? ''))
      setContent(res.entry.content)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'load failed', false)
    }
  }

  const newEntry = () => {
    setSelected(null)
    setDate(todayStr())
    setDay('')
    setSummary('')
    setTags('')
    setMood('')
    setFeaturedImage('')
    setContent('')
  }

  const save = async (rebuild = false) => {
    if (!date) return notify('date required', false)
    setSaving(true)
    try {
      await api('/api/admin/journal', {
        method: 'POST',
        body: {
          file: selected ?? undefined,
          date,
          day: day.trim() || undefined,
          summary: summary.trim() || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          mood: mood ? parseInt(mood, 10) : undefined,
          featuredImage: featuredImage.trim() || undefined,
          content,
        },
      })
      notifyChanged()
      if (rebuild) triggerRebuild()
      notify(rebuild ? 'journal saved — rebuild started' : 'journal saved — queued for rebuild')
      await load()
      if (!selected) newEntry()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'save failed', false)
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!selected) return
    if (!confirm('delete this journal entry?')) return
    try {
      await api('/api/admin/journal', { method: 'DELETE', body: { file: selected } })
      notify('entry deleted — queued for rebuild')
      notifyChanged()
      await load()
      newEntry()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const ai = async (kind: string) => {
    if (!content.trim()) return notify('write something first', false)
    setAiBusy(kind)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'assist', kind, text: content },
      })
      if (kind === 'polish') {
        setContent(res.result)
      } else if (kind === 'title') {
        setDay(res.result.replace(/^"|"$/g, ''))
      } else if (kind === 'summary') {
        setSummary(res.result)
      }
      notify(`${kind} ready — review and save`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ai failed', false)
    }
    setAiBusy('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ journal</h1>
        <div className="flex gap-2">
          {selected && <Button variant="danger" size="sm" onClick={remove}>delete</Button>}
          <Button size="sm" onClick={newEntry}>new entry</Button>
          <Button size="sm" onClick={() => save(false)} disabled={saving}>{saving ? 'saving…' : 'save'}</Button>
          <Button variant="primary" size="sm" onClick={() => save(true)} disabled={saving}>save &amp; rebuild</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="panel max-h-[70vh] overflow-y-auto">
          <div className="border-b border-line px-3 py-2 text-[11px] uppercase tracking-widest text-dim">
            {entries.length} entries
          </div>
          {entries.map((e) => (
            <button
              key={e.file}
              onClick={() => selectEntry(e)}
              className={`block w-full border-b border-line/60 px-3 py-2.5 text-left transition-colors hover:bg-raise ${
                selected === e.file ? 'bg-raise' : ''
              }`}
            >
              <div className="text-[12px] text-ink">{String(e.data.day ?? e.data.date ?? e.slug)}</div>
              <div className="mt-0.5 text-[11px] text-dim">{String(e.data.date ?? '')}</div>
              {e.preview && <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-faint">{e.preview}</div>}
            </button>
          ))}
          {entries.length === 0 && <div className="px-3 py-6 text-[12px] text-faint">no entries yet</div>}
        </div>

        <div className="space-y-6">
          <Card title={selected ? `edit ${selected.replace(/\.mdx?$/, '')}` : 'new entry'}>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="date">
                  <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="title">
                  <TextInput value={day} onChange={(e) => setDay(e.target.value)} placeholder="day 12 — the green day" />
                </Field>
                <Field label="mood 1-5">
                  <TextInput value={mood} onChange={(e) => setMood(e.target.value)} placeholder="3" />
                </Field>
              </div>
              <Field label="summary">
                <TextInput value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="one line for the archive page" />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="tags (comma separated)">
                  <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="discipline, revenge, mnq" />
                </Field>
                <Field label="featured image (optional)">
                  <TextInput value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="/media/2026-08-05/xxx.webp" />
                </Field>
              </div>

              <Field label="body">
                <JournalEditor
                  key={selected ?? 'new-' + date}
                  initialContent={content}
                  onChange={setContent}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2 border border-line bg-bg px-3 py-2">
                <span className="text-[11px] uppercase tracking-widest text-dim">ai assist</span>
                <Button size="sm" onClick={() => ai('title')} disabled={!!aiBusy}>
                  {aiBusy === 'title' ? '…' : 'title'}
                </Button>
                <Button size="sm" onClick={() => ai('summary')} disabled={!!aiBusy}>
                  {aiBusy === 'summary' ? '…' : 'summary'}
                </Button>
                <Button size="sm" variant="primary" onClick={() => ai('polish')} disabled={!!aiBusy}>
                  {aiBusy === 'polish' ? '…' : 'polish'}
                </Button>
                <span className="ml-auto text-[12px] text-faint">{content.length} chars</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
