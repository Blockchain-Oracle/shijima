import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Agari's `SectionHeader` (`components/chrome/SectionHeader.tsx`): "01 · Title", an aside, a line under it. */
export function SectionHeader({
  index,
  title,
  desc,
  aside,
  className,
}: {
  index: string
  title: string
  desc?: string
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('border-hairline border-b pb-2', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="type-label-micro text-ink-muted">{index}</span>
          <span className="text-ink-muted" aria-hidden="true">
            ·
          </span>
          <h2 className="type-title text-ink">{title}</h2>
        </div>
        {aside}
      </div>
      {desc && <p className="mt-1 type-caption text-ink-secondary">{desc}</p>}
    </header>
  )
}
