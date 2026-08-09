import { useState } from 'react'

export interface ModelInfo {
  slug: string
  name: string
  premise?: string
}

interface ModelChipRowProps {
  /** current attached model slugs */
  models: string[]
  /** library list of trading models */
  allModels: ModelInfo[]
  onAdd: (slug: string) => void
  onRemove: (slug: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
  /** cap visible chips (collapsed mode shows 2 + a "+N" overflow badge) */
  limit?: number
  /** hide the "+ add model" popover (collapsed mode) */
  showAdd?: boolean
}

export function ModelChipRow({
  models,
  allModels,
  onAdd,
  onRemove,
  limit = Infinity,
  showAdd = true,
}: ModelChipRowProps) {
  const [open, setOpen] = useState(false)
  const visible = models.slice(0, limit)
  const overflow = models.length - visible.length
  const unattached = allModels.filter((m) => !models.includes(m.slug))
  const nameOf = (slug: string) => allModels.find((m) => m.slug === slug)?.name ?? slug

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((slug, i) => (
        <span
          key={slug}
          className={`group/chip relative inline-flex items-center gap-1 border px-1.5 py-0.5 text-2xs ${
            i === 0 ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-panel text-dim'
          }`}
        >
          {i === 0 && <span aria-hidden="true" className="text-accent">⌗</span>}
          {nameOf(slug)}
          {/* dnd-kit useSortable reorder lands in a later task — handle is visual only for now */}
          <span
            aria-hidden="true"
            title="drag to reorder (wired later)"
            className="cursor-grab opacity-0 transition-opacity group-hover/chip:opacity-100"
          >
            ⠿
          </span>
          <button
            type="button"
            onClick={() => onRemove(slug)}
            aria-label={`remove ${nameOf(slug)}`}
            className="opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
          >
            ×
          </button>
        </span>
      ))}
      {overflow > 0 && (
        <span className="border border-line bg-panel px-1.5 py-0.5 text-2xs text-faint">+{overflow}</span>
      )}
      {showAdd && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="border border-line2 px-1.5 py-0.5 text-2xs text-dim transition-colors hover:border-accent hover:text-ink"
          >
            + add model ▾
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-56 border border-line bg-panel shadow-lg">
                {unattached.length === 0 ? (
                  <div className="px-2 py-1.5 text-2xs text-faint">all models attached</div>
                ) : (
                  unattached.map((m) => (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => {
                        onAdd(m.slug)
                        setOpen(false)
                      }}
                      className="block w-full border-b border-line/60 px-2 py-1.5 text-left text-2xs text-dim transition-colors hover:bg-raise hover:text-ink last:border-b-0"
                    >
                      <span className="block text-ink">{m.name}</span>
                      {m.premise && <span className="block truncate text-faint">{m.premise}</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
