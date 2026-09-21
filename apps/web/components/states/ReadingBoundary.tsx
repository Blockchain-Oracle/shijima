import type { ReactNode } from 'react'
import { isOk, type Reading } from '@/lib/kit'
import { EmptyState, type NextAction } from './EmptyState'
import { ErrorState } from './ErrorState'
import { type LoadingShape, LoadingState } from './LoadingState'
import { StaleTick } from './StaleTick'

export interface ReadingMeta {
  stale: boolean
  asOfMs: number
}

interface ReadingBoundaryProps<T> {
  /** `null` means nothing was ever known: a skeleton. */
  reading: Reading<T> | null
  shape?: LoadingShape
  isEmpty?: (value: T) => boolean
  empty?: { why: string; nextAction?: NextAction }
  retry?: () => void
  /** False when the child draws its own StaleTick from `meta`. */
  tick?: boolean
  className?: string
  children: (value: T, meta: ReadingMeta) => ReactNode
}

/** The one consumer of Reading<T>: loading, unavailable, empty, stale and live, each drawn the same way everywhere. */
export function ReadingBoundary<T>({
  reading,
  shape = 'plate',
  isEmpty,
  empty,
  retry,
  tick = true,
  className,
  children,
}: ReadingBoundaryProps<T>) {
  if (reading === null) return <LoadingState shape={shape} {...(className ? { className } : {})} />
  if (!isOk(reading)) {
    return (
      <ErrorState
        diagnosis={reading.error}
        {...(retry ? { retry } : {})}
        {...(className ? { className } : {})}
      />
    )
  }
  if (empty && isEmpty?.(reading.value)) {
    return (
      <EmptyState
        why={empty.why}
        {...(empty.nextAction ? { nextAction: empty.nextAction } : {})}
        {...(className ? { className } : {})}
      />
    )
  }
  return (
    <>
      {children(reading.value, { stale: reading.stale, asOfMs: reading.asOfMs })}
      {tick && reading.stale && <StaleTick asOfMs={reading.asOfMs} />}
    </>
  )
}
