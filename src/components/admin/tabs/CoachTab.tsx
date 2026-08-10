import { useCallback, useEffect, useRef, useState } from 'react'
import { api, notifyChanged } from '../api'
import { Card, Button, TextArea } from '../ui'

interface Msg {
  when: string
  role: 'me' | 'coach'
  text: string
}
interface Session {
  file: string
  date: string
  messages: Msg[]
}

const PROMPTS = [
  'read the trends and give me the honest picture',
  'call me out — what am I fooling myself about?',
  'what should I work on tomorrow?',
  'what have I done well recently?',
  'is my screen time hurting my results?',
]

export function CoachTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<{ sessions: Session[] }>('/api/admin/coach')
      setSessions(res.sessions)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
  }, [notify])

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await api<{ snapshot: string }>('/api/admin/coach?snapshot=1')
      setSnapshot(res.snapshot)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    loadSnapshot()
  }, [load, loadSnapshot])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, busy])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    setInput('')
    try {
      await api<{ reply: string }>('/api/admin/coach', { method: 'POST', body: { text: t } })
      notifyChanged()
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'coach failed', false)
    }
    setBusy(false)
  }

  const all = sessions.flatMap((s) => s.messages)

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ coach</h1>
        <span className="text-xs text-dim">
          f-R-iend · sees your live trends + remembers prior advice
        </span>
      </div>

      <Card title="conversation" className="flex-1 overflow-hidden">
        <div className="h-full space-y-4 overflow-y-auto p-4">
          {all.length === 0 && !busy && (
            <p className="text-sm text-faint">
              nothing yet. ask f-R-iend anything — or let it read the day and tell you what the
              data says. everything here is public on /coach.
            </p>
          )}
          {all.map((m, i) => (
            <div key={i} className={`max-w-[85%] ${m.role === 'me' ? 'ml-auto' : ''}`}>
              <div className={`mb-1 text-3xs uppercase tracking-widest ${m.role === 'me' ? 'text-right text-dim' : 'text-faint'}`}>
                {m.when} · {m.role}
              </div>
              <div
                className={`whitespace-pre-wrap border px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'me' ? 'border-accent/40 bg-accent/10 text-ink' : 'border-line bg-bg text-soft'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-warn">coach is thinking…</div>}
          <div ref={bottomRef} />
        </div>
      </Card>

      <details className="border border-line bg-panel">
        <summary className="cursor-pointer px-3 py-2 text-2xs uppercase tracking-widest text-dim">
          the data f-R-iend sees ▾
        </summary>
        {snapshot ? (
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-line/60 px-3 py-2 text-2xs leading-relaxed text-faint">
            {snapshot}
          </pre>
        ) : (
          <p className="border-t border-line/60 px-3 py-2 text-2xs text-faint">loading snapshot…</p>
        )}
      </details>

      <div className="flex flex-wrap gap-1.5">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={busy}
            className="flex h-8 items-center border border-line px-2.5 text-2xs text-dim transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <TextArea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder="say something — the coach will read the current trends and answer…"
          className="flex-1"
        />
        <Button variant="primary" onClick={() => send(input)} disabled={busy || !input.trim()} className="self-end">
          {busy ? '…' : 'send'}
        </Button>
      </div>
    </div>
  )
}
