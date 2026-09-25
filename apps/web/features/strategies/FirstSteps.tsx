'use client'

import { EXPLORER, USDG } from '@desk/chain'
import { money, short, studioCopy } from '@desk/shared'
import { Check, Copy, ExternalLink } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { erc20Abi, formatUnits } from 'viem'
import { skipTelegramAction } from '@/app/studio-actions'
import { BrandLogo } from '@/components/ui/brand-logo'
import { TokenLogo } from '@/components/ui/token-logo'
import { browserClient } from '@/features/session/useDeskSession'
import { TelegramConnect } from '@/features/settings/TelegramConnect'
import type { Created } from './CreateStep'

const D = studioCopy.done

/**
 * The moment an agent exists: one card that says it is running (or practising), what it holds, where it lives
 * on chain, and the one thing worth doing next, Telegram. The browser key and every other control live on the
 * agent's own page, one tap away.
 */
export function FirstSteps({
  created,
  name,
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
  const [copied, setCopied] = useState(false)

  // The agent's own cash, read from the chain, so money arriving shows here without a reload.
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

  const holds =
    cash !== null ? money(formatUnits(cash, 6)) : created.fundedUsdg ? money(created.fundedUsdg) : null

  return (
    <section className="done-card" aria-live="polite">
      <div className="done-mark" aria-hidden="true">
        <Check className="size-7" />
      </div>
      <h2 className="done-title">{created.live ? D.titleLive(name) : D.titlePractice(name)}</h2>
      <p className="done-sub">{created.live ? D.bodyLive : D.bodyPractice}</p>

      <div className="done-facts">
        <div className="done-fact">
          <span className="done-label">{D.holds}</span>
          <span className="done-value">
            <TokenLogo symbol="USDG" size={20} />
            {holds ?? '…'}
          </span>
        </div>
        <div className="done-fact">
          <span className="done-label">{D.account}</span>
          <span className="done-value done-mono">
            {short(created.address, 6, 4)}
            <button
              type="button"
              className="done-icon-btn"
              aria-label={D.copy}
              onClick={() =>
                void navigator.clipboard?.writeText(created.address).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
            <a
              className="done-icon-btn"
              href={`${EXPLORER}/address/${created.address}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={D.tx}
            >
              <ExternalLink className="size-3.5" />
            </a>
          </span>
        </div>
      </div>

      {!skipped && (
        <div className="done-telegram">
          <BrandLogo brand="telegram" size={32} />
          <div className="done-telegram-text">
            <b>{D.telegram.title}</b>
            <span>{D.telegram.body}</span>
          </div>
          <div className="done-telegram-actions">
            <TelegramConnect initial={null} compact />
            <button
              type="button"
              className="done-skip"
              onClick={async () => {
                await skipTelegramAction(created.deskId)
                setSkipped(true)
              }}
            >
              {D.telegram.skip}
            </button>
          </div>
        </div>
      )}

      <div className="done-actions">
        <Link href={`/agents/${created.slug}` as Route} className="na-cta">
          {D.open}
        </Link>
        <div className="done-links">
          <Link href={`/fund?agent=${created.slug}` as Route}>{D.money.open}</Link>
          <button type="button" onClick={onAnother}>
            {D.another}
          </button>
        </div>
      </div>
    </section>
  )
}
