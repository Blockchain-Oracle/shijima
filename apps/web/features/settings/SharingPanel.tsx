'use client'

import { CopySettings } from '@/features/copy/CopySettings'
import { type ShareState, ShareToggle } from './ShareToggle'

/**
 * The Sharing tab: a public beta link, then the owner’s independent permission to copy.
 */
export function SharingPanel({
  deskId,
  initialShare,
  copy,
}: {
  deskId: string
  initialShare: ShareState
  /** Null once the agent is closed: nothing can start copying it. */
  copy: { copyable: boolean; feeUsdg: string } | null
}) {
  return (
    <div className="st-stack">
      <ShareToggle deskId={deskId} share={initialShare} />
      {copy && <CopySettings deskId={deskId} initial={copy} />}
    </div>
  )
}
