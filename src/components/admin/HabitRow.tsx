import type { HabitDef } from './tabs/DayWorkspace'

interface HabitRowProps {
  habitDefs: HabitDef[]
  habits: Record<string, boolean>
  onToggle: (slug: string) => void
  onAdjust: (slug: string, delta: number) => void
  onNavigateLibrary: () => void
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
            className={`flex h-7 items-center gap-1.5 border px-2 text-[12px] transition-colors ${done ? 'text-ink' : 'border-line2 bg-raise text-dim hover:border-accent'}`}
            style={done ? { borderColor: h.color, background: `color-mix(in srgb, ${h.color} 12%, transparent)` } : undefined}
          >
            <span className="text-[11px]">{h.emoji ?? '·'}</span>
            <span>{h.name}</span>
            {count !== null && (
              <span className="tabular-nums text-[11px] opacity-80">{target ? `${count}/${target}` : String(count)}</span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={props.onNavigateLibrary}
        className="flex h-7 items-center border border-line2 px-2 text-[12px] text-accent transition-colors hover:border-accent"
      >
        library ▸
      </button>
    </div>
  )
}
