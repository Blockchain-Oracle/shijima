'use client'

import { useDeskSessionContext } from './DeskSessionProvider'
import { SessionPanel } from './SessionPanel'

/** The key panel for the desk on this page. */
export function OwnerSessionPanel() {
  const ctx = useDeskSessionContext()
  if (!ctx) return null
  return <SessionPanel owner={ctx.owner} desk={ctx.desk} session={ctx.session} />
}
