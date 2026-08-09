import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent, DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Field, TextInput, Select } from './ui'
import { ImageDropZone } from './ImageDropZone'
import { useGhostText } from './useGhostText'
import { GhostText } from './GhostText'
import { useDndSensors } from './TradeCard'
import type { ThoughtForm, TradeForm } from './tabs/DayWorkspace'

interface ThoughtsSurfaceProps {
  draftThoughts: ThoughtForm[]
  stream: ThoughtForm[]
  trades: TradeForm[]
  onComposerPublish: (type: string, text: string, author?: string) => void
  onAddDraft: () => void
  onThoughtChange: (i: number, patch: Partial<ThoughtForm>) => void
  onPublishDraft: (i: number) => void
  onPolishDraft: (i: number) => void
  onRemoveDraft: (i: number) => void
  onUnstream: (i: number) => void
  onThoughtImages: (i: number, files: File[]) => void
  /** dnd-kit reorder for the draft + published lists */
  onReorderDraft: (from: number, to: number) => void
  onReorderStream: (from: number, to: number) => void
  /** DayWorkspace gates ghost-text to the thoughts + reflection surfaces only. */
  ghostTextEnabled?: boolean
}

const TYPES = ['note', 'quote', 'trade'] as const

/** dnd-kit sortable handle — attributes + listeners make it keyboard + touch accessible. */
function DragHandle({
  label,
  attributes,
  listeners,
}: {
  label: string
  attributes: DraggableAttributes
  listeners?: DraggableSyntheticListeners
}) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={label}
      title="drag to reorder"
      className="cursor-grab touch-none text-faint opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
    >
      ⠿
    </button>
  )
}

interface DraftThoughtRowProps {
  id: string
  i: number
  m: ThoughtForm
  trades: TradeForm[]
  onThoughtChange: (i: number, patch: Partial<ThoughtForm>) => void
  onPublishDraft: (i: number) => void
  onPolishDraft: (i: number) => void
  onRemoveDraft: (i: number) => void
  onThoughtImages: (i: number, files: File[]) => void
}

