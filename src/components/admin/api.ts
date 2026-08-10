type Listener = () => void
const listeners = new Set<Listener>()
const topics = new Map<string, Set<Listener>>()
export const bus = {
  on(topicOrFn: string | Listener, maybeFn?: Listener) {
    if (typeof topicOrFn === 'function') {
      listeners.add(topicOrFn as Listener)
      return () => listeners.delete(topicOrFn as Listener)
    }
    const topic = topicOrFn
    const set = topics.get(topic) ?? new Set<Listener>()
    set.add(maybeFn!)
    topics.set(topic, set)
    return () => set.delete(maybeFn!)
  },
  emit(topic?: string) {
    if (!topic) {
      listeners.forEach((fn) => fn())
      return
    }
    topics.get(topic)?.forEach((fn) => fn())
  },
}

type PasteSink = (files: File[]) => void
let pasteSink: PasteSink | null = null
export function setPasteSink(fn: PasteSink | null) {
  pasteSink = fn
}
export function getPasteSink(): PasteSink | null {
  return pasteSink
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  let data: T | null = null
  try {
    data = (await res.json()) as T
  } catch {}
  const env = data as unknown as { ok?: boolean; error?: string } | null
  if (!res.ok || env?.ok === false) {
    throw new Error(env?.error || `HTTP ${res.status}`)
  }
  return data as T
}

export function todayStr(): string {
  const d = new Date()
  const ctHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false,
      timeZone: 'America/Chicago',
    }).format(d),
  )
  const ctDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)

  if (ctHour < 17) return ctDateStr

  const [y, m, day] = ctDateStr.split('-').map(Number)
  const next = new Date(y, m - 1, day + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

/** Available display timezones (ordered west→east) */
export const DISPLAY_TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'LAX', city: 'Los Angeles' },
  { value: 'America/New_York', label: 'NYC', city: 'New York' },
  { value: 'Europe/London', label: 'LON', city: 'London' },
  { value: 'Asia/Kolkata', label: 'DEL', city: 'Delhi' },
  { value: 'Asia/Hong_Kong', label: 'HKG', city: 'Hong Kong' },
  { value: 'Asia/Tokyo', label: 'TYO', city: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'SYD', city: 'Sydney' },
] as const

/** Get the stored display timezone (defaults to HKG) */
export function getDisplayTimezone(): string {
  if (typeof localStorage === 'undefined') return 'Asia/Hong_Kong'
  return localStorage.getItem('edge-display-tz') || 'Asia/Hong_Kong'
}

/** Set the display timezone */
export function setDisplayTimezone(tz: string): void {
  localStorage.setItem('edge-display-tz', tz)
}

/** Format a time in the display timezone (12-hour) */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '--:--'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: getDisplayTimezone(),
  }).format(d)
}

/** Format a date+time in the display timezone */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: getDisplayTimezone(),
  }).format(d)
}

/** Get timezone abbreviation (e.g., "HKT", "EDT") */
export function tzAbbr(): string {
  const tz = getDisplayTimezone()
  const part = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short', timeZone: tz,
  }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')
  return part?.value || ''
}

/** Convert an HKT time string (HH:MM) on a given date to a formatted local time */
export function formatHktTime(iso: string, hktTime: string): string {
  if (!iso || !hktTime) return hktTime || '--:--'
  const d = new Date(`${iso}T${hktTime}:00+08:00`)
  if (isNaN(d.getTime())) return hktTime
  return formatTime(d)
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export async function uploadDataUrl(dataUrl: string, name: string): Promise<string> {
  const res = await api<{ url: string }>('/api/admin/media', {
    method: 'POST',
    body: { dataUrl, name },
  })
  return res.url
}

export async function notifyChanged() {
  bus.emit()
}

export async function triggerRebuild() {
  await api('/api/admin/rebuild', { method: 'POST' })
  bus.emit()
}

export interface PendingChange {
  at: string
  kind: string
  label: string
  detail?: string
}
export interface RebuildRecord {
  at: string
  ok: boolean
  applied: string[]
  error?: string
}

export interface BuildStatus {
  running: boolean
  ok: boolean | null
  startedAt?: number
  finishedAt?: number
  error?: string
}

export interface BuildState {
  build: BuildStatus | null
  pending: PendingChange[]
  rebuilds: RebuildRecord[]
}

export async function fetchRebuildState() {
  return api<BuildState>('/api/admin/rebuild')
}

/** Poll until a running build finishes. Returns true on success, false on failure. */
export async function waitForBuild(timeoutMs = 120000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const st = await fetchRebuildState()
      if (!st.build?.running) return st.build?.ok === true
    } catch {}
    if (Date.now() > deadline) return false
    await new Promise((r) => setTimeout(r, 2000))
  }
}

/** True when the site reflects all saved content (nothing pending / unbuilt). */
export function isPublished(pending: PendingChange[]): boolean {
  return pending.length === 0
}
