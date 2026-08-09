import { useState } from 'react'
import { Button, TextInput } from './ui'
import type { DayListItem } from './tabs/DayWorkspace'

interface DayPickerSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  days: DayListItem[]      // newest first (as loaded by /api/admin/days)
  selectedDate: string
  onSelectDate: (d: string) => void
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayIso(): string {
  return dayKey(new Date())
}

/** Right-side Sheet chrome — 420px, panel-raised, 60ms fade/slide. */
function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      <style>{`@keyframes sheet-in { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: none } }`}</style>
      <div className="fixed inset-0 bg-bg/80" style={{ animation: 'sheet-in 60ms ease-out' }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 flex h-full w-[420px] max-w-[92vw] flex-col border-l border-line bg-panel shadow-2xl"
        style={{ animation: 'sheet-in 60ms ease-out' }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[12px] uppercase tracking-widest text-soft">{title}</h2>
          <button onClick={onClose} aria-label="close" className="flex h-8 w-8 items-center justify-center border border-line2 text-[13px] text-dim hover:border-accent hover:text-ink">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

/** 12-week calendar (Mon-first, last 12 weeks ending today) + recent 14 + jump input. */
export function DayPickerSheet(props: DayPickerSheetProps) {
  const [jump, setJump] = useState('')

  if (!props.open) return null

  const daySet = new Set(props.days.map((d) => d.date))
  const todayK = todayIso()
  const dow = (d: Date) => (d.getDay() + 6) % 7
  const calStart = new Date()
  calStart.setDate(calStart.getDate() - 83)
  calStart.setDate(calStart.getDate() - dow(calStart))
  const minKeyDate = new Date()
  minKeyDate.setDate(minKeyDate.getDate() - 83)
  const minKey = dayKey(minKeyDate)

  const calWeeks: { date: string; hasData: boolean; isToday: boolean; blank: boolean; day: number }[][] = []
  {
    let row: { date: string; hasData: boolean; isToday: boolean; blank: boolean; day: number }[] = []
    const cursor = new Date(calStart)
    for (let i = 0; i < 14 * 7; i++) {
      const key = dayKey(cursor)
      const inRange = key >= minKey && key <= todayK
      row.push({
        date: key,
        hasData: daySet.has(key),
        isToday: key === todayK,
        blank: !inRange,
        day: cursor.getDate(),
      })
      if (row.length === 7) {
        calWeeks.push(row)
        row = []
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  const goJump = () => {
    const d = jump.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      props.onSelectDate(d)
      props.onOpenChange(false)
    }
  }

  return (
    <SheetFrame title="open day…" onClose={() => props.onOpenChange(false)}>
      <div className="flex items-center gap-2">
        <TextInput
          type="date"
          aria-label="jump to date"
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          className="h-9 flex-1"
        />
        <Button size="sm" onClick={goJump} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(jump.trim())}>open →</Button>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-faint">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {calWeeks.flat().map((c, i) =>
            c.blank ? (
              <div key={i} className="h-3.5" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  props.onSelectDate(c.date)
                  props.onOpenChange(false)
                }}
                title={c.date}
                className={`flex min-h-3.5! h-3.5 items-center justify-center text-[8px] leading-none ${
                  c.isToday
                    ? 'border border-accent text-accent'
                    : c.date === props.selectedDate
                      ? 'border border-line2 text-ink'
                      : c.hasData
                        ? 'bg-accent/40 text-bg'
                        : 'bg-raise text-faint'
                }`}
              >
                {c.day}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-line/60 pt-3">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">recent</div>
        <div className="space-y-0.5">
          {props.days.slice(0, 14).map((d) => (
            <button
              key={d.file}
              onClick={() => {
                props.onSelectDate(d.date)
                props.onOpenChange(false)
              }}
              className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-raise ${d.date === props.selectedDate ? 'bg-raise text-ink' : 'text-dim'}`}
            >
              <span>{d.date.slice(5)}</span>
              {d.trades > 0 && <span className="text-faint">{d.trades}t</span>}
            </button>
          ))}
          {props.days.length === 0 && <div className="px-3 py-4 text-[12px] text-faint">no days yet</div>}
        </div>
      </div>
    </SheetFrame>
  )
}
