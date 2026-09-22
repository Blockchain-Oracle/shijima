import type { CSSProperties } from 'react'

/** Agari's stagger (`features/how-it-works/rise.ts`): framer-motion's `delay: index * 0.08`, as a CSS delay. */
const STEP_MS = 80

export function riseDelay(index: number, baseMs = 0): CSSProperties {
  return { animationDelay: `${baseMs + index * STEP_MS}ms` }
}
