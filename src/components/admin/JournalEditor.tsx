import { useEffect, useRef } from 'react'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord-dark.css'
import './editor.css'
import { fileToDataUrl, uploadDataUrl } from './api'

export function JournalEditor({
  initialContent,
  onChange,
}: {
  initialContent: string
  onChange: (md: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let crepe: Crepe | null = null
    let cancelled = false
    const root = rootRef.current!
    ;(async () => {
      crepe = new Crepe({
        root,
        defaultValue: initialContent || '',
        featureConfigs: {
          [CrepeFeature.ImageBlock]: {
            onUpload: async (file: File) => {
              const dataUrl = await fileToDataUrl(file)
              return uploadDataUrl(dataUrl, file.name)
            },
            inlineOnUpload: async (file: File) => {
              const dataUrl = await fileToDataUrl(file)
              return uploadDataUrl(dataUrl, file.name)
            },
            blockOnUpload: async (file: File) => {
              const dataUrl = await fileToDataUrl(file)
              return uploadDataUrl(dataUrl, file.name)
            },
          },
        },
      })
      crepe.on((listener) => {
        listener.updated(() => {
          if (!cancelled && crepe) onChangeRef.current(crepe.getMarkdown())
        })
      })
      await crepe.create()
      if (cancelled) {
        crepe.destroy()
        return
      }
      const pm = root.querySelector<HTMLElement>('.ProseMirror')
      if (pm) pm.setAttribute('aria-label', 'journal reflection editor')
      crepeRef.current = crepe
    })()
    return () => {
      cancelled = true
      crepeRef.current?.destroy()
      crepeRef.current = null
    }
  }, [initialContent])

  return <div ref={rootRef} className="milkdown-1ed" />
}
