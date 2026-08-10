import { useEffect, useRef, useState } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { useGhostText } from './useGhostText'
import { GhostText } from './GhostText'

async function renderMd(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md || '')
  return String(file)
}

export function MarkdownEditor({
  value,
  onChange,
  label = 'markdown',
  rows = 12,
  ghostTextEnabled = false,
}: {
  value: string
  onChange: (md: string) => void
  label?: string
  rows?: number
  /** DayWorkspace gates ghost-text to the reflection + thoughts surfaces only. */
  ghostTextEnabled?: boolean
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [html, setHtml] = useState('')
  const renderSeq = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // write-mode only — the hook re-attaches when the textarea remounts
  const { suggestion, caretPos } = useGhostText(textareaRef, ghostTextEnabled && mode === 'write')

  useEffect(() => {
    const id = ++renderSeq.current
    renderMd(value)
      .then((h) => {
        if (renderSeq.current === id) setHtml(h)
      })
      .catch(() => {})
  }, [value])

  return (
    <div className="border border-line">
      <div className="flex items-center justify-between border-b border-line px-2 py-1">
        <div className="flex gap-1">
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`h-8 px-2.5 text-xs ${mode === m ? 'bg-raise text-ink' : 'text-dim hover:text-ink'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-2xs text-faint">{label}</span>
      </div>
      {mode === 'write' ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            aria-label={label}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="# write in markdown…"
            className="w-full resize-y border-0 bg-bg p-3 font-mono text-sm leading-snug text-ink outline-none placeholder:text-faint"
          />
          <GhostText textareaRef={textareaRef} suggestion={suggestion} caretPos={caretPos} />
        </div>
      ) : (
        <div
          className="max-h-[420px] overflow-y-auto bg-bg p-3 text-sm leading-relaxed text-ink"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
