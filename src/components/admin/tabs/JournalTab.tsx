import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { api, todayStr, fileToDataUrl, uploadDataUrl, triggerRebuild } from '../api'
import { Card, Button, Field, TextInput, inputCls } from '../ui'

interface EntryRow {
  file: string
  slug: string
  data: Record<string, any>
  preview: string
}

function Editor({
  initialContent,
  onChange,
  notify,
}: {
  initialContent: string
  onChange: (md: string) => void
  notify: (m: string, ok?: boolean) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'write the day…' }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'min-h-[380px] outline-none text-[14px] leading-relaxed' },
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  })

  const ai = async (kind: string) => {
    const md = editor?.storage.markdown.getMarkdown() ?? ''
    if (!md.trim()) return notify('editor is empty', false)
    try {
      const res = await api<{ result: string }>('/api/admin/ai', {
        method: 'POST',
        body: { action: 'assist', kind, text: md },
      })
      if (kind === 'polish') {
        editor?.commands.setContent(res.result)
      } else {
        onChange(res.result)
        notify(`${kind} written — copy it from the field below`)
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : 'ai failed', false)
    }
  }

  const uploadImage = async (files: File[]) => {
    for (const f of files) {
      try {
        const url = await uploadDataUrl(await fileToDataUrl(f), f.name)
        editor?.chain().focus().setImage({ src: url }).run()
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
  }

  const btn = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`border border-line2 px-2 py-1 text-[12px] transition-colors ${
        active ? 'bg-accent/20 text-accent' : 'text-dim hover:text-ink'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border border-b-0 border-line2 bg-panel p-2">
        {btn(editor?.isActive('bold') ?? false, () => editor?.chain().focus().toggleBold().run(), 'B')}
        {btn(editor?.isActive('italic') ?? false, () => editor?.chain().focus().toggleItalic().run(), 'I')}
        {btn(editor?.isActive('strike') ?? false, () => editor?.chain().focus().toggleStrike().run(), 'S')}
        {btn(editor?.isActive('heading', { level: 2 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
        {btn(editor?.isActive('heading', { level: 3 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
        {btn(editor?.isActive('bulletList') ?? false, () => editor?.chain().focus().toggleBulletList().run(), '• list')}
        {btn(editor?.isActive('orderedList') ?? false, () => editor?.chain().focus().toggleOrderedList().run(), '1. list')}
        {btn(editor?.isActive('blockquote') ?? false, () => editor?.chain().focus().toggleBlockquote().run(), 'quote')}
        {btn(editor?.isActive('codeBlock') ?? false, () => editor?.chain().focus().toggleCodeBlock().run(), 'code')}
        {btn(false, () => editor?.chain().focus().setHorizontalRule().run(), 'hr')}
        <button
          type="button"
          onClick={() => {
            const url = prompt('link url')
            if (url) editor?.chain().focus().setLink({ href: url }).run()
          }}
          className="border border-line2 px-2 py-1 text-[12px] text-dim transition-colors hover:text-ink"
        >
          link
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="border border-line2 px-2 py-1 text-[12px] text-dim transition-colors hover:text-ink"
        >
          image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            uploadImage(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <span className="flex-1" />
        <button type="button" onClick={() => ai('title')} className="border border-line2 px-2 py-1 text-[12px] text-dim hover:text-ink">ai title</button>
        <button type="button" onClick={() => ai('summary')} className="border border-line2 px-2 py-1 text-[12px] text-dim hover:text-ink">ai summary</button>
        <button type="button" onClick={() => ai('polish')} className="border border-up/50 px-2 py-1 text-[12px] text-up hover:bg-up/10">ai polish</button>
      </div>
      <div className="border border-line2 bg-bg px-4 py-3" onPaste={(e) => {
        const files = Array.from(e.clipboardData?.files ?? [])
        if (files.length) uploadImage(files)
      }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export function JournalTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ data: Record<string, any>; content: string } | null>(null)
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState('')
  const [mood, setMood] = useState('')
  const [featuredImage, setFeaturedImage] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

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
      setEditing({ data: d, content: res.entry.content })
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
    setEditing(null)
    setDate(todayStr())
    setDay('')
    setSummary('')
    setTags('')
    setMood('')
    setFeaturedImage('')
    setContent('')
  }

  const save = async () => {
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
      notify(selected ? 'journal saved' : 'journal created')
      triggerRebuild()
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
      notify('entry deleted')
      triggerRebuild()
      await load()
      newEntry()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ journal</h1>
        <div className="flex gap-2">
          {selected && <Button variant="danger" size="sm" onClick={remove}>delete</Button>}
          <Button size="sm" onClick={newEntry}>new entry</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? 'saving…' : selected ? 'update entry' : 'publish entry'}
          </Button>
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
                <Editor
                  key={selected ?? 'new'}
                  initialContent={content}
                  onChange={setContent}
                  notify={notify}
                />
              </Field>
              <div className="flex items-center justify-between border border-line bg-bg px-3 py-2 text-[12px] text-faint">
                <span>{content.length} chars</span>
                {selected && <span>{selected}</span>}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
