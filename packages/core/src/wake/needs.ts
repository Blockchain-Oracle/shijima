/**
 * What, if anything, would move the desk back toward its mandate. Plain arithmetic, no AI. The model never
 * proposes a trade and never sets a size: it is only ever asked WHEN, about a candidate that came from here.
 *
 * No candidates means "nothing to do", with no model call at all. That is the common case.
 */
import type { Mandate } from '@desk/shared'
import { engineCopy } from '@desk/shared'
import type { Candidate } from './types'
import type { HoldingValue, Valuation } from './valuation'

/** Below this an action is not worth its network fee, which the operator pays. About 4 cents a trade. */
export const MIN_TRADE_USDG = 1_000_000n
/**
 * A trade must correct a drift worth several times what it costs. Six of the approved tokens cost about 10 bps
 * for a round trip and four cost about 60, because their liquidity sits in the 0.3% tier. Without this, a tight
 * tolerance on an expensive token would have the desk trading away the owner's money in fees.
 */
export const COST_MULTIPLE = 5
/**
 * How far under the per-action cap a sell is sized. The contract values a sell at the larger of what came
 * back and what the oracle says, and both move between sizing and sending.
 */
export const SELL_HEADROOM_BPS = 200
const PRICE_SCALE = 10n ** 20n

export interface Need {
  candidate: Candidate
  driftBps: number
  /** The drift this token must exceed before the desk considers acting: the mandate's, or cost-based if larger. */
  thresholdBps: number
  /** True when the full correction was larger than the per-action limit and was cut down to fit. */
  limitedByPerAction: boolean
}

/** One way cost is half a round trip. The drift must be worth COST_MULTIPLE times that. */
export function thresholdBps(h: HoldingValue, mandate: Mandate): number {
  const oneWayCostBps = h.token.roundTripBps100 / 2
  return Math.max(mandate.driftToleranceBps, Math.ceil(COST_MULTIPLE * oneWayCostBps))
}

export function findNeeds(v: Valuation, mandate: Mandate, perActionCapUsdg: bigint): Need[] {
  // The smaller of the owner's mandate and what the chain will actually allow.
  const cap = perActionCapUsdg < mandate.perActionCapUsdg ? perActionCapUsdg : mandate.perActionCapUsdg
  const needs: Need[] = []

  for (const h of v.holdings) {
    const notInMandate = h.targetBps === 0
    const threshold = thresholdBps(h, mandate)
    // A token the mandate no longer names is sold whatever its size. Anything else must be past its threshold.
    if (!notInMandate && Math.abs(h.driftBps) <= threshold) continue
    if (h.driftBps === 0 || h.twapE8 === 0n) continue

    const side = h.driftBps > 0 ? 'sell' : 'buy'
    const fullUsdg = (v.totalUsdg * BigInt(Math.abs(h.driftBps))) / 10_000n
    let usdg = fullUsdg > cap ? cap : fullUsdg
    // A buy can only spend cash the desk has outside the vault. Redeeming from the vault is a later step.
    if (side === 'buy' && usdg > v.cashUsdg) usdg = v.cashUsdg
    if (usdg < MIN_TRADE_USDG) continue

    // Selling a token the mandate dropped sells the balance itself, so no dust is left behind.
    const sellAll = side === 'sell' && notInMandate && fullUsdg <= cap
    /**
     * A sell is sized off the 30 minute average, but the CONTRACT counts it at the larger of the USDG
     * received and its oracle value. Whenever the oracle sits above that average, a sell sized to exactly the
     * cap is counted as more than the cap and refused on-chain. So a sell leaves headroom, measured against
     * the highest price the contract might use. Without this the desk could propose a sale it can never make,
     * which matters most in a protective one.
     */
    const highest = h.feedE8 > h.twapE8 ? h.feedE8 : h.twapE8
    const amountIn =
      side === 'buy'
        ? usdg
        : sellAll
          ? h.balance
          : (usdg * PRICE_SCALE * BigInt(10_000 - SELL_HEADROOM_BPS)) / (highest * 10_000n)
    if (amountIn === 0n) continue

    needs.push({
      candidate: {
        id: `c${needs.length + 1}`,
        side,
        token: h.token,
        amountIn: side === 'sell' && amountIn > h.balance ? h.balance : amountIn,
        why: notInMandate
          ? engineCopy.need.dropped(h.token.displayName)
          : engineCopy.need.drifted(h.token.displayName, h.weightBps, h.targetBps, threshold),
      },
      driftBps: h.driftBps,
      thresholdBps: threshold,
      limitedByPerAction: fullUsdg > cap,
    })
  }
  // Sales first, because they free the cash that buys need. Within a side, the largest drift first.
  return needs
    .sort((a, b) =>
      a.candidate.side === b.candidate.side
        ? Math.abs(b.driftBps) - Math.abs(a.driftBps)
        : a.candidate.side === 'sell'
          ? -1
          : 1,
    )
    .map((n, i) => ({ ...n, candidate: { ...n.candidate, id: `c${i + 1}` } }))
}
