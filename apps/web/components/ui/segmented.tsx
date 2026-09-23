'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useId, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * A sliding-pill switch, after 21st's Segmented Control (23552): a radio group, arrow keys move the choice,
 * and the pill springs to it. Used for the Strategies views and a chart's time ranges.
 */
export interface SegmentedOption<V extends string> {
  value: V
  label: string
  disabled?: boolean
}

const SPRING = { type: 'spring', stiffness: 520, damping: 34, mass: 0.45 } as const

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  options: SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const reduced = useReducedMotion()
  const pill = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const move = (from: number, dir: number) => {
    for (let k = 1; k <= options.length; k++) {
      const i = (from + dir * k + options.length) % options.length
      const o = options[i]
      if (o && !o.disabled) {
        buttons.current[i]?.focus()
        onChange(o.value)
        return
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'relative inline-flex max-w-full rounded-full border border-border bg-[var(--color-surface-1)] p-[3px]',
        className,
      )}
    >
      {options.map((o, i) => {
        const on = i === index
        return (
          // biome-ignore lint/a11y/useSemanticElements: a styled pill needs a button; role and arrow keys make it a radio.
          <button
            key={o.value}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(i, -1)
              }
            }}
            className={cn(
              'relative z-0 whitespace-nowrap rounded-full text-center font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm'
                ? 'px-2.5 py-1 text-[11.5px]'
                : 'px-3 py-[7px] text-[12.5px] sm:px-4 sm:text-[13px]',
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {on && (
              <motion.span
                layoutId={pill}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full border border-[var(--color-accent-dim)] bg-[var(--color-accent-wash)]"
                transition={reduced ? { duration: 0 } : SPRING}
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
