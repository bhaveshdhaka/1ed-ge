import { useRef } from 'react'

export function ImageDropZone({
  onFiles,
  label,
  className = '',
  accept = 'image/*',
}: {
  onFiles: (files: File[]) => void
  label?: string
  className?: string
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      data-own-paste
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-line2 bg-bg px-3 py-5 text-center text-[12px] text-dim transition-colors hover:border-accent ${className}`}
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
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        aria-label={label ?? 'upload images'}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      <span>{label ?? 'click, drag, or paste screenshots here'}</span>
      <span className="text-[11px] text-faint">images are compressed to webp automatically</span>
    </div>
  )
}
