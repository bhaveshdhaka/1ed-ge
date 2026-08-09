import { useEffect, useRef, useState, type RefObject } from 'react'

export const GHOST_TEXT_KEY = '1edge.ghostText'

/** ⌘K `view → ghost-text` toggle (Task 9 CommandPalette) — reads the localStorage flag. */
export function ghostTextOn(): boolean {
  try {
    return localStorage.getItem(GHOST_TEXT_KEY) === '1'
  } catch {
    return false
  }
}

export interface GhostCaretPos {
  left: number
  top: number
  height: number
}

/**
 * Caret coordinates in the textarea's offset-parent space — the same space the
 * ghost overlay is positioned in (both parents are the `relative` wrapper).
 * A temporary hidden mirror div copies the textarea's metrics; the caret's
 * content position comes from a span after the text up to `position`.
 * Scroll is subtracted so the overlay tracks the *visible* caret.
 */
function getCaretCoordinates(el: HTMLTextAreaElement, position: number): GhostCaretPos {
  const cs = getComputedStyle(el)
  const div = document.createElement('div')
  div.setAttribute('aria-hidden', 'true')
  const style = div.style
  style.position = 'absolute'
  style.top = '0'
  style.left = '0'
  style.visibility = 'hidden'
  style.whiteSpace = 'pre-wrap'
  style.overflowWrap = 'break-word'
  style.overflow = 'hidden'
  style.width = cs.width
  style.height = cs.height
  style.boxSizing = cs.boxSizing
  style.borderTop = `${cs.borderTopWidth} solid`
  style.borderRight = `${cs.borderRightWidth} solid`
  style.borderBottom = `${cs.borderBottomWidth} solid`
  style.borderLeft = `${cs.borderLeftWidth} solid`
  style.paddingTop = cs.paddingTop
  style.paddingRight = cs.paddingRight
  style.paddingBottom = cs.paddingBottom
  style.paddingLeft = cs.paddingLeft
  style.fontFamily = cs.fontFamily
  style.fontSize = cs.fontSize
  style.fontWeight = cs.fontWeight
  style.fontStyle = cs.fontStyle
  style.lineHeight = cs.lineHeight
  style.letterSpacing = cs.letterSpacing
  style.wordSpacing = cs.wordSpacing
  style.textTransform = cs.textTransform
  style.textAlign = cs.textAlign
  const textNode = document.createTextNode(el.value.slice(0, position))
  const span = document.createElement('span')
  span.textContent = el.value.slice(position) || '.' // a fully empty span doesn't render
  div.appendChild(textNode)
  div.appendChild(span)
  el.parentNode?.insertBefore(div, el)
  const left = span.offsetLeft + parseInt(cs.borderLeftWidth, 10)
  const top = span.offsetTop + parseInt(cs.borderTopWidth, 10)
  div.remove()
  return {
    left: left - el.scrollLeft,
    top: top - el.scrollTop,
    height: parseFloat(cs.lineHeight) || 16,
  }
}

/**
 * Streaming ghost-text writing assist. After 600ms of pause on a prose line
 * (10+ chars, passing `shouldComplete`), POSTs the text up to the caret to
 * /api/admin/complete and streams the suggestion back into `suggestion`.
 * `Tab` accepts the suggestion (writes it into the textarea and syncs the
 * controlled React value via a bubbling `input` event); `Esc` or any other
 * key dismisses it.
 */
export function useGhostText(textareaRef: RefObject<HTMLTextAreaElement | null>, enabled: boolean) {
  const [suggestion, setSuggestion] = useState('')
  const [caretPos, setCaretPos] = useState<GhostCaretPos | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !textareaRef.current) return
    const el = textareaRef.current
    let debounce: ReturnType<typeof setTimeout> | undefined

    const onInput = () => {
      clearTimeout(debounce)
      abortRef.current?.abort()
      setSuggestion('')
      setCaretPos(null)
      const { value, selectionEnd } = el
      const line = value.slice(value.lastIndexOf('\n', selectionEnd - 1) + 1, selectionEnd)
      if (line.length < 10 || !shouldComplete(line)) return

      debounce = setTimeout(async () => {
        const pos = getCaretCoordinates(el, selectionEnd)
        setCaretPos(pos)
        const ctrl = new AbortController()
        abortRef.current = ctrl
        try {
          const res = await fetch('/api/admin/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: value.slice(0, selectionEnd) }),
            signal: ctrl.signal,
          })
          if (!res.ok || !res.body) return
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let result = ''
          for (;;) {
            const { done, value: chunk } = await reader.read()
            if (done) break
            result += decoder.decode(chunk, { stream: true })
            setSuggestion(result)
          }
        } catch {
          /* aborted or network error — silent */
        }
      }, 600)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && suggestion) {
        e.preventDefault()
        el.value = el.value.slice(0, el.selectionEnd) + suggestion + el.value.slice(el.selectionEnd)
        el.selectionEnd = el.selectionStart = el.selectionEnd + suggestion.length
        setSuggestion('')
        setCaretPos(null)
        // keep the controlled React textarea in sync with the DOM value
        el.dispatchEvent(new Event('input', { bubbles: true }))
      } else if (e.key === 'Escape' || (e.key !== 'Tab' && suggestion)) {
        setSuggestion('')
        setCaretPos(null)
        abortRef.current?.abort()
      }
    }

    el.addEventListener('input', onInput)
    el.addEventListener('keydown', onKeyDown)
    return () => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled, suggestion])

  return { suggestion, caretPos }
}

function shouldComplete(line: string): boolean {
  // no code fences, URLs, prices, or big numbers — prose lines only
  return !/```|:\/\/|\d+\.\d+|\b\d{3,}\b/.test(line)
}
