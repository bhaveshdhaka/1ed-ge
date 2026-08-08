import { useCallback, useEffect, useRef, useState } from 'react'
import { setSecret, getPasteSink, bus, api } from './api'
import { RebuildBar } from './RebuildBar'
import { OverviewTab } from './tabs/OverviewTab'
import { DayWorkspace } from './tabs/DayWorkspace'
import { AccountsTab } from './tabs/AccountsTab'
import { CoachTab } from './tabs/CoachTab'
import { MediaTab } from './tabs/MediaTab'
import { LibraryTab } from './tabs/LibraryTab'
import { ReviewTab } from './tabs/ReviewTab'

export type Tab = 'overview' | 'day' | 'accounts' | 'coach' | 'media' | 'library' | 'reviews'

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: 'overview', label: 'overview', key: '1' },
  { id: 'day', label: 'day', key: '2' },
  { id: 'accounts', label: 'accounts', key: '3' },
  { id: 'coach', label: 'coach', key: '4' },
  { id: 'media', label: 'media', key: '5' },
  { id: 'library', label: 'library', key: '6' },
  { id: 'reviews', label: 'reviews', key: '7' },
]

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '1 … 7', desc: 'switch tabs' },
  { keys: '⌘S / Ctrl+S', desc: 'save the day' },
  { keys: '⌘⇧S / Ctrl+Shift+S', desc: 'save & rebuild' },
  { keys: '⌘← / ⌘→', desc: 'previous / next day' },
  { keys: 't', desc: 'jump to today' },
  { keys: '?', desc: 'this help' },
  { keys: 'esc', desc: 'close overlays' },
]

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  )
}

export default function AdminApp({ secret, zenLine }: { secret: string; zenLine?: string | null }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [help, setHelp] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const setGlobalDirty = useCallback((b: boolean) => {
    dirtyRef.current = b
    setDirty(b)
  }, [])

  useEffect(() => {
    setSecret(secret)
  }, [secret])

  // global clipboard paste: images pasted anywhere route to the active tab's sink
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-own-paste]')) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (!files.length) return
      const sink = getPasteSink()
      if (sink) sink(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // heartbeat: "trader is live" on public / and /stream while the admin is open
  useEffect(() => {
    const beat = () => api('/api/admin/ping', { method: 'POST' }).catch(() => {})
    beat()
    const id = setInterval(beat, 30000)
    return () => clearInterval(id)
  }, [])

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }, [])

  const go = useCallback(
    (t: Tab) => {
      if (t !== 'day' && dirtyRef.current && !confirm('you have unsaved day changes — switch tabs and lose them?')) return
      dirtyRef.current = false
      setDirty(false)
      setTab(t)
      window.scrollTo({ top: 0 })
    },
    [],
  )

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        bus.emit(e.shiftKey ? 'save-rebuild' : 'save')
        return
      }
      if (mod && e.key === 'ArrowLeft') {
        e.preventDefault()
        bus.emit('prev-day')
        return
      }
      if (mod && e.key === 'ArrowRight') {
        e.preventDefault()
        bus.emit('next-day')
        return
      }
      if (e.key === 'Escape') {
        setHelp(false)
        return
      }
      if (e.key === '?') {
        setHelp((h) => !h)
        return
      }
      if (isTyping(e)) return
      if (e.key === 't') {
        bus.emit('today')
        return
      }
      if (e.key === 'g') {
        go('day')
        return
      }
      const idx = TABS.findIndex((t) => t.key === e.key)
      if (idx >= 0) go(TABS[idx].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  return (
    <div className="zen-app min-h-svh bg-bg">
      <header className="border-b border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-3 pb-3 pt-safe-3 md:pb-4 md:pt-safe-4">
          <a href="/" target="_blank" className="flex h-11 items-center text-[22px] font-semibold">
            <span className="brand-word">
              <span className="brand-one">1</span>edge<span className="brand-tk">_</span>
            </span>
            <span className="ml-2 text-[11px] font-normal uppercase tracking-widest text-faint">zen</span>
          </a>
          <nav aria-label="zen tabs" className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex h-10 items-center px-3 text-[13px] transition-colors md:h-11 ${
                  tab === t.id ? 'bg-raise text-ink' : 'text-dim hover:text-ink'
                }`}
              >
                <span className="mr-1 hidden text-[10px] text-faint sm:inline">{t.key}</span>
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setHelp(true)}
              aria-label="keyboard shortcuts"
              className="ml-1 flex h-10 w-10 items-center justify-center border border-line2 text-[13px] text-dim transition-colors hover:border-accent hover:text-ink md:h-11"
            >
              ?
            </button>
          </nav>
        </div>
      </header>

      {zenLine && (
        <div className="border-b border-line bg-raise/60">
          <div className="shell flex items-center gap-2 py-2 text-[12px]">
            <span className="text-warn" aria-hidden="true">◷</span>
            <span className="text-dim">{zenLine}</span>
            <span className="ml-auto text-faint">pending reflections</span>
          </div>
        </div>
      )}

      <RebuildBar />

      <main className="shell py-6 md:py-8">
        {tab === 'overview' && <OverviewTab notify={notify} go={go} />}
        {tab === 'day' && <DayWorkspace notify={notify} onDirtyChange={setGlobalDirty} />}
        {tab === 'accounts' && <AccountsTab notify={notify} />}
        {tab === 'coach' && <CoachTab notify={notify} />}
        {tab === 'media' && <MediaTab notify={notify} />}
        {tab === 'library' && <LibraryTab notify={notify} />}
        {tab === 'reviews' && <ReviewTab notify={notify} />}
      </main>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-safe-5 left-1/2 z-50 -translate-x-1/2 border border-line2 bg-raise px-5 py-3 text-[13px] shadow-2xl">
          <span className={toast.ok ? 'text-up' : 'text-down'}>
            {toast.ok ? '✓' : '✗'}
          </span>{' '}
          <span className="text-ink">{toast.msg}</span>
        </div>
      )}

      {help && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 p-4" onClick={() => setHelp(false)}>
          <div
            className="w-full max-w-md border border-line bg-panel p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[13px] uppercase tracking-widest text-soft">keyboard shortcuts</h2>
              <button onClick={() => setHelp(false)} className="h-10 w-10 border border-line2 text-dim hover:text-ink" aria-label="close">
                ×
              </button>
            </div>
            <div className="space-y-1">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between border-b border-line/60 py-2 text-[13px]">
                  <kbd className="border border-line2 bg-bg px-2 py-0.5 text-[12px] text-accent">{s.keys}</kbd>
                  <span className="text-dim">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
