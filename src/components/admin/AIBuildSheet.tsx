import { Button, Card, TextArea } from './ui'
import { ImageDropZone } from './ImageDropZone'
import type { DayImage } from './tabs/DayWorkspace'

interface AIBuildSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  dayText: string
  dayImages: DayImage[]
  dayBusy: boolean
  canBuild: boolean
  onDayTextChange: (v: string) => void
  onBuildDay: () => void
  onAddDayImages: (files: File[]) => void
  onRemoveDayImage: (id: string) => void
  notify: (m: string, ok?: boolean) => void
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
          <h2 className="text-xs uppercase tracking-widest text-soft">{title}</h2>
          <button onClick={onClose} aria-label="close" className="flex h-8 w-8 items-center justify-center border border-line2 text-sm text-dim hover:border-accent hover:text-ink">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

/** Z1 capture ritual in a sheet — paste everything, AI builds the day. */
export function AIBuildSheet(props: AIBuildSheetProps) {
  if (!props.open) return null
  return (
    <SheetFrame title="build this day" onClose={() => props.onOpenChange(false)}>
      <Card title="capture — paste everything, AI builds the day">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextArea
            rows={3}
            placeholder="free text: what happened, how you felt, the trades… or just paste screenshots."
            value={props.dayText}
            onChange={(e) => props.onDayTextChange(e.target.value)}
          />
          <div className="flex items-end">
            <Button
              onClick={() => {
                props.onBuildDay()
                props.onOpenChange(false)
              }}
              disabled={props.dayBusy || !props.canBuild}
            >
              {props.dayBusy ? 'reading everything…' : 'build this day →'}
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <ImageDropZone onFiles={props.onAddDayImages} label="paste screenshots — trade charts, screen-time, notes. the AI sorts them." />
        </div>
        {props.dayImages.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-3 md:grid-cols-6">
            {props.dayImages.map((img) => (
              <div key={img.id} className="relative border border-line bg-bg">
                <img src={img.url || img.dataUrl} alt="" className="h-16 w-full object-cover" />
                <button onClick={() => props.onRemoveDayImage(img.id)} className="absolute right-1 top-1 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg text-2xs text-down hover:border-down">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-2xs text-faint">on result: the sheet closes and structured data lands in the check-in band.</p>
      </Card>
    </SheetFrame>
  )
}
