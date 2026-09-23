'use client'

import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * A progress bar with named steps, after 21st's Multi-Step Setup Wizard (29518). Finished steps can be revisited
 * by clicking them; the ones ahead cannot be skipped to. "Step 2 of 4" is said in words for screen readers too.
 */
export function Stepper({
  steps,
  current,
  onBack,
  label,
  counter,
}: {
  steps: readonly string[]
  /** 1-based. */
  current: number
  onBack: (step: number) => void
  label: string
  counter: (current: number, total: number) => string
}) {
  const reduced = useReducedMotion()
  const progress = steps.length > 1 ? (current - 1) / (steps.length - 1) : 1
  return (
    <nav aria-label={label} className="my-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-[family-name:var(--font-data)] text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
          {counter(current, steps.length)}
        </span>
        <span className="text-[13px] font-medium text-foreground">{steps[current - 1]}</span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-[var(--color-hairline)]">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
          initial={false}
          animate={{ width: `${Math.max(6, progress * 100)}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>
      <ol className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const n = i + 1
          const done = n < current
          const on = n === current
          return (
            <li key={s} aria-current={on ? 'step' : undefined} className="min-w-0">
              <button
                type="button"
                disabled={!done}
                onClick={() => done && onBack(n)}
                className={cn(
                  'flex max-w-full items-center gap-1.5 truncate py-1 text-left text-[12px] transition-colors',
                  on
                    ? 'text-foreground'
                    : done
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-muted-foreground/50',
                  i === steps.length - 1 && 'ml-auto',
                  i > 0 && i < steps.length - 1 && 'mx-auto',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold',
                    done
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--on-accent)]'
                      : on
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                        : 'border-border',
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-2.5" /> : n}
                </span>
                <span className="hidden truncate sm:inline">{s}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
