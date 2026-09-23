'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TokenLogo } from './token-logo'

/**
 * A basket as a ring, after 21st's Sectors Donut (20086): one arc per holding in its token colour, a label in the
 * middle, and an optional legend where hovering a row lights its arc. Used small on strategy cards and large on
 * the desk, where it shows what the desk holds against what it was told to hold.
 */
export interface DonutSlice {
  /** A token symbol, or "CASH". Keys the arc and draws the legend logo. */
  symbol: string
  label: string
  pct: number
  color: string
}

const EASE = [0.16, 1, 0.3, 1] as const

export function AllocationDonut({
  slices,
  size = 132,
  thickness,
  center,
  caption,
  legend = false,
  className,
}: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  center?: string
  caption?: string
  legend?: boolean
  className?: string
}) {
  const reduced = useReducedMotion()
  const [hot, setHot] = useState<number | null>(null)
  const stroke = thickness ?? Math.max(4, Math.round(size / 10))
  const r = size / 2 - stroke / 2 - 1
  const c = 2 * Math.PI * r
  // A hairline gap between arcs reads as separate holdings; a tiny ring has no room for one.
  const gap = size >= 80 ? 2 : 0

  let acc = 0
  const arcs = slices
    .filter((s) => s.pct > 0)
    .map((s) => {
      const start = acc
      acc += s.pct
      return { ...s, start }
    })

  return (
    <div className={cn('flex items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={stroke}
          />
          {arcs.map((a, i) => (
            <motion.circle
              key={a.symbol}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, (a.pct / 100) * c - gap)} ${c}`}
              strokeDashoffset={-((a.start / 100) * c)}
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: hot === null || hot === i ? 1 : 0.22 }}
              transition={reduced ? { duration: 0 } : { duration: 0.35, ease: EASE, delay: 0.06 * i }}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
            />
          ))}
        </svg>
        {(center || caption) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {center && (
              <span className="font-[family-name:var(--font-data)] text-[15px] font-semibold text-foreground/90">
                {center}
              </span>
            )}
            {caption && <span className="mt-0.5 text-[9px] text-muted-foreground">{caption}</span>}
          </div>
        )}
      </div>

      {legend && (
        <ul className="flex min-w-0 flex-col">
          {arcs.map((a, i) => (
            <li key={a.symbol}>
              <button
                type="button"
                onMouseEnter={() => setHot(i)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(i)}
                onBlur={() => setHot(null)}
                className={cn(
                  '-mx-2 flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left transition-opacity duration-200',
                  hot !== null && hot !== i && 'opacity-35',
                )}
              >
                <TokenLogo symbol={a.symbol} size={18} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/75">{a.label}</span>
                <span className="font-[family-name:var(--font-data)] text-[11.5px] tabular-nums text-muted-foreground">
                  {a.pct.toFixed(a.pct < 10 ? 1 : 0)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
