import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface MarqueeItem {
  key: string
  label: ReactNode
  logo: ReactNode
}

/**
 * An endless row of logos, after 21st's Logo Cloud Marquee (7ovr, 21470): the list twice over, sliding left, faded
 * at both edges, paused on hover and still for anyone who asks the system for less motion.
 */
export function LogoMarquee({
  items,
  seconds = 36,
  reverse = false,
  className,
}: {
  items: MarqueeItem[]
  seconds?: number
  /** Slide right instead, so two rows stacked read as moving against each other. */
  reverse?: boolean
  className?: string
}) {
  return (
    <div className={cn('lm-mask', className)}>
      <div className={cn('lm-track', reverse && 'lm-reverse')} style={{ animationDuration: `${seconds}s` }}>
        {(['a', 'b'] as const).flatMap((copy) =>
          items.map((it) => (
            <div
              key={`${copy}-${it.key}`}
              className="lm-item"
              aria-hidden={copy === 'b' ? 'true' : undefined}
            >
              {it.logo}
              <span>{it.label}</span>
            </div>
          )),
        )}
      </div>
    </div>
  )
}
