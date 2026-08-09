import { Fragment } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useHktNow } from '../../lib/clock'
import { fmtDayW } from '../../lib/dates'
import type { DayListItem } from './tabs/DayWorkspace'

export interface DayRailProps {
  days: DayListItem[]           // from loadDays (newest first)
  selectedDate: string          // current date
  onSelectDate: (d: string) => void
  allDatesIso: string[]         // all dates with content (contract; obligation wiring lands in Task 7)
  /** Set of ISO dates that have a pending/overdue reflection obligation */
  pendingObligationDates?: Set<string>
}

/** 8–16px cell height by trade count (8px base + up to 8 trades). */
const cellHeight = (trades: number) => 8 + Math.min(Math.max(trades, 0), 8)

export function DayRail({ days, selectedDate, onSelectDate, pendingObligationDates }: DayRailProps) {
  const now = useHktNow()
  // HKT wall clock (UTC+8, no DST): today's ISO date + minutes into the HKT day.
  const hkt = new Date(now.getTime() + 8 * 3600_000)
  const today = hkt.toISOString().slice(0, 10)
  const hktMin = ((now.getUTCHours() + 8) % 24) * 60 + now.getUTCMinutes()
  const dayFrac = hktMin / 1440

  const selIdx = days.findIndex((d) => d.date === selectedDate)
  const todayIdx = days.findIndex((d) => d.date === today)
  // When today isn't logged, the now-line sits at the future/past boundary
  // (days is newest-first, so every date > today renders above the past group).
  const pastStart = days.findIndex((d) => d.date < today)
  const markerAt = todayIdx === -1 ? (pastStart === -1 ? 0 : pastStart) : -1

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' && selIdx > 0) {
      e.preventDefault()
      onSelectDate(days[selIdx - 1].date)
    } else if (e.key === 'ArrowDown' && selIdx >= 0 && selIdx < days.length - 1) {
      e.preventDefault()
      onSelectDate(days[selIdx + 1].date)
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="navigation"
      aria-label="day rail — ↑ newer · ↓ older"
      className="flex min-w-0 max-h-[80vh] flex-col self-start outline-none focus-visible:ring-1 focus-visible:ring-accent max-[700px]:max-h-none max-[700px]:w-full"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5 max-[700px]:flex-row max-[700px]:items-stretch max-[700px]:gap-1 max-[700px]:overflow-x-auto max-[700px]:overflow-y-visible max-[700px]:pr-1">
        {days.length === 0 && <p className="text-[10px] leading-tight text-faint">no days yet</p>}
        {days.map((d, i) => {
          const R = d.R
          const isFuture = d.date > today
          const isToday = d.date === today
          const isSel = !isFuture && d.date === selectedDate
          const h = cellHeight(d.trades)
          const title = `${fmtDayW(d.date)} · ${R != null ? `${R >= 0 ? '+' : ''}${R.toFixed(2)}R` : 'R —'} · ${d.trades} trade${d.trades === 1 ? '' : 's'}`
          const fill = isFuture
            ? 'border-line/40 bg-bg'
            : R != null
              ? R >= 0
                ? 'border-transparent bg-up/40'
                : 'border-transparent bg-down/40'
              : d.trades > 0
                ? 'border-transparent bg-raise'
                : 'border-line bg-bg'
          const ring = isToday
            ? 'shadow-[inset_0_0_0_1px_var(--color-accent)]'
            : isSel
              ? 'shadow-[inset_0_0_0_1px_var(--color-line2)]'
              : ''
          return (
            <Fragment key={d.file}>
              {i === markerAt && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none h-px w-full shrink-0 self-stretch bg-accent max-[700px]:h-auto max-[700px]:w-px"
                />
              )}
              <button
                type="button"
                onClick={() => onSelectDate(d.date)}
                disabled={isFuture}
                title={title}
                aria-label={title}
                aria-current={isToday ? 'date' : undefined}
                className={`relative h-[var(--cell-h)] w-full shrink-0 cursor-pointer border transition-colors disabled:cursor-default max-[700px]:h-8 max-[700px]:w-[var(--cell-h)] ${fill} ${ring} ${isFuture ? 'opacity-25' : ''}`}
                style={{ '--cell-h': `${h}px` } as CSSProperties}
              >
                {isToday && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 h-px bg-accent"
                    style={{ top: `${(dayFrac * 100).toFixed(2)}%` }}
                  />
                )}
                {pendingObligationDates?.has(d.date) && (
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-accent" />
                )}
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
