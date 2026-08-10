import type { ReactNode } from 'react'

export function SheetFrame({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <style>{`@keyframes sheet-in { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: none } }`}</style>
      <div className="fixed inset-0 bg-bg/80" style={{ animation: 'sheet-in 60ms ease-out' }} onClick={onClose} />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-[420px] max-w-[92vw] overflow-y-auto border-l border-line bg-panel"
        style={{ animation: 'sheet-in 60ms ease-out' }}
      >
        <div className="card-hd border-b border-line">
          <span className="card-lbl">{title}</span>
          <button type="button" onClick={onClose} className="ml-auto text-dim hover:text-ink">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  )
}
