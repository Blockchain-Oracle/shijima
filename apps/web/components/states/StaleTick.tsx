import { ago, webCopy } from '@desk/shared'
import { TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StaleTickProps {
  asOfMs: number
  className?: string
}

/** The previous value stays at full ink; this says how old it is. From Agari's `StaleTick`. */
export function StaleTick({ asOfMs, className }: StaleTickProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1 whitespace-nowrap text-warning type-caption', className)}
    >
      <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
      {webCopy.states.stale(ago(new Date(asOfMs)))}
    </span>
  )
}
