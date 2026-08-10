import type {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ButtonHTMLAttributes,
} from 'react'
import { cn } from '../../lib/utils'

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
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full border border-line bg-bg px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />
}

export function NumInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" step="any" {...props} className={cn(inputCls, props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, 'resize-y leading-snug', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />
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
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'danger' && 'btn-danger',
        size === 'sm' && 'btn-sm',
        className
      )}
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
    <section className={cn('panel', className)}>
      {(title || actions) && (
        <div className="card-hd">
          {title && <span className="card-lbl">{title}</span>}
          {actions && <div className="ml-auto">{actions}</div>}
        </div>
      )}
      <div className="p-3 md:p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-bg p-4">
      <div className="text-2xs uppercase tracking-widest text-dim">{label}</div>
      <div className="mt-1.5 text-lg text-ink">{value}</div>
    </div>
  )
}
