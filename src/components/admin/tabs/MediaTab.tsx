import { useCallback, useEffect, useState } from 'react'
import { api, fileToDataUrl, uploadDataUrl } from '../api'
import { Button, TextInput } from '../ui'
import { ImageDropZone } from '../ImageDropZone'

export function MediaTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [media, setMedia] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<{ media: string[] }>('/api/admin/media')
      setMedia(res.media)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'load failed', false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const onFiles = async (files: File[]) => {
    setBusy(true)
    let n = 0
    for (const f of files) {
      try {
        await uploadDataUrl(await fileToDataUrl(f), f.name)
        n++
      } catch (e) {
        notify(e instanceof Error ? e.message : 'upload failed', false)
      }
    }
    setBusy(false)
    if (n) {
      notify(`${n} image${n > 1 ? 's' : ''} uploaded`)
      load()
    }
  }

  const remove = async (rel: string) => {
    if (!confirm('delete this image?')) return
    try {
      await api('/api/admin/media', { method: 'DELETE', body: { path: rel } })
      load()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'delete failed', false)
    }
  }

  const copy = async (rel: string) => {
    try {
      await navigator.clipboard.writeText(`/media/${rel}`)
      setCopied(rel)
      setTimeout(() => setCopied((c) => (c === rel ? null : c)), 2000)
    } catch {
      notify(`/media/${rel}`, true)
    }
  }

  const group = (rel: string) => {
    const seg = rel.split('/')
    return seg.length > 1 ? seg[0] : 'other'
  }

  const q = query.trim().toLowerCase()
  const filtered = q ? media.filter((rel) => rel.toLowerCase().includes(q)) : media

  const groups = new Map<string, string[]>()
  for (const rel of filtered) {
    const g = group(rel)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(rel)
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ media</h1>
        <span className="text-[12px] text-dim">{filtered.length}/{media.length} files</span>
      </div>

      <ImageDropZone onFiles={onFiles} label={busy ? 'uploading…' : 'click, drag, or paste images'} />

      <div className="flex gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search by filename…"
          className="max-w-sm"
        />
        {q && <Button size="sm" onClick={() => setQuery('')}>clear</Button>}
      </div>

      {sortedGroups.length === 0 && (
        <p className="py-10 text-center text-[12px] text-faint">{q ? 'no matches' : 'no media yet'}</p>
      )}

      {sortedGroups.map(([g, rels]) => (
        <div key={g}>
          <div className="mb-2 border-b border-line pb-1 text-[11px] uppercase tracking-widest text-dim">
            {g} <span className="text-faint">({rels.length})</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {rels.map((rel) => (
              <div key={rel} className="panel group overflow-hidden">
                <a href={`/media/${rel}`} target="_blank" className="block">
                  <img src={`/media/${rel}`} alt={rel} loading="lazy" className="h-36 w-full border-b border-line object-cover" />
                </a>
                <div className="space-y-1 p-2">
                  <div className="truncate text-[10px] text-dim" title={rel}>{rel.split('/').pop()}</div>
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1" onClick={() => copy(rel)}>
                      {copied === rel ? '✓ copied' : 'copy'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(rel)} aria-label={`delete ${rel.split('/').pop()}`}>×</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
