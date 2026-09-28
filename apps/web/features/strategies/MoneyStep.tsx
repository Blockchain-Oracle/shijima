'use client'

import { USDG } from '@desk/chain'
import { studioCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { type Address, erc20Abi, formatUnits } from 'viem'
import { ChainLogo } from '@/components/ui/chain-logo'
import { TokenLogo } from '@/components/ui/token-logo'
import { GiftCard } from '@/features/gift/GiftCard'
import { browserClient } from '@/features/session/useDeskSession'
import { cn } from '@/lib/utils'
import { type DraftToken, dollarsToUnits, type StudioDraft } from './draft'
import { mixSlices } from './StrategyCard'

const M = studioCopy.money
const F = studioCopy.flow
const CHOICES = ['1', '10', '20', '50', '100'] as const
/** The free $1 (PLAN-ROUND-3 D3) must be able to trade, so $1 is the floor. Our gas on a small trade is our cost. */
export const MIN_USDG = 1
/** The engine's smallest trade, MIN_TRADE_USDG in packages/core/src/wake/needs.ts: a first buy below it never happens. */
const MIN_TRADE_UNITS = 200_000n

const dollars = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * A problem with the amount, in words, or null. '0' is the practice choice and is always fine. An amount whose
 * smallest first buy falls under the engine's minimum trade is refused too: the agent would hold only cash.
 */
export function amountProblem(
  amount: string | undefined,
  balanceUsdg: bigint | null,
  weights: Record<string, number> = {},
): string | null {
  if (!amount || amount === '0') return null
  const units = dollarsToUnits(amount)
  if (units === null || units < BigInt(MIN_USDG) * 1_000_000n) return M.tooLow
  const smallest = Math.min(...Object.values(weights).filter((w) => w > 0))
  if (Number.isFinite(smallest) && (units * BigInt(smallest)) / 10_000n < MIN_TRADE_UNITS) {
    const least = Math.ceil((Number(MIN_TRADE_UNITS) * 10_000) / smallest / 10_000) / 100
    return M.tooSmallToTrade(dollars(least))
  }
  if (balanceUsdg !== null && balanceUsdg > 0n && units > balanceUsdg)
    return M.tooMuch(dollars(Number(formatUnits(balanceUsdg, 6))))
  return null
}

/** The wallet's USDG on Robinhood Chain, read in the browser. null until known, or when signed out. */
export function useUsdgBalance(owner: string | null): bigint | null {
  const [balance, setBalance] = useState<bigint | null>(null)
  useEffect(() => {
    if (!owner) return
    let live = true
    browserClient
      .readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [owner as Address] })
      .then((b) => live && setBalance(b))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [owner])
  return balance
}

/**
 * Step 2: how much. One big amount box, what the wallet holds on Robinhood Chain with a Max, quick amounts, and
 * what that buys at the strategy's weights. Too little in the wallet points to the bridge rather than opening it
 * here; practice with no money is one tap.
 */
export function MoneyStep({
  draft,
  setDraft,
  tokens,
  signedIn,
  balance,
}: {
  draft: StudioDraft
  setDraft: (update: (d: StudioDraft) => StudioDraft) => void
  tokens: DraftToken[]
  signedIn: string | null
  balance: bigint | null
}) {
  const amount = draft.amount ?? '20'
  const practice = amount === '0'
  const value = Number(amount) || 0
  const slices = mixSlices(draft.weights, draft.cashBps, tokens)
  const set = (a: string) => setDraft((d) => ({ ...d, amount: a }))
  const have = balance === null ? null : Number(formatUnits(balance, 6))
  const short = !practice && have !== null && value > have
  const tooSmall = practice || value < MIN_USDG ? null : amountProblem(amount, null, draft.weights)
  // The first time the wallet is read: an untouched $20 becomes what the wallet holds, when that is less and at
  // least the $1 minimum, so a wallet with the free $1 starts at $1 instead of at a warning.
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || have === null) return
    fitted.current = true
    if (amount === '20' && have >= MIN_USDG && have < 20) set(String(Math.floor(have * 100) / 100))
  })
  return (
    <div className="na-stack">
      <div className={cn('na-amount', practice && 'is-off')}>
        <span className="na-amount-cur">$</span>
        <input
          inputMode="decimal"
          aria-label={F.amountTitle}
          value={practice ? '' : amount}
          placeholder="0"
          onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ''))}
        />
        <span className="na-amount-unit">
          <TokenLogo symbol="USDG" size={20} />
          USDG
        </span>
      </div>

      {signedIn && (
        <div className="na-wallet-line">
          <ChainLogo chainId={4663} size={16} />
          <span>{F.inWallet}</span>
          <b>{have === null ? '…' : dollars(have)}</b>
          {have !== null && have > 0 && (
            <button
              type="button"
              className="na-max"
              onClick={() => set(String(Math.floor(have * 100) / 100))}
            >
              {F.max}
            </button>
          )}
        </div>
      )}

      <div className="na-quick">
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={amount === c}
            className={cn('na-chip', amount === c && 'is-on')}
            onClick={() => set(c)}
          >
            ${c}
          </button>
        ))}
      </div>

      {!short && tooSmall && <p className="na-warn">{tooSmall}</p>}
      {short && (
        <p className="na-warn">
          {F.notEnough(dollars(have ?? 0))} <Link href={'/bridge' as Route}>{F.addUsdg} →</Link>
        </p>
      )}
      {signedIn && <GiftCard className="money-gift" />}

      {!practice && value > 0 && (
        <div className="na-buys">
          <span className="na-label">{F.buys}</span>
          <ul>
            {slices.map((sl) => (
              <li key={sl.symbol}>
                <TokenLogo symbol={sl.symbol} size={22} />
                <span>{sl.symbol === 'CASH' ? M.cash : sl.label}</span>
                <b>{dollars((value * sl.pct) / 100)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className={cn('na-practice', practice && 'is-on')}
        aria-pressed={practice}
        onClick={() => set(practice ? '20' : '0')}
      >
        <span className="na-practice-box" aria-hidden="true" />
        <span>
          <b>{F.practice}</b>
          <small>{F.practiceNote}</small>
        </span>
      </button>
    </div>
  )
}
