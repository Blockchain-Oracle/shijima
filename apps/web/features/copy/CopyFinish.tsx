'use client'

import { USDG } from '@desk/chain'
import { appCopy } from '@desk/shared'
import { Check } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { type Address, encodeFunctionData, erc20Abi, type Hex } from 'viem'
import { robinhood } from 'viem/chains'
import { useSendTransaction } from 'wagmi'
import { type CopyQuote, startCopyAction } from '@/app/copy-actions'
import { browserClient } from '@/features/session/useDeskSession'

const c = appCopy.copy.finish
const usd = (raw: string) => `$${(Number(raw) / 1e6).toFixed(2)}`

interface Progress {
  creatorTx?: string
  platformTx?: string
  started?: boolean
}

/**
 * The last step of copying, once the owner's own agent exists: the one-time fee, as one plain USDG transfer to
 * the creator and one to Shijima, each from the owner's own wallet; then the link, which the server records only
 * after it finds both transfers on chain. Progress is kept in this browser, so a closed tab resumes at the step
 * it stopped at and never pays twice.
 */
export function CopyFinish({
  quote,
  followerDeskId,
  followerSlug,
}: {
  quote: CopyQuote
  followerDeskId: string
  followerSlug: string
}) {
  const key = `shijima.copy:${followerDeskId}`
  const [p, setP] = useState<Progress>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const { sendTransactionAsync } = useSendTransaction()

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) setP(JSON.parse(raw) as Progress)
    } catch {
      // Blocked storage: this visit keeps its own progress.
    }
  }, [key])

  const save = (next: Progress) => {
    setP(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // As above.
    }
  }

  const pay = async (which: 'creatorTx' | 'platformTx', to: Address, amount: string) => {
    setWhy(null)
    setBusy(which)
    try {
      const hash = await sendTransactionAsync({
        to: USDG,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, BigInt(amount)] }),
        chainId: robinhood.id,
      })
      const receipt = await browserClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 180_000 })
      if (receipt.status === 'success') save({ ...p, [which]: hash })
      else setWhy(c.rejected)
    } catch {
      setWhy(c.rejected)
    } finally {
      setBusy(null)
    }
  }

  const start = async () => {
    setWhy(null)
    setBusy('start')
    const r = await startCopyAction({
      followerDeskId,
      leaderRef: quote.leaderSlug,
      ...(p.creatorTx ? { creatorFeeTx: p.creatorTx } : {}),
      ...(p.platformTx ? { platformFeeTx: p.platformTx } : {}),
    })
    setBusy(null)
    if (r.ok) save({ ...p, started: true })
    else setWhy(r.why)
  }

  const needCreator = quote.creatorUsdg !== '0' && !p.creatorTx
  const needPlatform = quote.treasury !== null && quote.platformUsdg !== '0' && !p.platformTx

  return (
    <section className="copy-finish" aria-label={c.title(quote.name)}>
      <h2>{c.title(quote.name)}</h2>
      <p className="copy-muted">{c.body}</p>
      {p.started ? (
        <>
          <p className="copy-done">
            <Check aria-hidden="true" className="size-4" /> {c.started}
          </p>
          <Link href={`/agents/${followerSlug}` as Route} className="btn-primary ov-btn">
            {c.open} →
          </Link>
        </>
      ) : (
        <div className="copy-steps">
          {quote.creatorUsdg !== '0' && (
            <button
              type="button"
              className={p.creatorTx ? 'copy-step is-done' : 'btn-primary copy-step'}
              disabled={!needCreator || busy !== null}
              onClick={() => pay('creatorTx', quote.creator, quote.creatorUsdg)}
            >
              {p.creatorTx
                ? `${c.paid} · ${usd(quote.creatorUsdg)}`
                : busy === 'creatorTx'
                  ? c.waiting
                  : c.payCreator(usd(quote.creatorUsdg))}
            </button>
          )}
          {quote.treasury && quote.platformUsdg !== '0' && (
            <button
              type="button"
              className={p.platformTx ? 'copy-step is-done' : 'btn-primary copy-step'}
              disabled={!needPlatform || needCreator || busy !== null}
              onClick={() => quote.treasury && pay('platformTx', quote.treasury, quote.platformUsdg)}
            >
              {p.platformTx
                ? `${c.paid} · ${usd(quote.platformUsdg)}`
                : busy === 'platformTx'
                  ? c.waiting
                  : c.payShijima(usd(quote.platformUsdg))}
            </button>
          )}
          <button
            type="button"
            className="btn-primary copy-step"
            disabled={needCreator || needPlatform || busy !== null}
            onClick={start}
          >
            {busy === 'start' ? c.waiting : c.start}
          </button>
        </div>
      )}
      {why && <p className="copy-why">{why}</p>}
    </section>
  )
}
