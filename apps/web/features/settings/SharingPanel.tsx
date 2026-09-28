'use client'

import { useState } from 'react'
import { CopySettings } from '@/features/copy/CopySettings'
import { type ShareState, ShareToggle } from './ShareToggle'

/**
 * The Sharing tab: the public link, then copying, as two separate numbered cards. The link's state lives here so
 * the copy card sees it change, and can turn it on itself, without a reload.
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
  const [share, setShare] = useState(initialShare)
  return (
    <div className="st-stack">
      <ShareToggle deskId={deskId} share={share} onChange={setShare} />
      {copy && <CopySettings deskId={deskId} initial={copy} share={share} onShare={setShare} />}
    </div>
  )
}
