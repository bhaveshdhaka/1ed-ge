import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cn } from '../../../lib/utils'

export const ToastProvider = ToastPrimitive.Provider
export const ToastViewport = ToastPrimitive.Viewport

export function Toast({
  ok = true,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { ok?: boolean }) {
  return (
    <ToastPrimitive.Root
      className={cn(
        'fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 border bg-panel px-3 py-2 text-sm shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)]',
        ok ? 'border-up/60 text-up' : 'border-down/60 text-down',
        className
      )}
      {...props}
    />
  )
}
