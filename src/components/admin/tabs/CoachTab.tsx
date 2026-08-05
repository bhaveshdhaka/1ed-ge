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

export function CoachTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<{ sessions: Session[] }>('/api/admin/coach')
      setSessions(res.sessions)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
    setLoading(false)
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    setInput('')
    try {
      await api<{ reply: string }>('/api/admin/coach', { method: 'POST', body: { text } })
      notifyChanged()
      await load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'coach failed', false)
    }
    setBusy(false)
  }

  const all = sessions.flatMap((s) => s.messages)

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ coach</h1>
        <span className="text-[12px] text-dim">
          f-R-iend · sees your live trends + remembers prior advice
        </span>
      </div>

      <Card title="conversation" className="flex-1 overflow-hidden">
        <div className="h-full space-y-4 overflow-y-auto p-4">
          {all.length === 0 && !busy && (
            <p className="text-[13px] text-faint">
              nothing yet. ask f-R-iend anything — or let it read the day and tell you what the
              data says. everything here is public on /coach.
            </p>
          )}
          {all.map((m, i) => (
            <div key={i} className={`max-w-[85%] ${m.role === 'me' ? 'ml-auto' : ''}`}>
              <div className={`mb-1 text-[10px] uppercase tracking-widest ${m.role === 'me' ? 'text-right text-dim' : 'text-faint'}`}>
                {m.when} · {m.role}
              </div>
              <div
                className={`whitespace-pre-wrap border px-3 py-2 text-[13px] leading-relaxed ${
                  m.role === 'me' ? 'border-accent/40 bg-accent/10 text-ink' : 'border-line bg-bg text-soft'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && <div className="text-[13px] text-warn">coach is thinking…</div>}
          <div ref={bottomRef} />
        </div>
      </Card>

      <div className="flex gap-2">
        <TextArea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="say something — the coach will read the current trends and answer…"
          className="flex-1"
        />
        <Button variant="primary" onClick={send} disabled={busy || !input.trim()} className="self-end">
          {busy ? '…' : 'send'}
        </Button>
      </div>
    </div>
  )
}
