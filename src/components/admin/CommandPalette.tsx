import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Command } from 'cmdk'
import { fetchRebuildState, todayStr } from './api'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onGo: (tab: string) => void
  onOpenDayPicker: () => void
  onToday: () => void
  onPrevDay: () => void
  onNextDay: () => void
  onWrite: (kind: 'thought' | 'quote' | 'trade') => void
  onAddModel: () => void
  onBuildDay: () => void
  onImport: () => void
  onAIDraft: () => void
  onRebuild: () => void
  onJump: (section: string | null) => void
}

const GHOST_KEY = '1edge.ghostText'

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="border border-line2 bg-bg px-1.5 py-0.5 text-2xs text-accent">{children}</kbd>
}

/** Terminal-styled ⌘K command palette (mono, dark, hairline, 2px radius). */
export function CommandPalette(props: CommandPaletteProps) {
  const [pending, setPending] = useState(0)
  const [ghost, setGhost] = useState(false)

  // footer draft-count read from the rebuild state on open
  useEffect(() => {
    if (!props.open) return
    fetchRebuildState()
      .then((s) => setPending(s.pending?.length ?? 0))
      .catch(() => {})
  }, [props.open])

  // ghost-text toggle — localStorage only (the actual ghost UI lands in a later task)
  useEffect(() => {
    try {
      setGhost(localStorage.getItem(GHOST_KEY) === '1')
    } catch {
      setGhost(false)
    }
  }, [])

  const toggleGhost = () => {
    setGhost((v) => {
      const next = !v
      try {
        localStorage.setItem(GHOST_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  const run = (fn: () => void) => () => {
    fn()
    props.onOpenChange(false)
  }

  const close = () => props.onOpenChange(false)

  if (!props.open) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="command palette" className="fixed inset-0 z-[60] flex items-start justify-center bg-bg/80 p-4 pt-[12vh]" onClick={close}>
      <Command
        shouldFilter
        className="panel w-full max-w-lg overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
        }}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <span className="text-xs text-faint">›</span>
          <Command.Input
            placeholder="type a command…"
            className="h-11 w-full border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          <Kbd>esc</Kbd>
        </div>

        <Command.List className="max-h-[50vh] overflow-y-auto px-1 py-1">
          <Command.Empty className="px-3 py-6 text-center text-xs text-faint">no command found</Command.Empty>

          <Command.Group
            heading="go"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-3xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-faint"
          >
            <Command.Item value="go-today" onSelect={run(props.onToday)} className={itemCls}>
              <span>today</span>
              <Kbd>t</Kbd>
            </Command.Item>
            <Command.Item value="go-open-day" onSelect={run(props.onOpenDayPicker)} className={itemCls}>
              <span>open day…</span>
              <span className="text-3xs text-faint">date picker sheet</span>
            </Command.Item>
            <Command.Item value="go-prev" onSelect={run(props.onPrevDay)} className={itemCls}>
              <span>previous day</span>
              <Kbd>⌘←</Kbd>
            </Command.Item>
            <Command.Item value="go-next" onSelect={run(props.onNextDay)} className={itemCls}>
              <span>next day</span>
              <Kbd>⌘→</Kbd>
            </Command.Item>
            <Command.Item value="go-stream" onSelect={run(() => window.open('/stream', '_blank'))} className={itemCls}>
              <span>live stream</span>
            </Command.Item>
            <Command.Item value="go-preview" onSelect={run(() => window.open(`/zen/preview/${todayStr()}`, '_blank'))} className={itemCls}>
              <span>preview today</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="write"
            className={groupCls}
          >
            <Command.Item value="write-thought" onSelect={run(() => props.onWrite('thought'))} className={itemCls}>
              <span>new thought</span>
            </Command.Item>
            <Command.Item value="write-quote" onSelect={run(() => props.onWrite('quote'))} className={itemCls}>
              <span>new quote</span>
            </Command.Item>
            <Command.Item value="write-trade" onSelect={run(() => props.onWrite('trade'))} className={itemCls}>
              <span>new trade</span>
            </Command.Item>
            <Command.Item value="write-model" onSelect={run(props.onAddModel)} className={itemCls}>
              <span>add model</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="build"
            className={groupCls}
          >
            <Command.Item value="build-day" onSelect={run(props.onBuildDay)} className={itemCls}>
              <span>build this day</span>
            </Command.Item>
            <Command.Item value="build-import" onSelect={run(props.onImport)} className={itemCls}>
              <span>import trades</span>
            </Command.Item>
            <Command.Item value="build-draft" onSelect={run(props.onAIDraft)} className={itemCls}>
              <span>AI draft reflection</span>
            </Command.Item>
            <Command.Item value="build-rebuild" onSelect={run(props.onRebuild)} className={itemCls}>
              <span>rebuild to publish</span>
              <Kbd>⌘⇧S</Kbd>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="jump"
            className={groupCls}
          >
            <Command.Item value="jump-checkin" onSelect={run(() => props.onJump('sec-capture'))} className={itemCls}>
              <span>check-in</span>
            </Command.Item>
            <Command.Item value="jump-writezone" onSelect={run(() => props.onJump('sec-write'))} className={itemCls}>
              <span>WriteZone</span>
            </Command.Item>
            <Command.Item value="jump-habits" onSelect={run(() => props.onJump(null))} className={itemCls}>
              <span>habits</span>
              <span className="text-3xs text-faint">day surface top</span>
            </Command.Item>
            <Command.Item value="jump-trades" onSelect={run(() => props.onJump('sec-trades'))} className={itemCls}>
              <span>trades</span>
            </Command.Item>
            <Command.Item value="jump-reflection" onSelect={run(() => props.onJump('sec-reflection'))} className={itemCls}>
              <span>reflection</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="zen"
            className={groupCls}
          >
            {(['overview', 'day', 'accounts', 'coach', 'media', 'library', 'reviews'] as const).map((t) => (
              <Command.Item key={t} value={`zen-${t}`} onSelect={run(() => props.onGo(t))} className={itemCls}>
                <span>{t}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            heading="view"
            className={groupCls}
          >
            <Command.Item value="view-ghost" onSelect={run(toggleGhost)} className={itemCls}>
              <span>ghost text</span>
              <span className={ghost ? 'text-up' : 'text-faint'}>{ghost ? 'on' : 'off'}</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="shortcuts"
            className={groupCls}
          >
            {[
              { keys: '1 … 7', desc: 'switch tabs' },
              { keys: '⌘S / Ctrl+S', desc: 'save the day' },
              { keys: '⌘⇧S / Ctrl+Shift+S', desc: 'save & rebuild' },
              { keys: '⌘← / ⌘→', desc: 'previous / next day' },
              { keys: '⌘K / /', desc: 'this palette' },
              { keys: 't', desc: 'jump to today' },
              { keys: 'esc', desc: 'close overlays' },
            ].map((s) => (
              <Command.Item key={s.keys} value={`shortcut-${s.keys}`} onSelect={close} className={itemCls}>
                <Kbd>{s.keys}</Kbd>
                <span className="text-dim">{s.desc}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        <div className="border-t border-line px-3 py-1.5 text-2xs text-faint tabular-nums">
          {todayStr()} · {pending} draft change{pending === 1 ? '' : 's'} · esc to close
        </div>
      </Command>
    </div>
  )
}

const itemCls =
  'flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm text-ink transition-colors data-[selected=true]:bg-raise data-[selected=true]:text-accent'
const groupCls =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-3xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-faint'
