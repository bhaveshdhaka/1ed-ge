import { Button, Card, Field, NumInput, TextArea } from './ui'
import { ImageDropZone } from './ImageDropZone'
import { MarketCard } from './MarketCard'
import { MOODS, SLEEP_QUALITIES } from '../../lib/emoji-states'

export interface DayImage {
  id: string
  dataUrl: string
  url: string
}

interface CheckInBandProps {
  date: string
  // capture (evidence in)
  dayText: string
  dayImages: DayImage[]
  dayBusy: boolean
  canBuild: boolean
  onDayTextChange: (v: string) => void
  onBuildDay: () => void
  onAddDayImages: (files: File[]) => void
  onRemoveDayImage: (id: string) => void
  // check-in facts — direct-click editable
  editing: string | null
  onStartEdit: (k: string) => void
  onDoneEdit: () => void
  mood: string
  sleepHours: string
  sleepQuality: string
  iphoneHours: string
  socialHours: string
  macHours: string
  deviceNotes: string
  onMood: (v: string) => void
  onSleepHours: (v: string) => void
  onSleepQuality: (v: string) => void
  onIphone: (v: string) => void
  onSocial: (v: string) => void
  onMac: (v: string) => void
  onDeviceNotes: (v: string) => void
  screenBusy: boolean
  onPasteScreen: (files: File[]) => void
  deviceScreens: string[]
  onRemoveDeviceScreen: (s: string) => void
  // readouts
  totalR: string
  habitsDone: number
  habitsTotal: number
  onEvidence: () => void
}

const editableHint = 'underline decoration-dashed decoration-line2 underline-offset-4 hover:text-accent hover:decoration-accent cursor-pointer'

export function CheckInBand(props: CheckInBandProps) {
  return (
    <>
      {/* market line above the band (strip.ts segments drive the public widget; MarketCard is the admin surface) */}
      <MarketCard />

      {/* empty state — no evidence, no facts yet */}
      {!props.mood &&
        !props.sleepHours &&
        !props.sleepQuality &&
        !props.iphoneHours &&
        !props.socialHours &&
        !props.macHours &&
        !props.deviceNotes &&
        props.dayImages.length === 0 &&
        !props.dayText.trim() && (
          <p className="text-[12px] text-faint">the day starts here — paste evidence or just write a thought.</p>
        )}

      {/* ---------- CAPTURE ---------- */}
      <div id="sec-capture" className="scroll-mt-20">
        <Card title="capture — paste everything, AI builds the day" actions={<Button size="sm" onClick={props.onEvidence}>evidence ▸</Button>}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <TextArea
              rows={2}
              placeholder="free text: what happened, how you felt, the trades… or just paste screenshots."
              value={props.dayText}
              onChange={(e) => props.onDayTextChange(e.target.value)}
            />
            <div className="flex items-end">
              <Button onClick={props.onBuildDay} disabled={props.dayBusy || !props.canBuild}>
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
                  <button onClick={() => props.onRemoveDayImage(img.id)} className="absolute right-1 top-1 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg text-[11px] text-down hover:border-down">×</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ---------- CHECK-IN FACTS (direct-click edit) ---------- */}
      <div id="sec-day" className="scroll-mt-20">
        <Card title={`day — ${props.date}`}>
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {/* mood */}
            <div className="border-b border-line/60 pb-3">
              <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">mood</div>
              <div className="flex flex-wrap gap-1">
                {MOODS.map((m) => (
                  <button key={m.value} onClick={() => { props.onMood(String(m.value)) }}
                    className={`flex min-h-9 items-center gap-1.5 border px-2 text-[13px] transition-colors ${props.mood === String(m.value) ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-dim hover:border-accent hover:text-ink'}`}>
                    <span aria-hidden="true" className="opacity-60">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* sleep */}
            <div className="border-b border-line/60 pb-3">
              <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">sleep</div>
              <div className="flex flex-wrap items-center gap-2">
                <NumInput value={props.sleepHours} onChange={(e) => props.onSleepHours(e.target.value)} className="h-9 w-24" placeholder="7.5" />
                <div className="flex flex-wrap gap-1">
                  {SLEEP_QUALITIES.map((s) => (
                    <button key={s.value} onClick={() => { props.onSleepQuality(String(s.value)) }}
                      className={`flex min-h-9 items-center gap-1.5 border px-2 text-[13px] transition-colors ${props.sleepQuality === String(s.value) ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-dim hover:border-accent hover:text-ink'}`}>
                      <span aria-hidden="true" className="opacity-60">{s.emoji}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* screen-time — values come from the screenshot */}
            <div className="md:col-span-2 border-b border-line/60 pb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-widest text-dim">screen time</span>
                <div className="flex items-center gap-2">
                  <label className="flex h-8 cursor-pointer items-center text-[11px] text-accent hover:text-ink">
                    {props.screenBusy ? 'reading…' : '＋ paste screenshot'}
                    <input type="file" accept="image/*" multiple className="hidden" aria-label="paste screen time screenshot" onChange={(e) => { props.onPasteScreen(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                  </label>
                  {props.editing === 'screen' && <Button size="sm" onClick={props.onDoneEdit}>done</Button>}
                </div>
              </div>
              {props.editing === 'screen' ? (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="iphone (h)"><NumInput value={props.iphoneHours} onChange={(e) => props.onIphone(e.target.value)} /></Field>
                  <Field label="social (h)"><NumInput value={props.socialHours} onChange={(e) => props.onSocial(e.target.value)} /></Field>
                  <Field label="mac (h)"><NumInput value={props.macHours} onChange={(e) => props.onMac(e.target.value)} /></Field>
                </div>
              ) : (
                <button
                  onClick={() => props.onStartEdit('screen')}
                  className={`text-left text-[13px] text-soft ${editableHint}`}
                  title="click to correct"
                >
                  <span>iphone <span className="text-ink">{props.iphoneHours || '—'}h</span></span>
                  <span className="mx-2 text-faint">·</span>
                  <span>social <span className="text-ink">{props.socialHours || '—'}h</span></span>
                  <span className="mx-2 text-faint">·</span>
                  <span>mac <span className="text-ink">{props.macHours || '—'}h</span></span>
                  {props.deviceNotes && <span className="text-dim"> — {props.deviceNotes}</span>}
                </button>
              )}
              {props.deviceScreens.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-6">
                  {props.deviceScreens.map((s) => (
                    <div key={s} className="relative border border-line bg-bg">
                      <img src={s} alt="" className="h-14 w-full object-cover" />
                      <button onClick={() => props.onRemoveDeviceScreen(s)} className="absolute right-0.5 top-0.5 flex min-h-6! h-6 w-6 items-center justify-center border border-line bg-bg text-[10px] text-down hover:border-down">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
            <span className="text-dim">R <span className={`tabular-nums ${props.totalR.startsWith('+') ? 'text-up' : props.totalR.startsWith('-') ? 'text-down' : 'text-ink'}`}>{props.totalR}</span></span>
            <span className="text-dim">habits <span className="text-ink tabular-nums">{props.habitsDone}/{props.habitsTotal}</span></span>
          </div>
        </Card>
      </div>
    </>
  )
}
