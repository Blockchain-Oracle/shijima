import type { ReactNode } from 'react'

/**
 * The first pages, written before the design system, set inside Yosuku's container so they sit correctly in the
 * shell. Each route drops this frame when it is rebuilt on the new components.
 */
export function LegacyFrame({ children }: { children: ReactNode }) {
  return <div className="container legacy-page">{children}</div>
}
