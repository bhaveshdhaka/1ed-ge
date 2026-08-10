/**
 * ticker.ts — single shared 1-second interval for all market countdown components.
 * Replaces three separate `setInterval(fn, 1000)` in MarketLive, MarketFooter, MarketWidget.
 * Pauses when the tab is hidden (document.hidden) to save battery on iOS PWA.
 */

const listeners: Set<() => void> = new Set()
let running = false

/** Register a callback to fire every 1s. Returns an unsubscribe function. */
export function onTick(fn: () => void): () => void {
  listeners.add(fn)
  if (!running) {
    running = true
    setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      listeners.forEach((f) => f())
    }, 1000)
  }
  return () => {
    listeners.delete(fn)
  }
}

/* ── Shared helpers (duplicated inline in 3 components before this refactor) ── */

/** Pad a number to 2 digits. */
export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Format seconds into a human countdown string: "2d 3h", "1h 20m", "15m", "04:59". */
export const fmtHuman = (sec: number): string => {
  sec = Math.max(0, Math.round(sec))
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return h > 0 ? d + 'd ' + h + 'h' : d + 'd'
  if (h > 0) return m > 0 ? h + 'h ' + m + 'm' : h + 'h'
  if (m >= 15) return m + 'm'
  return pad2(m) + ':' + pad2(s)
}

/** Find the active segment that contains `now`. */
export const segAt = <T extends { at: number; until: number }>(segs: T[], now: number): T | null => {
  for (const s of segs) if (now >= s.at && now < s.until) return s
  return null
}

/** Find the next upcoming event, preferring red-kind events. */
export const nextAt = <T extends { at: number; kind?: string }>(list: T[], now: number): T | null => {
  const up = list.filter((n) => n.at > now)
  if (!up.length) return null
  const red = up.find((n) => n.kind === 'red')
  return red || up.reduce((a, b) => (b.at < a.at ? b : a))
}

/** Map a segment class to a CSS color value. */
export const color = (cls: string): string =>
  cls === 'up' ? 'var(--color-up)' : cls === 'warn' ? 'var(--color-warn)' : cls === 'down' ? 'var(--color-down)' : 'var(--color-dim)'

/** Map a segment class to a Tailwind text-color class. */
export const clsName = (cls: string): string =>
  cls === 'up' ? 'text-up' : cls === 'warn' ? 'text-warn' : cls === 'down' ? 'text-down' : 'text-dim'

/** Map a segment class to a glyph character. */
export const glyph = (cls: string): string => (cls === 'up' ? '●' : cls === 'warn' ? '◐' : '✕')