function DraftThoughtRow(props: DraftThoughtRowProps) {
  const { m, i } = props
  const tradeShots = props.trades[parseInt(m.tradeIdx, 10)]?.screenshots ?? []
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined }}
      className="group border border-line bg-bg p-3"
    >
      <div className="grid gap-2 md:grid-cols-[64px_130px_1fr]">
        <Field label="at (HH:MM)"><TextInput value={m.at} onChange={(e) => props.onThoughtChange(i, { at: e.target.value })} placeholder="08:30" /></Field>
        <Field label="type">
          <Select value={m.type} onChange={(e) => props.onThoughtChange(i, { type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        {m.type === 'trade' ? (
          <Field label="trade">
            <Select value={m.tradeIdx} onChange={(e) => props.onThoughtChange(i, { tradeIdx: e.target.value })}>
              <option value="">—</option>
              {props.trades.map((_, ti) => <option key={ti} value={ti}>trade {ti + 1}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label={m.type === 'quote' ? 'text (the quote)' : 'text'}>
            <TextInput value={m.text} onChange={(e) => props.onThoughtChange(i, { text: e.target.value })} placeholder="what you want to say" />
          </Field>
        )}
      </div>
      {m.type === 'quote' && (
        <div className="mt-2">
          <Field label="author"><TextInput value={m.author} onChange={(e) => props.onThoughtChange(i, { author: e.target.value })} /></Field>
        </div>
      )}
      {m.type === 'trade' ? (
        <div className="mt-2">
          <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">charts on this trade</div>
          {tradeShots.length ? (
            <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
              {tradeShots.map((s) => (
                <div key={s} className="border border-line bg-bg">
                  <img src={s} alt="" className="h-14 w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-faint">no charts on this trade yet — attach them in the trades section</p>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <ImageDropZone onFiles={(fs) => props.onThoughtImages(i, fs)} label="attach images →" />
          {m.images.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-6">
              {m.images.map((s, si) => (
                <div key={`${si}:${s}`} className="relative border border-line bg-bg">
                  <img src={s} alt="" className="h-14 w-full object-cover" />
                  <button onClick={() => props.onThoughtChange(i, { images: m.images.filter((_, j) => j !== si) })} className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg px-1 text-[10px] text-down hover:border-down">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => props.onPublishDraft(i)}>publish →</Button>
        {m.text.trim() && (
          <Button size="sm" onClick={() => props.onPolishDraft(i)}>AI polish</Button>
        )}
        <Button size="sm" variant="danger" onClick={() => props.onRemoveDraft(i)}>×</Button>
        <span className="ml-auto">
          <DragHandle label={`reorder draft thought ${i + 1}`} attributes={attributes} listeners={listeners} />
        </span>
      </div>
    </div>
  )
}

interface StreamThoughtRowProps {
  id: string
  i: number
  m: ThoughtForm
  trades: TradeForm[]
  onUnstream: (i: number) => void
}

function StreamThoughtRow(props: StreamThoughtRowProps) {
  const { m, i } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined }}
      className="group flex items-center gap-3 border border-line bg-bg px-3 py-2"
    >
      <span className="text-[11px] text-faint">{m.at || '--:--'}</span>
      <span className="text-[11px] text-dim">{m.type}</span>
      <span className="flex-1 text-[13px] text-ink">
        {m.type === 'trade'
          ? m.tradeIdx !== '' ? `trade ${parseInt(m.tradeIdx, 10) + 1} · ${props.trades[parseInt(m.tradeIdx, 10)]?.setup ?? ''}` : 'trade'
          : m.text}
        {m.author ? ` — ${m.author}` : ''}
      </span>
      <DragHandle label={`reorder stream thought ${i + 1}`} attributes={attributes} listeners={listeners} />
      <Button size="sm" variant="danger" onClick={() => props.onUnstream(i)}>×</Button>
    </div>
  )
}

export function ThoughtsSurface(props: ThoughtsSurfaceProps) {
  // composer is local ephemeral UI — ⌘⏎ is the ONLY publish gesture (no blur publish)
  const [text, setText] = useState('')
  const [composerType, setComposerType] = useState<'note' | 'quote' | 'trade'>('note')
  const [composerAuthor, setComposerAuthor] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const { suggestion, caretPos } = useGhostText(composerRef, props.ghostTextEnabled ?? false)
  const sensors = useDndSensors()

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!text.trim()) return
      props.onComposerPublish(composerType, text, composerType === 'quote' ? composerAuthor.trim() : '')
      setText('')
      setComposerAuthor('')
    }
  }

  // separate DndContexts per list — draft and stream ids are both 0..n (isolated scopes)
  const onDraftDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    props.onReorderDraft(Number(active.id), Number(over.id))
  }
  const onStreamDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    props.onReorderStream(Number(active.id), Number(over.id))
  }

  return (
    <div id="sec-thoughts" className="scroll-mt-20">
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-2xs uppercase tracking-widest text-soft">thoughts · the stream</h2>
          <span className="text-[11px] text-faint tabular-nums">{props.stream.length} live · {props.draftThoughts.length} draft</span>
        </div>

        {/* ---------- composer ---------- */}
        <div className="relative border border-line bg-bg">
          <textarea
            ref={composerRef}
            aria-label="thought composer"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onComposerKey}
            placeholder="what happened — ⌘⏎ publishes"
            className="w-full resize-y border-0 bg-bg p-3 font-mono text-sm leading-snug text-ink outline-none placeholder:text-faint"
          />
          <GhostText textareaRef={composerRef} suggestion={suggestion} caretPos={caretPos} />
          {composerType === 'quote' && (
            <div className="flex items-center gap-2 border-t border-line px-2 py-1">
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-dim">author</span>
              <input
                value={composerAuthor}
                onChange={(e) => setComposerAuthor(e.target.value)}
                placeholder="— who said it"
                aria-label="quote author"
                className="h-6 min-w-0 flex-1 border-0 bg-transparent px-1 font-mono text-[12px] text-ink outline-none placeholder:text-faint"
              />
            </div>
          )}
          <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
            <div className="flex gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setComposerType(t)}
                  aria-pressed={composerType === t}
                  className={`h-7 px-2.5 text-[11px] transition-colors ${composerType === t ? 'bg-raise text-ink' : 'text-dim hover:text-ink'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button size="sm" variant="primary" onClick={() => { if (text.trim()) props.onComposerPublish(composerType, text, composerType === 'quote' ? composerAuthor.trim() : ''); setText(''); setComposerAuthor('') }}>publish</Button>
          </div>
        </div>

        {/* ---------- draft thoughts (not public) ---------- */}
        {props.draftThoughts.length > 0 && (
          <div className="mb-4 mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-warn">draft thoughts — not public</span>
              <Button size="sm" onClick={props.onAddDraft}>+ new thought</Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDraftDragEnd}>
              <SortableContext items={props.draftThoughts.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {props.draftThoughts.map((m, i) => (
                    <DraftThoughtRow
                      key={i}
                      id={String(i)}
                      i={i}
                      m={m}
                      trades={props.trades}
                      onThoughtChange={props.onThoughtChange}
                      onPublishDraft={props.onPublishDraft}
                      onPolishDraft={props.onPolishDraft}
                      onRemoveDraft={props.onRemoveDraft}
                      onThoughtImages={props.onThoughtImages}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* ---------- published thoughts ---------- */}
        {props.stream.length > 0 && (
          <div className="mt-2">
            <div className="mb-2 text-[11px] uppercase tracking-widest text-up">live thoughts — public after rebuild</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStreamDragEnd}>
              <SortableContext items={props.stream.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {props.stream.map((m, i) => (
                    <StreamThoughtRow
                      key={i}
                      id={String(i)}
                      i={i}
                      m={m}
                      trades={props.trades}
                      onUnstream={props.onUnstream}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
        {props.stream.length === 0 && props.draftThoughts.length === 0 && (
          <button
            type="button"
            onClick={() => composerRef.current?.focus()}
            className="mt-3 text-[12px] text-accent transition-colors hover:text-ink"
          >
            write your first thought →
          </button>
        )}
      </div>
    </div>
  )
}
