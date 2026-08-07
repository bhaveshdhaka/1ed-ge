import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../../lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center gap-2 border border-line2 bg-raise px-3 py-1.5 text-sm text-soft transition-colors cursor-pointer select-none hover:border-accent hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: '',
        primary: 'border-up/60 text-up hover:border-up hover:bg-up/10',
        danger: 'border-down/60 text-down hover:border-down hover:bg-down/10',
        ghost: 'border-transparent bg-transparent hover:bg-raise hover:border-line',
        accent: 'border-accent/60 text-accent hover:border-accent hover:bg-accent/10',
      },
      size: {
        sm: 'px-2 py-1 text-xs',
        md: '',
        icon: 'h-8 w-8 justify-center p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
