import { useCallback, useEffect, useState } from 'react'
import { setSecret, api } from './api'
import { OverviewTab } from './tabs/OverviewTab'
import { DayLogTab } from './tabs/DayLogTab'
import { JournalTab } from './tabs/JournalTab'
import { AccountsTab } from './tabs/AccountsTab'
import { CoachTab } from './tabs/CoachTab'
import { MediaTab } from './tabs/MediaTab'

export type Tab = 'overview' | 'day' | 'journal' | 'accounts' | 'coach' | 'media'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'overview' },
  { id: 'day', label: 'day log' },
  { id: 'journal', label: 'journal' },
  { id: 'accounts', label: 'accounts' },
  { id: 'coach', label: 'coach' },
  { id: 'media', label: 'media' },
]

export default function AdminApp({ secret }: { secret: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    setSecret(secret)
  }, [secret])

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const go = useCallback((t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-4">
          <a href="/" target="_blank" className="text-[15px] font-semibold text-ink">
            1ed<span className="text-dim">.ge</span>
            <span className="ml-2 text-[11px] font-normal uppercase tracking-widest text-faint">admin</span>
          </a>
          <nav className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`px-3 py-1.5 text-[13px] transition-colors ${
                  tab === t.id ? 'bg-raise text-ink' : 'text-dim hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="shell py-8">
        {tab === 'overview' && <OverviewTab notify={notify} go={go} />}
        {tab === 'day' && <DayLogTab notify={notify} />}
        {tab === 'journal' && <JournalTab notify={notify} />}
        {tab === 'accounts' && <AccountsTab notify={notify} />}
        {tab === 'coach' && <CoachTab notify={notify} />}
        {tab === 'media' && <MediaTab notify={notify} />}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 border border-line2 bg-raise px-4 py-2 text-[13px] shadow-lg">
          <span className={toast.ok ? 'text-up' : 'text-down'}>▍</span>{' '}
          <span className="text-ink">{toast.msg}</span>
        </div>
      )}
    </div>
  )
}
