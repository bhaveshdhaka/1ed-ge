import type { KeyboardEvent, FocusEvent } from 'react'
import { Button } from './ui'
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
  content: string       // published body for comparison
  onReflectionChange: (v: string) => void
  onPublish: () => void
  onAIDraft: () => void
  draftBusy: boolean
  saving: boolean
  /** Obligation state computed from accountability rules */
  obligation: ReflectionObligation | null
  onObligationClick: () => void
  /** DayWorkspace gates ghost-text to the thoughts + reflection surfaces only. */
  ghostTextEnabled?: boolean
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

        {!props.reflection.trim() && !props.content.trim() && (
          <p className="mb-3 text-[12px] text-faint">no reflection yet — due tonight.</p>
        )}

        <div onFocus={onZoneFocus} onBlur={onZoneBlur}>
          <div className="mt-3">
            <MarkdownEditor
              value={props.reflection}
              onChange={props.onReflectionChange}
              label="reflection draft"
              rows={15}
              ghostTextEnabled={props.ghostTextEnabled}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px]">
              {props.content.trim() ? (
                <span className="text-up">● published to /journal</span>
              ) : (
                <span className="text-faint">draft · not published</span>
              )}
              {props.content.trim() !== props.reflection.trim() && props.content.trim() && (
                <span className="ml-2 text-warn">● draft differs from live · republish to overwrite</span>
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
