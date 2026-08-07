import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../../lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabsList = TabsPrimitive.List

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center border border-line bg-bg px-2.5 py-1 text-xs text-dim transition-colors outline-none data-[state=active]:border-accent/60 data-[state=active]:bg-accent/10 data-[state=active]:text-accent hover:text-ink',
        className
      )}
      {...props}
    />
  )
}

export const TabsContent = TabsPrimitive.Content
