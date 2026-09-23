'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'

/**
 * A small line of recent values, green when it ended higher than it began and red when lower, with a faint fill
 * under it. It draws itself in once. Decorative: the number beside it always says the same thing in words.
 */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const fill = useId()
  if (values.length < 2) return <span style={{ width, height }} className={className} aria-hidden />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => height - 2 - ((v - lo) / span) * (height - 4)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const up = (values.at(-1) ?? 0) >= (values[0] ?? 0)
  const color = up ? 'var(--profit)' : 'var(--loss)'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fill})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}
