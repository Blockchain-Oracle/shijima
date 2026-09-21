'use client'

import { deskCopy, sessionCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import {
  abandonChainProposalAction,
  finishChainProposalAction,
  prepareChainProposalAction,
} from '@/app/actions'
import { BlockedButton } from '@/components/states'
import { Button } from '@/components/ui/button'
import type { ChatCard } from '@/features/desk/chat-model'
import { useDeskSessionContext } from './DeskSessionProvider'
import { browserClient, sendWithSessionKey } from './useDeskSession'

/**
 * Confirming a card that acts on the chain. The server takes the card and builds its one transaction; the
 * session key signs it when the key is live and the call is in its scope, and otherwise the owner's wallet does.
 * The server then reads the receipt from the chain before it calls the card done.
 */
export function ChainConfirm({
  card,
  onOutcome,
}: {
  card: ChatCard
  onOutcome: (ok: boolean, text: string) => void
}) {
  const router = useRouter()
  const ctx = useDeskSessionContext()
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const [busy, setBusy] = useState(false)
  if (!ctx) return null

  const keyMay = card.path === 'session' && ctx.session.status === 'live' && ctx.session.key !== null
  const walletReady = address?.toLowerCase() === ctx.owner.toLowerCase()

  const go = async () => {
    setBusy(true)
    try {
      const prepared = await prepareChainProposalAction(card.id)
      if (!prepared.ok) return onOutcome(false, prepared.why)
      const { call } = prepared
      let hash: `0x${string}`
      try {
        if (keyMay && call.sessionMay && ctx.session.key) {
          hash = (await sendWithSessionKey(ctx.session.key, call.to, call.data)).transactionHash
        } else {
          hash = await sendTransactionAsync({ to: call.to, data: call.data })
          await browserClient.waitForTransactionReceipt({ hash, timeout: 90_000 })
        }
      } catch (e) {
        const text =
          e instanceof Error && /reject|denied/i.test(e.message)
            ? sessionCopy.cancelled
            : sessionCopy.refusedByChain
        await abandonChainProposalAction(card.id, text)
        return onOutcome(false, text)
      }
      const done = await finishChainProposalAction(card.id, hash)
      onOutcome(done.ok, done.message)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const signer = keyMay ? sessionCopy.signWithKey : sessionCopy.signWithWallet
  return (
    <div className="flex flex-col gap-2">
      <p className="type-caption text-ink-muted">{signer}</p>
      {keyMay || walletReady ? (
        <Button size="sm" onClick={go} disabled={busy}>
          {busy ? sessionCopy.sending : deskCopy.card.confirm}
        </Button>
      ) : (
        <BlockedButton blocked={sessionCopy.wrongWallet} size="sm">
          {deskCopy.card.confirm}
        </BlockedButton>
      )}
    </div>
  )
}
