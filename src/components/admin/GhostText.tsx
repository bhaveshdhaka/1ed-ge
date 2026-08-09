import type { CSSProperties, RefObject } from 'react'
import type { GhostCaretPos } from './useGhostText'

interface GhostTextProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  suggestion: string
  caretPos: GhostCaretPos | null
}

/**
 * Faint, non-interactive ghost-text overlay anchored at the caret, styled with
 * the textarea's own font metrics so the accepted text doesn't jump.
 * `Tab` accepts / any other key dismisses — the keystrokes are handled by
 * `useGhostText` on the textarea itself; this layer is purely visual.
 */
export function GhostText({ textareaRef, suggestion, caretPos }: GhostTextProps) {
  if (!suggestion || !caretPos || !textareaRef.current) return null
  const ta = textareaRef.current
  const cs = getComputedStyle(ta)
  const style: CSSProperties = {
    left: caretPos.left,
    top: caretPos.top,
    height: caretPos.height,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute z-10 overflow-hidden text-faint" style={style}>
      <span className="opacity-60">{suggestion}</span>
      <kbd className="ml-1.5 select-none border border-line2 bg-bg px-1 text-[10px] text-faint">tab</kbd>
    </div>
  )
}
