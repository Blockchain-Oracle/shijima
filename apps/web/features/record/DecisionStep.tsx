'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * One section of a decision on the stepper's rail (after Agari's S22 `Section`): its icon on the rail, its number
 * and title, and the card. Sections rise in one after another; with reduced motion they are simply there.
 */
export function DecisionStep({
  n,
  title,
  icon,
  tone,
  children,
}: {
  n: number
  title: string
  icon: ReactNode
  tone?: string
  children: ReactNode
}) {
  const reduce = useReducedMotion() ?? false
  return (
    <motion.li
      className="dc-step"
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(n, 9) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="dc-step-icon" aria-hidden>
        {icon}
      </span>
      <section className="dc-step-card" aria-label={title}>
        <h2 className="dc-step-title">
          <span className="dc-step-n">{String(n).padStart(2, '0')}</span>
          {title}
        </h2>
        {children}
      </section>
    </motion.li>
  )
}
