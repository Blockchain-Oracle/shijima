import { webCopy } from '@desk/shared'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type LoadingShape = 'line' | 'row' | 'plate' | 'chart'

const SHAPES: Record<LoadingShape, () => ReactNode> = {
  line: () => <Skeleton className="h-4 w-2/3" />,
  row: () => (
    <div className="flex items-center gap-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  ),
  plate: () => <Skeleton className="h-24 w-full rounded-lg" />,
  chart: () => <Skeleton className="h-48 w-full rounded-lg" />,
}

interface LoadingStateProps {
  shape?: LoadingShape
  label?: string
  className?: string
}

/** Skeleton only where nothing was ever known: never an invented number. From Agari, without the ticket shape. */
export function LoadingState({
  shape = 'line',
  label = webCopy.states.loading,
  className,
}: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn('flex flex-col gap-2', className)}>
      {SHAPES[shape]()}
    </div>
  )
}
