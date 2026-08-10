import { useRef } from 'react'

export function ImageDropZone({
  onFiles,
  label,
  className = '',
  accept = 'image/*',
  helperText,
  ariaLabel,
}: {
  onFiles: (files: File[]) => void
  label?: string
  className?: string
  accept?: string
  helperText?: string
  ariaLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      data-own-paste
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? label ?? 'upload images'}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-line2 bg-bg px-3 py-5 text-center text-xs text-dim transition-colors hover:border-accent ${className}`}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData?.files ?? [])
        if (files.length) onFiles(files)
      }}
      onDrop={(e) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer?.files ?? [])
        if (files.length) onFiles(files)
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        aria-label={ariaLabel ?? label ?? 'upload images'}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      <span>{label ?? 'click, drag, or paste screenshots here'}</span>
      <span className="text-2xs text-faint">{helperText ?? 'images are compressed to webp automatically'}</span>
    </div>
  )
}
