'use client'

import { deskCopy, sessionCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import {
  abandonChainProposalAction,
  finishChainProposalAction,
  prepareChainProposalAction,
} from '@/app/actions'
import { previewChainProposalAction } from '@/app/owner-actions'
import { BlockedButton } from '@/components/states'
import { Button } from '@/components/ui/button'
import type { ChatCard } from '@/features/desk/chat-model'
import type { Preview } from '@/lib/chain-proposals.server'
import { useDeskSessionContext } from './DeskSessionProvider'
import { browserClient, sendWithSessionKey } from './useDeskSession'

const feeWords = (usd: number) =>
  usd < 0.01 ? sessionCopy.feeTiny : sessionCopy.fee(`$${usd.toFixed(usd < 1 ? 3 : 2)}`)

/**
 * Confirming a card that acts on the chain. Costs first: the server builds the transaction from the chain as it
 * is and simulates it, and the owner reads what they get and what it costs before anything is signed. Then the
 * server takes the card and builds it afresh; the session key signs when the key is live and every call is in its
 * scope, and otherwise the owner's wallet does. The server reads the receipt from the chain before calling it done.
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
  const [preview, setPreview] = useState<Preview | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const look = useCallback(async () => {
    setProblem(null)
    const result = await previewChainProposalAction(card.id).catch(() => null)
    if (!result) return setProblem(sessionCopy.refusedByChain)
    if (result.ok) setPreview(result.preview)
    else setProblem(result.why)
  }, [card.id])

  useEffect(() => {
    void look()
  }, [look])

  if (!ctx) return null

  const keyMay =
    card.path === 'session' &&
    ctx.session.status === 'live' &&
    ctx.session.key !== null &&
    preview?.sessionMay === true
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

  if (problem) {
    return (
      <div className="flex flex-col gap-2">
        <p className="type-caption text-loss">{problem}</p>
        <Button size="sm" variant="ghost" onClick={() => void look()}>
          {deskCopy.card.again}
        </Button>
      </div>
    )
  }
  if (!preview) return <p className="type-caption text-ink-muted">{sessionCopy.checking}</p>

  return (
    <div className="flex flex-col gap-2">
      <ul className="desk-card-lines">
        {preview.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="type-caption text-ink-muted">
        {feeWords(preview.feeUsd)} {keyMay ? sessionCopy.whoPays.key : sessionCopy.whoPays.wallet}{' '}
        {keyMay ? sessionCopy.signWithKey : sessionCopy.signWithWallet}
      </p>
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
