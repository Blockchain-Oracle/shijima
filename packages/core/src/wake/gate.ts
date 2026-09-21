/**
 * The limits check. Plain arithmetic, no AI. It can veto. It never originates and never resizes.
 *
 * It must predict what Desk.sol will do, so it repeats the contract's own integer maths, rounding included:
 *   - a buy counts `usdgIn` against the caps
 *   - a sell counts the LARGER of the USDG received and the oracle value of what was sold. On a weekend the
 *     pool can sit below the frozen feed, and then the oracle value is the bigger number. A gate that sized a
 *     sell by the quote alone would pass a trade the contract then refuses, at the moment it matters most.
 *     This was found live on 20 Sep, with Nvidia 65 bps under its feed.
 *   - the operator's minimum output is raised to 8% inside the feed price. A quote beyond that band reverts
 *     by design, so the gate says so first, in words.
 * Every input is required. An unknown halt flag denies: the desk does not act on facts it cannot verify.
 */
import { engineCopy } from '@desk/shared'
import type { Side } from './types'

export const BAND_BPS = 800n
/**
 * Two refusals that are TIGHTER than anything the chain enforces, for an ordinary rebalance.
 * A pool more than 3% from its reference, in either direction, is a broken reading and not a bargain.
 * A trade that costs more than 1% against the pool's own price is too large for the pool, or the pool is thin.
 * A protective sale, one the owner's own rule demanded, is not held to these: getting out matters more.
 */
export const MAX_GAP_BPS = 300
export const MAX_COST_BPS = 100
const BPS = 10_000n
/** Token 18 decimals, feed 8, USDG 6: 18 + 8 - 6. */
const PRICE_SCALE = 10n ** 20n

export interface GateInput {
  side: Side
  amountIn: bigint
  /** What the pinned pool quotes for exactly `amountIn`. */
  quoteOut: bigint
  /** The feed price, 8 decimals. */
  feedPrice: bigint
  slippageBps: bigint
  desk: {
    paused: boolean
    perActionCapUsdg: bigint
    remainingDailyCap: bigint
    usdg: bigint
    /** The desk's balance of the candidate token, raw units. */
    tokenBalance: bigint
  }
  /** Pool price against the reference, and what this exact trade costs against the pool price. */
  gapBps: number
  costBps: number
  /** True when the owner's own rule demanded this sale. */
  protective: boolean
  /** What this holding and the whole desk are worth now, and the largest share the owner allows. Buys only. */
  position?: { holdingUsdg: bigint; totalUsdg: bigint; maxPositionBps: number } | undefined
  /** undefined means the halt API could not be reached. */
  tradingHalt: boolean | undefined
  /** undefined means the token has no such flag, which the contract also tolerates. */
  oraclePaused: boolean | undefined
}

export interface GateResult {
  result: 'allow' | 'deny'
  reasons: string[]
  /** What the contract will count against the per-action and daily caps. */
  countedUsdg: bigint
  /** The least output the contract will accept from the operator, from the feed and the 8% band. */
  oracleFloor: bigint
  /** The floor we send: our slippage floor or the contract's, whichever is higher. */
  minOut: bigint
}

export function gate(g: GateInput): GateResult {
  if (g.amountIn <= 0n || g.feedPrice <= 0n) {
    return {
      result: 'deny',
      reasons: [engineCopy.gate.nothingToTrade],
      countedUsdg: 0n,
      oracleFloor: 0n,
      minOut: 0n,
    }
  }
  const oracleValue = (g.amountIn * g.feedPrice) / PRICE_SCALE // sells only
  const countedUsdg = g.side === 'buy' ? g.amountIn : g.quoteOut > oracleValue ? g.quoteOut : oracleValue
  const oracleFloor =
    g.side === 'buy'
      ? (g.amountIn * PRICE_SCALE * (BPS - BAND_BPS)) / (g.feedPrice * BPS)
      : (g.amountIn * g.feedPrice * (BPS - BAND_BPS)) / (PRICE_SCALE * BPS)
  const ourFloor = (g.quoteOut * (BPS - g.slippageBps)) / BPS
  const minOut = ourFloor > oracleFloor ? ourFloor : oracleFloor

  const reasons: string[] = []
  if (g.desk.paused) reasons.push(engineCopy.gate.paused)
  if (g.tradingHalt === undefined) reasons.push(engineCopy.gate.haltUnknown)
  if (g.tradingHalt) reasons.push(engineCopy.gate.halted)
  if (g.oraclePaused) reasons.push(engineCopy.gate.oraclePaused)
  if (g.quoteOut < oracleFloor) reasons.push(engineCopy.gate.beyondBand)
  if (!g.protective && Math.abs(g.gapBps) > MAX_GAP_BPS) {
    reasons.push(engineCopy.gate.farFromReference)
  }
  if (!g.protective && g.costBps > MAX_COST_BPS) reasons.push(engineCopy.gate.tooCostly)
  if (countedUsdg > g.desk.perActionCapUsdg) reasons.push(engineCopy.gate.overPerAction)
  if (countedUsdg > g.desk.remainingDailyCap) reasons.push(engineCopy.gate.overDaily)
  if (g.side === 'buy' && g.position && g.position.totalUsdg > 0n) {
    const afterBps = ((g.position.holdingUsdg + g.amountIn) * 10_000n) / g.position.totalUsdg
    if (afterBps > BigInt(g.position.maxPositionBps)) reasons.push(engineCopy.gate.holdingTooLarge)
  }
  if (g.side === 'buy' && g.amountIn > g.desk.usdg) reasons.push(engineCopy.gate.notEnoughCash)
  if (g.side === 'sell' && g.amountIn > g.desk.tokenBalance) reasons.push(engineCopy.gate.notEnoughTokens)

  return { result: reasons.length === 0 ? 'allow' : 'deny', reasons, countedUsdg, oracleFloor, minOut }
}
