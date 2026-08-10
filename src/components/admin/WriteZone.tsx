import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Field, TextInput, NumInput, Select } from './ui'
import { ModelChipRow } from './ModelChipRow'
import { GhostText } from './GhostText'
import { useGhostText } from './useGhostText'
import { bus } from './api'
import type { ThoughtForm, TradeForm, AccRow } from './tabs/DayWorkspace'

export interface ReflectionObligation {
  type: string
  status: 'done' | 'grace' | 'overdue'
  graceUntil?: Date
}

const TYPES = ['thought', 'quote', 'trade', 'reflection'] as const
type ComposerType = (typeof TYPES)[number]

interface WriteZoneProps {
  stream: ThoughtForm[]
  trades: TradeForm[]
  models: { slug: string; name: string }[]
  accounts: AccRow[]
  reflection: string
  content: string // published reflection body
  previewHref: string
  onPublishThought: (type: string, text: string, author?: string) => void
  onPublishTrade: (trade: Partial<TradeForm>) => void
  onPublishReflection: () => void
  onReflectionChange: (v: string) => void
  onAIDraft: () => void
  draftBusy: boolean
  saving: boolean
  obligation: ReflectionObligation | null
  ghostTextEnabled?: boolean
  onUnstream: (i: number) => void
}

function tradeR(t: TradeForm | Partial<TradeForm>) {
  const entry = typeof t.entry === 'string' ? parseFloat(t.entry) : Number(t.entry)
  const exit = typeof t.exit === 'string' ? parseFloat(t.exit) : Number(t.exit)
  const stop = typeof t.stop === 'string' ? parseFloat(t.stop) : Number(t.stop)
  const points = typeof t.points === 'string' ? parseFloat(t.points) : Number(t.points)
  const riskPoints =
    typeof t.riskPoints === 'string' ? parseFloat(t.riskPoints) : Number(t.riskPoints)
  const risk =
    Number.isFinite(riskPoints) && riskPoints > 0
      ? riskPoints
      : Number.isFinite(entry) && Number.isFinite(stop) && stop > 0
        ? Math.abs(entry - stop)
        : NaN
  const pts = Number.isFinite(points)
    ? points
    : Number.isFinite(entry) && Number.isFinite(exit)
      ? t.direction === 'short'
        ? entry - exit
        : exit - entry
      : NaN
  if (!Number.isFinite(risk) || !Number.isFinite(pts) || risk <= 0) return null
  return { R: pts / risk, pts }
}

function emptyTrade(): Partial<TradeForm> {
  return {
    market: 'MNQ',
    direction: 'long',
    session: '',
    setup: '',
    entry: '',
    stop: '',
    target: '',
    exit: '',
    riskPoints: '',
    points: '',
    confidence: '',
    note: '',
    model: '',
    commentary: '',
    models: [],
    screenshots: [],
    executions: [],
  }
}

