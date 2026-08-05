let SECRET = ''

export function setSecret(s: string) {
  SECRET = s
}

type Listener = () => void
const listeners = new Set<Listener>()
export const bus = {
  on(fn: Listener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  emit() {
    listeners.forEach((fn) => fn())
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
      'x-admin-secret': SECRET,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {}
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  return data
}

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
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
  try {
    await api('/api/admin/rebuild', { method: 'POST' })
    bus.emit()
  } catch {}
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

export async function fetchRebuildState() {
  return api<{ build: any; pending: PendingChange[]; rebuilds: RebuildRecord[] }>('/api/admin/rebuild')
}
