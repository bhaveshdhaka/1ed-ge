import { useCallback, useEffect, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { getPasteSink, bus, api, triggerRebuild, fetchRebuildState } from './api'
import { CommandPalette } from './CommandPalette'
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

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>('overview')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const setGlobalDirty = useCallback((b: boolean) => {
    dirtyRef.current = b
    setDirty(b)
  }, [])

  const [pendingReflections, setPendingReflections] = useState<{ date: string; label: string; overdue: boolean }[]>([])
  const [pendingPeriods, setPendingPeriods] = useState<{ type: string; anchor: string }[]>([])
  const [pendingChanges, setPendingChanges] = useState(0)
  const [dayStatus, setDayStatus] = useState<'unsaved' | 'saved' | 'published' | 'none'>('none')
  const [gotoDay, setGotoDay] = useState<string | undefined>(undefined)
  const [gotoReview, setGotoReview] = useState<{ type: string; anchor: string } | undefined>(undefined)

  // load pending reflections, period reviews, and pending changes
  const loadNotifications = useCallback(async () => {
    try {
      const res = await api<{ ok: boolean; pendingDaily: { date: string; label: string; overdue: boolean }[]; pendingPeriods: { type: string; anchor: string; label: string }[] }>('/api/admin/accountability')
      setPendingReflections(res.pendingDaily ?? [])
      setPendingPeriods(res.pendingPeriods ?? [])
    } catch {}
    try {
      const st = await fetchRebuildState()
      setPendingChanges(st.pending?.length ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    loadNotifications()
    const off = bus.on(loadNotifications)
    const id = setInterval(loadNotifications, 60000)
    return () => {
      off()
      clearInterval(id)
    }
  }, [loadNotifications])

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
    if (ok) toast.success(msg)
    else toast.error(msg)
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
        // ⌘S flushes the 2s autosave debounce (silent write); ⌘⇧S saves + rebuilds
        bus.emit(e.shiftKey ? 'save-rebuild' : 'flush-save')
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
      // ⌘K (or / when not typing) toggles the command palette — isTyping guards / first
      if ((mod && e.key === 'k') || (!isTyping(e) && e.key === '/')) {
        e.preventDefault()
        setPaletteOpen((p) => !p)
        return
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
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
    <div className="zen-app min-h-svh bg-bg overflow-x-hidden">
      <header className="border-b border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-3 pb-3 pt-safe-3 md:pb-4 md:pt-safe-4">
          <a href="/" target="_blank" className="flex h-11 items-center text-[22px] font-semibold">
            <span className="brand-word">
              <span className="brand-one">1</span>edge<span className="brand-tk">_</span>
            </span>
            <span className="ml-2 text-2xs font-normal uppercase tracking-widest text-faint">admin</span>
          </a>
          <nav aria-label="admin tabs" className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex h-10 items-center px-3 text-sm transition-colors md:h-11 ${
                  tab === t.id ? 'bg-raise text-ink' : 'text-dim hover:text-ink'
                }`}
              >
                <span className="mr-1 hidden text-3xs text-faint sm:inline">{t.key}</span>
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="command palette"
              className="ml-1 flex h-10 w-10 items-center justify-center border border-line2 text-sm text-dim transition-colors hover:border-accent hover:text-ink md:h-11"
            >
              ⌘K
            </button>
            </nav>
        </div>
      </header>

      <main className="shell py-4 pb-safe md:py-8">
        {tab === 'overview' && <OverviewTab notify={notify} go={go} />}
        {tab === 'day' && (
          <DayWorkspace
            onDirtyChange={setGlobalDirty}
            onNavigateLibrary={() => go('library')}
            onDayStatusChange={setDayStatus}
            gotoDay={gotoDay}
            pendingReflections={pendingReflections}
            pendingPeriods={pendingPeriods}
            pendingChanges={pendingChanges}
            onRebuild={async () => {
              try {
                await triggerRebuild()
                notify('rebuild started — the drawer will update when live')
              } catch {
                notify('rebuild failed to start', false)
              }
            }}
            onNavigateToDay={(d) => {
              setGotoDay(d)
              go('day')
            }}
            onNavigateToReview={(type, anchor) => {
              setGotoReview({ type, anchor })
              go('reviews')
            }}
          />
        )}
        {tab === 'accounts' && <AccountsTab notify={notify} />}
        {tab === 'coach' && <CoachTab notify={notify} />}
        {tab === 'media' && <MediaTab notify={notify} />}
        {tab === 'library' && <LibraryTab notify={notify} />}
        {tab === 'reviews' && <ReviewTab notify={notify} gotoReview={gotoReview} />}
      </main>

      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          className: 'bg-bg! border! border-line2! rounded-[2px]! text-sm! font-mono!',
        }}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onGo={(t) => go(t as Tab)}
        onOpenDayPicker={() => {
          go('day')
          // DayWorkspace mounts on the tab switch — fire the sheet-open after
          // React commits so its bus listener is registered.
          setTimeout(() => bus.emit('open-day-picker'), 80)
        }}
        onToday={() => {
          go('day')
          bus.emit('today')
        }}
        onPrevDay={() => {
          go('day')
          bus.emit('prev-day')
        }}
        onNextDay={() => {
          go('day')
          bus.emit('next-day')
        }}
        onWrite={(kind) => {
          go('day')
          setTimeout(() => bus.emit(`compose-${kind}`), 80)
        }}
        onAddModel={() => {
          go('library')
          notify('add a model in the library tab')
        }}
        onBuildDay={() => {
          go('day')
          notify('build this day — paste screenshots in the check-in band')
        }}
        onImport={() => {
          go('day')
          setTimeout(() => bus.emit('open-ingest'), 80)
        }}
        onAIDraft={() => {
          go('day')
          notify('AI draft from today — reflection panel in the WriteZone')
        }}
        onRebuild={async () => {
          try {
            await triggerRebuild()
            notify('rebuild started — the bar will flash when live')
          } catch {
            notify('rebuild failed to start', false)
          }
        }}
        onJump={(section) => {
          go('day')
          if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
        }}
      />
    </div>
  )
}
