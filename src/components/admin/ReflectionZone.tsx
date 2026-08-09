import type { KeyboardEvent, FocusEvent } from 'react'
import { Button, Field, TextInput } from './ui'
import { MarkdownEditor } from './MarkdownEditor'
import { ObligationChip } from './ObligationChip'
import { useCeremony } from './CeremonyMode'

export interface ReflectionObligation {
  type: string
  status: 'done' | 'grace' | 'overdue'
  graceUntil?: Date
}

interface ReflectionZoneProps {
  reflection: string
  title: string
  summary: string
  tags: string
  featuredImage: string
  content: string       // published body for comparison
  previewHref: string   // link target for "view →" / preview
  onReflectionChange: (v: string) => void
  onTitleChange: (v: string) => void
  onSummaryChange: (v: string) => void
  onTagsChange: (v: string) => void
  onFeaturedImageChange?: (v: string) => void
  onPublish: () => void
  onAIDraft: () => void
  draftBusy: boolean
  saving: boolean
  /** Obligation state computed from accountability rules */
  obligation: ReflectionObligation | null
  onObligationClick: () => void
}

export function ReflectionZone(props: ReflectionZoneProps) {
  const { setActive } = useCeremony()

  // Z5 ceremony: focusing the editor dims Z1–Z4 (the wrapper div gets opacity-40
  // via the provider state); leaving the whole zone restores them.
  const onZoneFocus = () => setActive(true)
  const onZoneBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setActive(false)
  }

  const onPublishKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      props.onPublish()
    }
  }

  return (
    <div id="sec-reflection" className="scroll-mt-20">
      <div className="panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xs uppercase tracking-widest text-soft">reflection · the end-of-day ritual</h2>
          {props.obligation && (
            <ObligationChip
              dueType={props.obligation.type === 'daily' ? 'daily' : (props.obligation.type as 'week' | 'quarter' | 'h1' | 'year')}
              status={props.obligation.status}
              graceUntil={props.obligation.graceUntil}
              onClick={props.onObligationClick}
            />
          )}
        </div>

        <div onFocus={onZoneFocus} onBlur={onZoneBlur}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="title">
              <TextInput value={props.title} onChange={(e) => props.onTitleChange(e.target.value)} placeholder="AI suggests" />
            </Field>
            <Field label="summary">
              <TextInput value={props.summary} onChange={(e) => props.onSummaryChange(e.target.value)} placeholder="one line" />
            </Field>
            <Field label="tags (comma)">
              <TextInput value={props.tags} onChange={(e) => props.onTagsChange(e.target.value)} placeholder="discipline, revenge" />
            </Field>
          </div>

          <div className="mt-3">
            <MarkdownEditor value={props.reflection} onChange={props.onReflectionChange} label="reflection draft" rows={15} />
          </div>

          {props.featuredImage && props.onFeaturedImageChange && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-widest text-dim">featured</span>
              <img src={props.featuredImage} alt="" className="h-12 w-20 border border-line object-cover" />
              <TextInput value={props.featuredImage} onChange={(e) => props.onFeaturedImageChange!(e.target.value)} className="flex-1" />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px]">
              {props.content.trim() && (
                <>
                  <span className="text-up">● published to /journal</span>
                  {' '}
                  <a href={props.previewHref} target="_blank" rel="noreferrer" className="text-accent transition-colors hover:text-ink">view →</a>
                  {props.content.trim() !== props.reflection.trim() && (
                    <span className="ml-2 text-warn">● draft differs from live · republish to overwrite</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={props.onAIDraft} disabled={props.draftBusy}>
                {props.draftBusy ? 'drafting…' : 'AI draft from today'}
              </Button>
              <Button size="sm" variant="primary" onClick={props.onPublish} onKeyDown={onPublishKey} disabled={props.saving || !props.reflection.trim()}>
                {props.content.trim() ? 'republish reflection' : 'publish reflection'} ⌘⏎
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
