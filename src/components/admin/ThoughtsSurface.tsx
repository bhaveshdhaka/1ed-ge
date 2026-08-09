import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button, Field, TextInput, Select } from './ui'
import { ImageDropZone } from './ImageDropZone'
import type { MomentForm, TradeForm } from './tabs/DayWorkspace'

interface ThoughtsSurfaceProps {
  draftMoments: MomentForm[]
  stream: MomentForm[]
  trades: TradeForm[]
  onComposerPublish: (type: string, text: string) => void
  onAddDraft: () => void
  onMomentChange: (i: number, patch: Partial<MomentForm>) => void
  onPublishDraft: (i: number) => void
  onPolishDraft: (i: number) => void
  onRemoveDraft: (i: number) => void
  onUnstream: (i: number) => void
  onMomentImages: (i: number, files: File[]) => void
}

const TYPES = ['note', 'quote', 'trade'] as const

export function ThoughtsSurface(props: ThoughtsSurfaceProps) {
  // composer is local ephemeral UI — ⌘⏎ is the ONLY publish gesture (no blur publish)
  const [text, setText] = useState('')
  const [composerType, setComposerType] = useState<'note' | 'quote' | 'trade'>('note')

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!text.trim()) return
      props.onComposerPublish(composerType, text)
      setText('')
    }
  }

  return (
    <div id="sec-moments" className="scroll-mt-20">
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-2xs uppercase tracking-widest text-soft">thoughts · the stream</h2>
          <span className="text-[11px] text-faint tabular-nums">{props.stream.length} live · {props.draftMoments.length} draft</span>
        </div>

        {/* ---------- composer ---------- */}
        <div className="border border-line bg-bg">
          <textarea
            aria-label="thought composer"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onComposerKey}
            placeholder="what happened — ⌘⏎ publishes"
            className="w-full resize-y border-0 bg-bg p-3 font-mono text-sm leading-snug text-ink outline-none placeholder:text-faint"
          />
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
            <span className="text-[10px] text-faint">⌘⏎ publishes</span>
          </div>
        </div>

        {/* ---------- draft moments (not public) ---------- */}
        {props.draftMoments.length > 0 && (
          <div className="mb-4 mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-warn">draft moments — not public</span>
              <Button size="sm" onClick={props.onAddDraft}>+ new moment</Button>
            </div>
            {props.draftMoments.map((m, i) => {
              const tradeShots = props.trades[parseInt(m.tradeIdx, 10)]?.screenshots ?? []
              return (
                <div key={i} className="group border border-line bg-bg p-3">
                  <div className="grid gap-2 md:grid-cols-[64px_130px_1fr]">
                    <Field label="at (HH:MM)"><TextInput value={m.at} onChange={(e) => props.onMomentChange(i, { at: e.target.value })} placeholder="08:30" /></Field>
                    <Field label="type">
                      <Select value={m.type} onChange={(e) => props.onMomentChange(i, { type: e.target.value })}>
                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                    {m.type === 'trade' ? (
                      <Field label="trade">
                        <Select value={m.tradeIdx} onChange={(e) => props.onMomentChange(i, { tradeIdx: e.target.value })}>
                          <option value="">—</option>
                          {props.trades.map((_, ti) => <option key={ti} value={ti}>trade {ti + 1}</option>)}
                        </Select>
                      </Field>
                    ) : (
                      <Field label={m.type === 'quote' ? 'text (the quote)' : 'text'}>
                        <TextInput value={m.text} onChange={(e) => props.onMomentChange(i, { text: e.target.value })} placeholder="what you want to say" />
                      </Field>
                    )}
                  </div>
                  {m.type === 'quote' && (
                    <div className="mt-2">
                      <Field label="author"><TextInput value={m.author} onChange={(e) => props.onMomentChange(i, { author: e.target.value })} /></Field>
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
                      <ImageDropZone onFiles={(fs) => props.onMomentImages(i, fs)} label="attach images →" />
                      {m.images.length > 0 && (
                        <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-6">
                          {m.images.map((s, si) => (
                            <div key={`${si}:${s}`} className="relative border border-line bg-bg">
                              <img src={s} alt="" className="h-14 w-full object-cover" />
                              <button onClick={() => props.onMomentChange(i, { images: m.images.filter((_, j) => j !== si) })} className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg px-1 text-[10px] text-down hover:border-down">×</button>
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
                    {/* dnd-kit sortable lands in a later task — handle is visual only for now */}
                    <span
                      aria-hidden="true"
                      title="drag to reorder (wired later)"
                      className="ml-auto cursor-grab text-faint opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ⠿
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ---------- published moments ---------- */}
        {props.stream.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-up">live moments — public after rebuild</div>
            {props.stream.map((m, i) => (
              <div key={i} className="group flex items-center gap-3 border border-line bg-bg px-3 py-2">
                <span className="text-[11px] text-faint">{m.at || '--:--'}</span>
                <span className="text-[11px] text-dim">{m.type}</span>
                <span className="flex-1 text-[13px] text-ink">
                  {m.type === 'trade'
                    ? m.tradeIdx !== '' ? `trade ${parseInt(m.tradeIdx, 10) + 1} · ${props.trades[parseInt(m.tradeIdx, 10)]?.setup ?? ''}` : 'trade'
                    : m.text}
                  {m.author ? ` — ${m.author}` : ''}
                </span>
                {/* dnd-kit sortable lands in a later task — handle is visual only for now */}
                <span
                  aria-hidden="true"
                  title="drag to reorder (wired later)"
                  className="cursor-grab text-faint opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ⠿
                </span>
                <Button size="sm" variant="danger" onClick={() => props.onUnstream(i)}>×</Button>
              </div>
            ))}
          </div>
        )}
        {props.stream.length === 0 && props.draftMoments.length === 0 && (
          <p className="mt-3 text-[12px] text-faint">nothing on the stream yet — type above and ⌘⏎ to publish.</p>
        )}
      </div>
    </div>
  )
}
