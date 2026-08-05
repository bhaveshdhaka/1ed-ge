import type {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ButtonHTMLAttributes,
} from 'react'

export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] uppercase tracking-widest text-dim">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full border border-line bg-bg px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function NumInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" step="any" {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} resize-y ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Button({
  children,
  variant = '',
  size = '',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) {
  return (
    <button
      {...rest}
      className={`btn ${variant === 'primary' ? 'btn-primary' : ''} ${variant === 'danger' ? 'btn-danger' : ''} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({
  title,
  children,
  className = '',
  actions,
}: {
  title?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] uppercase tracking-widest text-soft">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-bg p-4">
      <div className="text-[10px] uppercase tracking-widest text-dim">{label}</div>
      <div className="mt-1.5 text-lg text-ink">{value}</div>
    </div>
  )
}
