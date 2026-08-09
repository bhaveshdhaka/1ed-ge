import type { KeyboardEvent } from 'react'
import { Button, Field, TextInput, NumInput, Select } from './ui'
import { ImageDropZone } from './ImageDropZone'
import { ModelChipRow, type ModelInfo } from './ModelChipRow'
import type { TradeForm, AccRow } from './tabs/DayWorkspace'

interface TradeCardProps {
  index: number
  trade: TradeForm
  allModels: ModelInfo[]
  accountLabel: (id: string) => string
  accounts: AccRow[]
  onChange: (patch: Partial<TradeForm>) => void
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  onTradeScreens: (files: File[]) => void
  onPublish: () => void
}

/** R = pts / risk (price-based, identical across executions); null when uncomputable. */
function tradeR(t: TradeForm) {
  const risk = t.riskPoints !== '' ? parseFloat(t.riskPoints) : t.stop !== '' && t.entry !== '' ? Math.abs(parseFloat(t.entry) - parseFloat(t.stop)) : NaN
  const pts = t.points !== '' ? parseFloat(t.points) : t.entry !== '' && t.exit !== '' ? (t.direction === 'long' ? parseFloat(t.exit) - parseFloat(t.entry) : parseFloat(t.entry) - parseFloat(t.exit)) : NaN
  if (!Number.isFinite(risk) || !Number.isFinite(pts) || risk <= 0) return null
  return { R: pts / risk, pts }
}

