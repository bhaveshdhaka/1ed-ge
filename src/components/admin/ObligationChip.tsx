import { useHktNow } from '../../lib/clock'

interface ObligationChipProps {
  dueType: 'daily' | 'week' | 'quarter' | 'h1' | 'year' | null
  status: 'done' | 'grace' | 'overdue'
  graceUntil?: Date   // 03:00 HKT boundary
  onClick: () => void
}

/** Live countdown "due in 4h 22m" from a 03:00-HKT boundary, ticked by useHktNow every 60s. */
function countdown(until: Date, now: Date): string {
  const diff = Math.max(0, until.getTime() - now.getTime())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `due in ${h}h ${m}m` : `due in ${m}m`
}

export function ObligationChip({ dueType, status, graceUntil, onClick }: ObligationChipProps) {
  const now = useHktNow()
  const base = 'inline-flex cursor-pointer items-center gap-1 border px-1.5 py-0.5 text-2xs transition-colors hover:border-accent'
  if (status === 'done') {
    return (
      <button type="button" onClick={onClick} className={`${base} border-transparent text-up/70`} title="reflection posted">
        · {dueType ?? 'done'}
      </button>
    )
  }
  if (status === 'grace' && graceUntil) {
    return (
      <button type="button" onClick={onClick} className={`${base} border-warn/50 bg-warn/10 text-warn`} title={`${dueType ?? 'reflection'} due at ${graceUntil.toLocaleString()}`}>
        <span aria-hidden="true">◷</span>
        {countdown(graceUntil, now)}
      </button>
    )
  }
  return (
    <button type="button" onClick={onClick} className={`${base} animate-pulse border-down/50 bg-down/10 text-down`} title={`${dueType ?? 'reflection'} overdue`}>
      <span aria-hidden="true">!</span>
      {dueType === 'daily' ? 'reflection overdue' : `${dueType} review overdue`}
    </button>
  )
}