export function WriteZone(props: WriteZoneProps) {
  const [type, setType] = useState<ComposerType>('thought')
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [trade, setTrade] = useState<Partial<TradeForm>>(emptyTrade)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const { suggestion, caretPos } = useGhostText(composerRef, props.ghostTextEnabled ?? false)

  // ⌘K "new thought/quote/trade" switches the composer type + focuses it
  useEffect(() => {
    const offs = (['thought', 'quote', 'trade'] as const).map((t) =>
      bus.on(`compose-${t}`, () => {
        setType(t)
        setTimeout(() => composerRef.current?.focus(), 50)
      }),
    )
    return () => offs.forEach((off) => off())
  }, [])

  const resetComposer = () => {
    setText('')
    setAuthor('')
    setTrade(emptyTrade())
  }

  const publishCurrent = () => {
    if (type === 'reflection') {
      props.onPublishReflection()
      return
    }
    if (type === 'trade') {
      if (!trade.market?.trim()) return
      props.onPublishTrade(trade)
      resetComposer()
      return
    }
    const trimmed = text.trim()
    if (!trimmed) return
    props.onPublishThought(type === 'quote' ? 'quote' : 'note', trimmed, type === 'quote' ? author.trim() : undefined)
    resetComposer()
  }

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      publishCurrent()
    }
  }

  const setTradeField = (patch: Partial<TradeForm>) => setTrade((t) => ({ ...t, ...patch }))
  const tradeModels = trade.models ?? (trade.model ? [trade.model] : [])

  const setExec = (ei: number, patch: Partial<{ account: string; size: string }>) => {
    const executions = trade.executions ?? []
    setTrade({
      ...trade,
      executions: executions.map((e, j) => (j === ei ? { ...e, ...patch } : e)),
    })
  }

  const placeholder: Record<ComposerType, string> = {
    thought: 'what happened — ⌘⏎ publishes',
    quote: 'the quote — ⌘⏎ publishes',
    trade: 'commentary on this trade (optional) — ⌘⏎ publishes',
    reflection: '',
  }

  return (
    <div id="sec-write" className="panel scroll-mt-20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="seg flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`h-8 px-3 text-2xs transition-colors ${
                type === t ? 'seg-on' : 'text-dim hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-2xs text-faint">
          <span className="tabular-nums">{props.stream.length} published</span>
        </div>
      </div>

      {type === 'reflection' ? (
        <div className="space-y-3">
          <div className="card-hd justify-between">
            <span className="card-lbl">reflection — the end-of-day ritual</span>
            {props.obligation && props.obligation.status !== 'done' && (
              <span
                className={
                  props.obligation.status === 'overdue' ? 'text-down' : 'text-warn'
                }
              >
                {props.obligation.status === 'overdue' ? 'reflection overdue' : 'reflection due tonight'}
              </span>
            )}
          </div>
          <textarea
            aria-label="reflection draft"
            rows={15}
            value={props.reflection}
            onChange={(e) => props.onReflectionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (props.reflection.trim() && !props.saving) props.onPublishReflection()
              }
            }}
            placeholder="write the end-of-day reflection…"
            className="input w-full resize-y leading-snug"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {props.content.trim() ? (
                <span className="text-up">● published to /journal</span>
              ) : (
                <span className="text-faint">draft · not published</span>
              )}
              {props.content.trim() !== props.reflection.trim() && props.content.trim() && (
                <span className="ml-2 text-warn">● draft differs · republish to overwrite</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={props.onAIDraft} disabled={props.draftBusy}>
                {props.draftBusy ? 'drafting…' : 'AI draft from today'}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={props.onPublishReflection}
                disabled={props.saving || !props.reflection.trim()}
              >
                {props.content.trim() ? 'republish reflection' : 'publish reflection'} ⌘⏎
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative border border-line bg-bg">
            <textarea
              ref={composerRef}
              aria-label={`${type} composer`}
              rows={type === 'trade' ? 3 : 2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder={placeholder[type]}
              className="w-full resize-y border-0 bg-bg p-3 font-mono text-sm leading-snug text-ink outline-none placeholder:text-faint"
            />
            <GhostText textareaRef={composerRef} suggestion={suggestion} caretPos={caretPos} />
          </div>

          {type === 'quote' && (
            <Field label="author">
              <TextInput
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="— who said it"
                aria-label="quote author"
              />
            </Field>
          )}

          {type === 'trade' && (
            <div className="space-y-3 border-t border-line pt-3">
              <Field label="commentary (published with the trade)">
                <TextInput
                  value={trade.commentary ?? ''}
                  onChange={(e) => setTradeField({ commentary: e.target.value })}
                  placeholder="what made this one count"
                />
              </Field>

              <div className="grid gap-2 md:grid-cols-6">
                <Field label="entry">
                  <NumInput value={trade.entry} onChange={(e) => setTradeField({ entry: e.target.value })} />
                </Field>
                <Field label="stop">
                  <NumInput value={trade.stop} onChange={(e) => setTradeField({ stop: e.target.value })} />
                </Field>
                <Field label="target">
                  <NumInput value={trade.target} onChange={(e) => setTradeField({ target: e.target.value })} />
                </Field>
                <Field label="exit">
                  <NumInput value={trade.exit} onChange={(e) => setTradeField({ exit: e.target.value })} />
                </Field>
                <Field label="risk pts">
                  <NumInput
                    value={trade.riskPoints}
                    onChange={(e) => setTradeField({ riskPoints: e.target.value })}
                  />
                </Field>
                <Field label="points">
                  <NumInput value={trade.points} onChange={(e) => setTradeField({ points: e.target.value })} />
                </Field>
              </div>

              <div className="grid gap-2 md:grid-cols-5">
                <Field label="market">
                  <TextInput value={trade.market} onChange={(e) => setTradeField({ market: e.target.value })} />
                </Field>
                <Field label="session">
                  <Select value={trade.session} onChange={(e) => setTradeField({ session: e.target.value })}>
                    <option value="">—</option>
                    {['asia', 'london', 'ny-am', 'ny-pm', 'ny'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="direction">
                  <Select
                    value={trade.direction}
                    onChange={(e) => setTradeField({ direction: e.target.value as 'long' | 'short' })}
                  >
                    <option value="long">long</option>
                    <option value="short">short</option>
                  </Select>
                </Field>
                <Field label="setup">
                  <TextInput value={trade.setup} onChange={(e) => setTradeField({ setup: e.target.value })} />
                </Field>
                <Field label="confidence">
                  <NumInput value={trade.confidence} onChange={(e) => setTradeField({ confidence: e.target.value })} />
                </Field>
              </div>

              <div>
                <div className="mb-1 text-2xs uppercase tracking-widest text-dim">models</div>
                <ModelChipRow
                  models={tradeModels}
                  allModels={props.models}
                  onAdd={(slug) => setTradeField({ models: [...tradeModels, slug] })}
                  onRemove={(slug) => setTradeField({ models: tradeModels.filter((m) => m !== slug) })}
                  onReorder={() => {}}
                />
              </div>

              <div>
                <div className="mb-1 text-2xs uppercase tracking-widest text-dim">executions (accounts)</div>
                <div className="space-y-2">
                  {(trade.executions ?? []).map((e, ei) => (
                    <div key={ei} className="flex items-center gap-2">
                      <Select value={e.account} onChange={(ev) => setExec(ei, { account: ev.target.value })} className="flex-1">
                        <option value="">— account —</option>
                        {props.accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firm} {a.sizeLabel}
                          </option>
                        ))}
                      </Select>
                      <TextInput
                        value={e.size}
                        onChange={(ev) => setExec(ei, { size: ev.target.value })}
                        className="w-20"
                        placeholder="1"
                      />
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setTradeField({
                            executions: (trade.executions ?? []).filter((_, k) => k !== ei),
                          })
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={() =>
                      setTradeField({
                        executions: [...(trade.executions ?? []), { account: '', size: '' }],
                      })
                    }
                  >
                    + execution
                  </Button>
                </div>
              </div>

              {trade.entry && trade.exit && (
                <div className="text-xs">
                  {(() => {
                    const r = tradeR(trade)
                    return r ? (
                      <span className={r.R > 0 ? 'text-up' : 'text-down'}>
                        {r.R > 0 ? '+' : ''}
                        {r.R.toFixed(2)}R · {r.pts >= 0 ? '+' : ''}
                        {r.pts}pts
                      </span>
                    ) : (
                      <span className="text-faint">fill entry, exit & stop to see R</span>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {type !== 'thought' && <span className="text-2xs text-faint">⌘⏎</span>}
            <Button size="sm" variant="primary" onClick={publishCurrent}>
              publish {type}
            </Button>
          </div>
        </div>
      )}

      {/* published stream thoughts */}
      {props.stream.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-widest text-up">published thoughts</span>
            {props.previewHref && (
              <a
                href={props.previewHref}
                target="_blank"
                className="text-2xs text-accent transition-colors hover:text-ink"
              >
                view live →
              </a>
            )}
          </div>
          {props.stream.map((m, i) => {
            const isTrade = m.type === 'trade'
            const linkedTrade = isTrade && m.tradeIdx !== '' ? props.trades[parseInt(m.tradeIdx, 10)] : undefined
            const r = linkedTrade ? tradeR(linkedTrade) : null
            return (
              <div
                key={i}
                className="well flex items-start gap-3 px-3 py-2"
              >
                <span className="mt-0.5 text-2xs text-faint">{m.at || '--:--'}</span>
                <span className="mt-0.5 text-2xs uppercase tracking-wider text-dim">{m.type === 'note' ? 'thought' : m.type}</span>
                <div className="min-w-0 flex-1 text-sm text-ink">
                  {isTrade ? (
                    <span>
                      {linkedTrade ? (
                        <>
                          {linkedTrade.direction === 'long' ? '▲' : '▼'} {linkedTrade.market} {linkedTrade.setup || ''} · {linkedTrade.session || '—'}
                          {r && (
                            <span className={`ml-2 ${r.R > 0 ? 'text-up' : 'text-down'}`}>
                              {r.R > 0 ? '+' : ''}
                              {r.R.toFixed(2)}R
                            </span>
                          )}
                        </>
                      ) : (
                        'trade'
                      )}
                    </span>
                  ) : (
                    <span className="truncate">{m.text}</span>
                  )}
                  {m.author ? <span className="text-dim"> — {m.author}</span> : null}
                </div>
                <Button size="sm" variant="danger" onClick={() => props.onUnstream(i)}>
                  ×
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
