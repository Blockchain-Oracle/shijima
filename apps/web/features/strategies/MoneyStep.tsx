'use client'

import { USDG } from '@desk/chain'
import { studioCopy } from '@desk/shared'
import { useEffect, useState } from 'react'
import { type Address, erc20Abi, formatUnits } from 'viem'
import { TokenLogo } from '@/components/ui/token-logo'
import { browserClient } from '@/features/session/useDeskSession'
import { cn } from '@/lib/utils'
import { type DraftToken, dollarsToUnits, type StudioDraft } from './draft'
import { mixSlices } from './StrategyCard'

const M = studioCopy.money
const CHOICES = ['10', '20', '50', '100'] as const
/** The free $1 (PLAN-ROUND-3 D3) must be able to trade, so $1 is the floor. Our gas on a small trade is our cost. */
export const MIN_USDG = 1

const dollars = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A problem with the amount, in words, or null. '0' is the practice choice and is always fine. */
export function amountProblem(amount: string | undefined, balanceUsdg: bigint | null): string | null {
  if (!amount || amount === '0') return null
  const units = dollarsToUnits(amount)
  if (units === null || units < BigInt(MIN_USDG) * 1_000_000n) return M.tooLow
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
 * Step 2, the money first (Glider's order: choose, deposit, go): how much USDG the agent will look after, what the
 * wallet holds, and what that amount buys at the strategy's weights, in dollars. Practice with no money is one
 * tap, because a careful person may want to watch the agent before trusting it with a cent.
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
  const custom = !CHOICES.includes(amount as (typeof CHOICES)[number]) && !practice
  return (
    <div className="flex flex-col gap-5">
      <p className="strat-choice-body">{M.lead}</p>
      <p className="type-caption text-ink-secondary">
        {!signedIn
          ? M.balanceSignedOut
          : balance === null
            ? '…'
            : balance === 0n
              ? M.balanceNone
              : M.balance(dollars(Number(formatUnits(balance, 6))))}
      </p>

      <fieldset className="money-choices" aria-label={M.lead}>
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={amount === c}
            className={cn('money-choice', amount === c && 'is-on')}
            onClick={() => set(c)}
          >
            ${c}
          </button>
        ))}
        <label className={cn('money-choice money-custom', custom && 'is-on')}>
          <span className="sr-only">{M.custom}</span>$
          <input
            inputMode="decimal"
            placeholder={M.custom}
            value={custom ? amount : ''}
            onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
      </fieldset>
      <p className="studio-hint">{M.min}</p>

      {!practice && value > 0 ? (
        <div className="money-split">
          <span className="strat-micro text-ink-muted">{M.split}</span>
          <ul>
            {slices.map((s) => (
              <li key={s.symbol}>
                <TokenLogo symbol={s.symbol} size={22} />
                <span>{s.symbol === 'CASH' ? M.cash : s.label}</span>
                <b>{dollars((value * s.pct) / 100)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className={cn('money-practice', practice && 'is-on')}
        aria-pressed={practice}
        onClick={() => set(practice ? '20' : '0')}
      >
        <b>{M.practice}</b>
        <span>{M.practiceNote}</span>
      </button>
    </div>
  )
}
