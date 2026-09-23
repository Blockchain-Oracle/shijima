'use client'

import { appCopy } from '@desk/shared'
import { useEffect, useState } from 'react'
import { browserClient } from '@/features/session/useDeskSession'
import { cn } from '@/lib/utils'

const POLL_MS = 4_000

/**
 * "● Live on Robinhood Chain mainnet · block 12,345,678", with the block read by this browser from the public
 * network every few seconds. Nothing here comes from our server, so it cannot be staged: if the chain stops,
 * the number stops. A practice agent never wears this badge; it speaks for the network, not for a trade.
 */
export function LiveBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [block, setBlock] = useState<bigint | null>(null)

  useEffect(() => {
    let stopped = false
    const read = () =>
      browserClient
        .getBlockNumber()
        .then((n) => !stopped && setBlock(n))
        .catch(() => undefined)
    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  return (
    <span
      className={cn('live-badge', compact && 'live-badge--compact', className)}
      title={appCopy.live.title}
    >
      <span className="live-badge-dot" aria-hidden="true" />
      <span className="live-badge-word">{compact ? appCopy.live.short : appCopy.live.badge}</span>
      {block !== null && (
        <span className="live-badge-block">{appCopy.live.block(block.toLocaleString('en-US'))}</span>
      )}
    </span>
  )
}
