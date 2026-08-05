let SECRET = ''

export function setSecret(s: string) {
  SECRET = s
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

export async function triggerRebuild() {
  try {
    await api('/api/admin/rebuild', { method: 'POST' })
  } catch {}
}
