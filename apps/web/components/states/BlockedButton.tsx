'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BLOCKED_CLASSES =
  'border-hairline bg-surface-2 text-ink-disabled opacity-100 disabled:opacity-100 hover:bg-surface-2'

interface BlockedButtonProps extends Omit<ComponentProps<typeof Button>, 'disabled' | 'children'> {
  /** When set, the control is disabled and this reason IS its label and accessible name. */
  blocked: string | null
  children: ReactNode
}

/** The one blocked control: a dead control never looks tappable, and always says why. From Agari. */
export function BlockedButton({ blocked, className, children, ...props }: BlockedButtonProps) {
  if (blocked) {
    return (
      <Button
        {...props}
        disabled
        aria-disabled="true"
        aria-label={blocked}
        title={blocked}
        variant="secondary"
        className={cn(BLOCKED_CLASSES, className)}
      >
        {blocked}
      </Button>
    )
  }
  return (
    <Button {...props} className={className}>
      {children}
    </Button>
  )
}
