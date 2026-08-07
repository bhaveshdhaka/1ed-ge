import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/utils'

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex w-full items-center justify-between gap-2 border border-line bg-bg px-2.5 py-1.5 text-sm text-ink outline-none data-[placeholder]:text-faint focus:border-accent',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown size={14} className="shrink-0 text-dim" aria-hidden />
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        className={cn('z-50 max-h-64 min-w-[8rem] overflow-y-auto border border-line bg-panel p-0.5', className)}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm text-soft outline-none data-[highlighted]:bg-raise data-[highlighted]:text-ink',
        className
      )}
      {...props}
    >
      <span className="ml-auto shrink-0">
        <SelectPrimitive.ItemIndicator>
          <Check size={13} className="text-up" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}
