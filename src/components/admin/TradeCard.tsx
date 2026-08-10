import type { KeyboardEvent } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Field, TextInput, NumInput, Select } from './ui'
import { ImageDropZone } from './ImageDropZone'
import { ModelChipRow, type ModelInfo } from './ModelChipRow'
import type { TradeForm, AccRow } from './tabs/DayWorkspace'

interface TradeCardProps {
  id: string
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
  id,
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
  // dnd-kit sortable — the ⠿ handle drives the reorder (drag preview 60% opacity)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const setExec = (ei: number, patch: Partial<{ account: string; size: string }>) =>
    onChange({ executions: trade.executions.map((e, j) => (j === ei ? { ...e, ...patch } : e)) })

  const onPublishKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onPublish()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined }}
      className="group panel"
    >
      {/* ---------- collapsed row ---------- */}
      <div className="card-hd flex-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="card-ico" aria-hidden="true">{trade.direction === 'long' ? '📈' : '📉'}</span>
          <span className="card-lbl">{trade.market || 'MNQ'}</span>
          <span className="card-sub">{trade.setup || '—'} · {trade.session || '—'}</span>
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

        <span className={`tmr ${r && r.R > 0 ? 'text-up' : r && r.R < 0 ? 'text-down' : ''}`}>
          {r ? `${r.R > 0 ? '+' : ''}${r.R.toFixed(2)}R` : '—'}
        </span>
        <span className={`text-xs tabular-nums ${r && r.pts >= 0 ? 'text-up' : r ? 'text-down' : 'text-dim'}`}>
          {r ? `${r.pts >= 0 ? '+' : ''}${r.pts}pts` : ''}
        </span>
        {trade.executions.filter((e) => e.account).length > 0 && (
          <span className="text-2xs text-dim">
            {trade.executions.filter((e) => e.account).map((e) => accountLabel(e.account)).join(' · ')}
          </span>
        )}
        {trade.screenshots[0] && <img src={trade.screenshots[0]} alt="" className="h-8 w-12 border border-line object-cover" />}
        <Button size="sm" variant="danger" onClick={onRemove} aria-label={`delete trade ${index + 1}`}>×</Button>
        {/* dnd-kit drag handle — attributes + listeners make it keyboard + touch accessible */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`reorder trade ${index + 1}`}
          title="drag to reorder"
          className="cursor-grab touch-none text-faint opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 group-active:opacity-100 active:cursor-grabbing"
        >
          ⠿
        </button>
      </div>

      {/* ---------- expanded ---------- */}
      {expanded && (
        <div className="border-t border-line p-3">
          <div className="well p-3">
            <ModelChipRow
              models={models}
              allModels={allModels}
              onAdd={(slug) => setModels([...models, slug])}
              onRemove={(slug) => setModels(models.filter((m) => m !== slug))}
              onReorder={() => {}}
            />
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <Field label="commentary (published with the trade)">
              <TextInput value={trade.commentary} onChange={(e) => onChange({ commentary: e.target.value })} placeholder="what made this one count" />
            </Field>
            <Field label="note">
              <TextInput value={trade.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="what was the story" />
            </Field>
          </div>

          <div className="well mt-2 p-3">
            <div className="grid gap-2 md:grid-cols-6">
              <Field label="entry"><NumInput value={trade.entry} onChange={(e) => onChange({ entry: e.target.value })} /></Field>
              <Field label="stop"><NumInput value={trade.stop} onChange={(e) => onChange({ stop: e.target.value })} /></Field>
              <Field label="target"><NumInput value={trade.target} onChange={(e) => onChange({ target: e.target.value })} /></Field>
              <Field label="exit"><NumInput value={trade.exit} onChange={(e) => onChange({ exit: e.target.value })} /></Field>
              <Field label="risk pts"><NumInput value={trade.riskPoints} onChange={(e) => onChange({ riskPoints: e.target.value })} /></Field>
              <Field label="points"><NumInput value={trade.points} onChange={(e) => onChange({ points: e.target.value })} /></Field>
            </div>
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
            <div className="mb-1 text-2xs uppercase tracking-widest text-dim">executions (accounts)</div>
            <div className="well space-y-2 p-3">
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
                    className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg px-1 text-3xs text-down hover:border-down"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-2">
            <span className="text-2xs text-faint">⌘⏎</span>
            <Button size="sm" variant="primary" onClick={onPublish} onKeyDown={onPublishKey} title="add this trade to the stream (⌘⏎)">
              publish →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* TradeList — the sortable trades zone (DndContext + SortableContext) */
/* ------------------------------------------------------------------ */

interface TradeListProps {
  trades: TradeForm[]
  allModels: ModelInfo[]
  accountLabel: (id: string) => string
  accounts: AccRow[]
  onChange: (i: number, patch: Partial<TradeForm>) => void
  expandedIndex: number | null
  expandAll: boolean
  onToggle: (ti: number) => void
  onRemove: (ti: number) => void
  onTradeScreens: (ti: number, files: File[]) => void
  onPublish: (ti: number) => void
  onReorder: (from: number, to: number) => void
}

/**
 * Mouse + touch sensors: touch needs a hold-delay so the page can still scroll;
 * mouse needs a small movement threshold so a plain click on the handle doesn't
 * start a drag (per plan Global Constraint — dnd must work on iPhone/iPad).
 */
export function useDndSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )
}

export function TradeList(props: TradeListProps) {
  const sensors = useDndSensors()
  const ids = props.trades.map((_, i) => String(i))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    props.onReorder(Number(active.id), Number(over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {props.trades.map((t, ti) => (
            <TradeCard
              key={ti}
              id={String(ti)}
              index={ti}
              trade={{ ...t, models: t.models ?? (t.model ? [t.model] : []) }}
              allModels={props.allModels}
              accountLabel={props.accountLabel}
              accounts={props.accounts}
              onChange={(patch) => props.onChange(ti, patch)}
              expanded={props.expandAll || props.expandedIndex === ti}
              onToggle={() => props.onToggle(ti)}
              onRemove={() => props.onRemove(ti)}
              onTradeScreens={(fs) => props.onTradeScreens(ti, fs)}
              onPublish={() => props.onPublish(ti)}
            />
          ))}
          {props.trades.length === 0 && (
            <p className="text-xs text-faint">no trades — paste charts or ⌘K &quot;new trade&quot;.</p>
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}
