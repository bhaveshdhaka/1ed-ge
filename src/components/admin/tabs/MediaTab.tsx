import { useCallback, useEffect, useState } from 'react'
import { api, fileToDataUrl, uploadDataUrl } from '../api'
import { Card, Button } from '../ui'
import { ImageDropZone } from '../ImageDropZone'

export function MediaTab({ notify }: { notify: (m: string, ok?: boolean) => void }) {
  const [media, setMedia] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

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
      notify('copied /media/' + rel)
    } catch {
      notify(`/media/${rel}`, true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">/ media</h1>
        <span className="text-[12px] text-dim">{media.length} files</span>
      </div>

      <ImageDropZone onFiles={onFiles} label={busy ? 'uploading…' : 'click, drag, or paste images'} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        {media.map((rel) => (
          <div key={rel} className="panel group overflow-hidden">
            <a href={`/media/${rel}`} target="_blank" className="block">
              <img src={`/media/${rel}`} alt={rel} loading="lazy" className="h-36 w-full border-b border-line object-cover" />
            </a>
            <div className="space-y-1 p-2">
              <div className="truncate text-[10px] text-dim">{rel}</div>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1" onClick={() => copy(rel)}>copy</Button>
                <Button size="sm" variant="danger" onClick={() => remove(rel)}>×</Button>
              </div>
            </div>
          </div>
        ))}
        {media.length === 0 && (
          <p className="col-span-full py-10 text-center text-[12px] text-faint">no media yet</p>
        )}
      </div>
    </div>
  )
}
