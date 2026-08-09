import type { HabitDef } from './tabs/DayWorkspace'

interface HabitRowProps {
  habitDefs: HabitDef[]
  habits: Record<string, boolean>
  onToggle: (slug: string) => void
  onAdjust: (slug: string, delta: number) => void
  onOpenLibrary: () => void
}

export function HabitRow(props: HabitRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.habitDefs.length === 0 && (
        <p className="text-[12px] text-faint">habits are defined in zen · library.</p>
      )}
      {props.habitDefs.map((h) => {
        const done = props.habits[h.slug] === true
        const stored = props.habits[h.slug]
        const count = typeof stored === 'number' ? stored : null
        const target = typeof h.target === 'number' && h.target > 0 ? h.target : null
        return (
          <button
            key={h.slug}
            onClick={() => props.onToggle(h.slug)}
            aria-pressed={done}
            className={`flex h-7 items-center gap-1.5 border px-2 text-[12px] transition-colors ${done ? 'border-transparent text-bg' : 'border-line2 bg-raise text-dim hover:border-accent'}`}
            style={done ? { background: h.color } : undefined}
          >
            <span className="text-[11px]">{h.emoji ?? '·'}</span>
            <span>{h.name}</span>
            {count !== null && (
              <span className="tabular-nums text-[11px] opacity-80">{target ? `${count}/${target}` : String(count)}</span>
            )}
            {count !== null && target && (
              <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label={`decrease ${h.name}`} className="flex h-5 w-5 items-center justify-center border border-line2 text-[11px] hover:border-accent" onClick={() => props.onAdjust(h.slug, -1)}>−</button>
                <button type="button" aria-label={`increase ${h.name}`} className="flex h-5 w-5 items-center justify-center border border-line2 text-[11px] hover:border-accent" onClick={() => props.onAdjust(h.slug, 1)}>+</button>
              </span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={props.onOpenLibrary}
        className="flex h-7 items-center border border-line2 px-2 text-[12px] text-accent transition-colors hover:border-accent"
      >
        library ▸
      </button>
    </div>
  )
}
