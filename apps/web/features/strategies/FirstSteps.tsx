'use client'

import { EXPLORER, USDG } from '@desk/chain'
import { money, studioCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { type Address, erc20Abi, formatUnits } from 'viem'
import { skipTelegramAction } from '@/app/studio-actions'
import { DeskSessionProvider } from '@/features/session/DeskSessionProvider'
import { OwnerSessionPanel } from '@/features/session/OwnerSessionPanel'
import { browserClient } from '@/features/session/useDeskSession'
import { TelegramConnect } from '@/features/settings/TelegramConnect'
import type { Created } from './CreateStep'

const D = studioCopy.done

/**
 * After Publish, as Masayume ends its studio on "what happens next": put money in, give this browser a key, and
 * connect Telegram (design brief 8.5, 8.8). Each one is the same control the desk page uses, and each can wait.
 */
export function FirstSteps({
  created,
  name,
  owner,
  contractVersion,
  onAnother,
}: {
  created: Created
  name: string
  owner: string
  contractVersion: string
  perActionUsdg: string
  dailyUsdg: string
  goLiveChecks: number
  onAnother: () => void
}) {
  const [cash, setCash] = useState<bigint | null>(null)
  const [skipped, setSkipped] = useState(false)

  // The desk's own cash, read from the chain, so money arriving shows here without a reload.
  useEffect(() => {
    let live = true
    const read = () =>
      browserClient
        .readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [created.address] })
        .then((v) => live && setCash(v))
        .catch(() => {})
    void read()
    const timer = setInterval(read, 8000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [created.address])

  return (
    <DeskSessionProvider owner={owner} desk={created.address as Address} contractVersion={contractVersion}>
      <section className="agent-builder agent-published" aria-live="polite">
        <div>
          <p className="strat-micro text-vermilion">{D.kicker}</p>
          <h2 className="strat-h2 mt-2 text-ink">{D.title(name)}</h2>
        </div>
        <p className="strat-choice-body">{D.body}</p>
        {created.fundedUsdg ? (
          <p className="font-semibold text-[15px] text-gain">{D.funded(money(created.fundedUsdg))}</p>
        ) : null}
        {created.txHash && (
          <a
            className="strat-sensei justify-self-start"
            href={`${EXPLORER}/tx/${created.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {D.tx}
          </a>
        )}
      </section>

      <h3 className="strat-choice-title text-ink">{D.firstSteps}</h3>
      <div className="studio-first">
        <section className="desk-panel">
          <h4 className="type-label-micro text-ink-muted">{D.money.title}</h4>
          <p className="type-caption text-ink-secondary">
            {cash !== null && cash > 0n ? D.money.funded(money(formatUnits(cash, 6))) : D.money.body}
          </p>
          <Link href={`/fund?agent=${created.slug}` as Route} className="strat-sensei self-start">
            {D.money.open} →
          </Link>
        </section>

        <OwnerSessionPanel />

        <section className="desk-panel">
          <h4 className="type-label-micro text-ink-muted">{D.telegram.title}</h4>
          <p className="type-caption text-ink-secondary">{D.telegram.body}</p>
          {skipped ? (
            <p className="type-caption text-warning">{D.telegram.skipped}</p>
          ) : (
            <>
              <TelegramConnect initial={null} />
              <button
                type="button"
                className="type-caption self-start text-ink-muted underline underline-offset-2"
                onClick={async () => {
                  await skipTelegramAction(created.deskId)
                  setSkipped(true)
                }}
              >
                {D.telegram.skip}
              </button>
            </>
          )}
        </section>
      </div>

      <div className="agent-builder-actions">
        <button type="button" className="strat-sensei" onClick={onAnother}>
          {D.another}
        </button>
        <Link
          href={`/agents/${created.slug}` as Route}
          className="strat-confirm strat-confirm--live text-center"
        >
          {D.open}
        </Link>
      </div>
    </DeskSessionProvider>
  )
}
