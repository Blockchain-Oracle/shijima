'use client'

import { webCopy } from '@desk/shared'
import { TriangleAlertIcon } from 'lucide-react'
import { robinhood } from 'viem/chains'
import { useAccount, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'

/**
 * Above the content, never a modal, from Agari (`components/chrome/WrongNetworkBanner.tsx`). It shows only while
 * a connected wallet sits on another network, and offers the one fix.
 */
export function WrongNetworkBanner() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  if (!isConnected || chainId === undefined || chainId === robinhood.id) return null
  return (
    <div
      role="alert"
      className="wrong-network flex items-center justify-between gap-3 border-hairline border-b bg-surface-2 px-gutter py-2 lg:px-gutter-desktop"
    >
      <span className="flex items-center gap-2 text-ink type-caption">
        <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span className="text-warning">{webCopy.wrongNetwork.label}</span>
        <span>{webCopy.wrongNetwork.body}</span>
      </span>
      <Button size="sm" onClick={() => switchChain({ chainId: robinhood.id })} disabled={isPending}>
        {isPending ? webCopy.wrongNetwork.switching : webCopy.wrongNetwork.switchTo}
      </Button>
    </div>
  )
}
