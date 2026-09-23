'use client'

import type { ReactNode } from 'react'
import { useReveal } from './useReveal'

/**
 * A block that rises into view (`.reveal`), so the sections themselves can stay server components and read live
 * data. The reference calls `useReveal` inside each section; this is the same hook in one place.
 */
export function Reveal({
  as = 'section',
  id,
  className,
  label,
  children,
}: {
  as?: 'section' | 'div'
  id?: string
  className: string
  label?: string
  children: ReactNode
}) {
  const ref = useReveal<HTMLDivElement>()
  const props = { ref, id, className: `${className} reveal`, 'aria-label': label, children }
  return as === 'div' ? <div {...props} /> : <section {...props} />
}