export function TradeCard({
  index,
  trade,
  allModels,
  accountLabel,
  accounts,
  onChange,
  expanded,
  onToggle,
  onRemove,
  onTradeScreens,
  onPublish,
}: TradeCardProps) {
  const r = tradeR(trade)
  const models = trade.models ?? (trade.model ? [trade.model] : [])
  const setModels = (next: string[]) => onChange({ models: next })

  const setExec = (ei: number, patch: Partial<{ account: string; size: string }>) =>
    onChange({ executions: trade.executions.map((e, j) => (j === ei ? { ...e, ...patch } : e)) })

  const onPublishKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onPublish()
    }
  }

  return (
    <div className="group border border-line bg-bg">
      {/* ---------- collapsed row ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex h-9 flex-1 items-baseline gap-3 text-left"
        >
          <span className="text-[12px] text-faint">{expanded ? '▾' : '▸'}</span>
          <span className="text-[14px] text-ink">
            {trade.direction === 'long' ? '▲' : '▼'} {trade.market || 'MNQ'}
          </span>
          <span className="text-[12px] text-dim">{trade.setup || '—'} · {trade.session || '—'}</span>
        </button>

        <ModelChipRow
          models={models}
          allModels={allModels}
          onAdd={() => {}}
          onRemove={(slug) => setModels(models.filter((m) => m !== slug))}
          onReorder={() => {}}
          limit={2}
          showAdd={false}
        />

        <span className={`ml-auto text-[13px] tabular-nums ${r && r.R > 0 ? 'text-up' : r && r.R < 0 ? 'text-down' : 'text-dim'}`}>
          {r ? `${r.R > 0 ? '+' : ''}${r.R.toFixed(2)}R` : '—'}
        </span>
        <span className={`text-[12px] tabular-nums ${r && r.pts >= 0 ? 'text-up' : r ? 'text-down' : 'text-dim'}`}>
          {r ? `${r.pts >= 0 ? '+' : ''}${r.pts}pts` : ''}
        </span>
        {trade.executions.filter((e) => e.account).length > 0 && (
          <span className="text-[11px] text-dim">
            {trade.executions.filter((e) => e.account).map((e) => accountLabel(e.account)).join(' · ')}
          </span>
        )}
        {trade.screenshots[0] && <img src={trade.screenshots[0]} alt="" className="h-8 w-12 border border-line object-cover" />}
        <Button size="sm" variant="danger" onClick={onRemove} aria-label={`delete trade ${index + 1}`}>×</Button>
        {/* dnd-kit sortable lands in a later task — handle is visual only for now */}
        <span
          aria-hidden="true"
          title="drag to reorder (wired later)"
          className="cursor-grab text-faint opacity-0 transition-opacity group-hover:opacity-100"
        >
          ⠿
        </span>
      </div>

      {/* ---------- expanded ---------- */}
      {expanded && (
        <div className="border-t border-line p-3">
          <ModelChipRow
            models={models}
            allModels={allModels}
            onAdd={(slug) => setModels([...models, slug])}
            onRemove={(slug) => setModels(models.filter((m) => m !== slug))}
            onReorder={() => {}}
          />

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <Field label="commentary (published with the trade)">
              <TextInput value={trade.commentary} onChange={(e) => onChange({ commentary: e.target.value })} placeholder="what made this one count" />
            </Field>
            <Field label="note">
              <TextInput value={trade.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="what was the story" />
            </Field>
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-6">
            <Field label="entry"><NumInput value={trade.entry} onChange={(e) => onChange({ entry: e.target.value })} /></Field>
            <Field label="stop"><NumInput value={trade.stop} onChange={(e) => onChange({ stop: e.target.value })} /></Field>
            <Field label="target"><NumInput value={trade.target} onChange={(e) => onChange({ target: e.target.value })} /></Field>
            <Field label="exit"><NumInput value={trade.exit} onChange={(e) => onChange({ exit: e.target.value })} /></Field>
            <Field label="risk pts"><NumInput value={trade.riskPoints} onChange={(e) => onChange({ riskPoints: e.target.value })} /></Field>
            <Field label="points"><NumInput value={trade.points} onChange={(e) => onChange({ points: e.target.value })} /></Field>
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-5">
            <Field label="market"><TextInput value={trade.market} onChange={(e) => onChange({ market: e.target.value })} /></Field>
            <Field label="session">
              <Select value={trade.session} onChange={(e) => onChange({ session: e.target.value })}>
                <option value="">—</option>
                {['asia', 'london', 'ny-am', 'ny-pm', 'ny'].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="direction">
              <Select value={trade.direction} onChange={(e) => onChange({ direction: e.target.value as 'long' | 'short' })}>
                <option value="long">long</option><option value="short">short</option>
              </Select>
            </Field>
            <Field label="setup"><TextInput value={trade.setup} onChange={(e) => onChange({ setup: e.target.value })} /></Field>
            <Field label="confidence"><NumInput value={trade.confidence} onChange={(e) => onChange({ confidence: e.target.value })} /></Field>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">executions (accounts)</div>
            <div className="space-y-2">
              {trade.executions.map((e, ei) => (
                <div key={ei} className="flex items-center gap-2">
                  <Select value={e.account} onChange={(ev) => setExec(ei, { account: ev.target.value })} className="flex-1">
                    <option value="">— account —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.firm} {a.sizeLabel}</option>)}
                  </Select>
                  <TextInput value={e.size} onChange={(ev) => setExec(ei, { size: ev.target.value })} className="w-20" placeholder="1" />
                  <Button size="sm" variant="danger" onClick={() => onChange({ executions: trade.executions.filter((_, k) => k !== ei) })}>×</Button>
                </div>
              ))}
              <Button size="sm" onClick={() => onChange({ executions: [...trade.executions, { account: '', size: '' }] })}>+ execution</Button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <ImageDropZone onFiles={onTradeScreens} label="paste this trade's chart →" className="!py-2" />
            <div className="grid flex-1 grid-cols-4 gap-2">
              {trade.screenshots.map((s) => (
                <div key={s} className="relative border border-line bg-bg">
                  <img src={s} alt="" className="h-14 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onChange({ screenshots: trade.screenshots.filter((y) => y !== s) })}
                    className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg px-1 text-[10px] text-down hover:border-down"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-2">
            <span className="text-[11px] text-faint">⌘⏎</span>
            <Button size="sm" variant="primary" onClick={onPublish} onKeyDown={onPublishKey} title="add this trade to the stream (⌘⏎)">
              publish →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
