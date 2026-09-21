/**
 * What the market looks like for one candidate, right now. Reads only. Every source may fail on its own.
 *
 * Three different prices, kept apart on purpose:
 *   pool price   what the pinned pool trades at this instant, and its 30 minute average
 *   reference    what that SAME pool traded at when the US market last closed. The weekend gap is measured
 *                against this. During the regular session the market is open, so the reference is the last
 *                official update itself
 *   feed         the last official update from Chainlink. The CONTRACT enforces its 8% band against it. It only
 *                moves on a half percent change, so at the close it can already be a quarter percent away from
 *                where the pool really traded. Measured on 20 Sep: between -25 and +22 bps across ten tokens
 * The gap is pool price against reference. What the trade itself costs is measured separately, for its exact
 * size, so a fee is never mistaken for a discount.
 */
import {
  type FeedReading,
  fetchHaltFlag,
  type HaltReading,
  type PoolPrice,
  quotePinned,
  readFeed,
  readPoolPrice,
  rescaleReference,
  stockTokenAbi,
} from '@desk/chain'
import {
  lastRegularClose,
  type MarketClock,
  marketAgeSeconds,
  marketClock,
  nextRegularOpen,
} from '@desk/shared'
import type { PublicClient } from 'viem'
import { fetchCompanyNews, type Headline } from '../news/finnhub'
import type { ReferenceSource } from './reference'
import type { Candidate } from './types'

/** Under this, the pool is "in line" with the reference and the gap is treated as noise. */
export const IN_LINE_BPS = 50
const PRICE_SCALE = 10n ** 20n

export interface MarketRead {
  at: Date
  clock: MarketClock
  nextRegularOpen: Date
  pool: PoolPrice
  reference: { kind: 'last_regular_close' | 'last_official_update'; priceE8: bigint; at: Date }
  /** Pool price against the reference, in basis points. Negative means the pool is below the reference. */
  gapBps: number
  inLine: boolean
  feed: FeedReading
  /** Age of the feed counted in MARKET time, so a weekend does not make a Friday price look days stale. */
  feedAgeMarketSeconds: number
  /** Pool price against the feed. This is what the contract's 8% band is measured on. */
  feedGapBps: number
  /** A real executable quote for the candidate's exact size, on the pinned tier. */
  quoteOut: bigint
  /** What THIS trade costs against the pool's own price: the fee plus the price its size moves. Never negative. */
  costBps: number
  /** How far the price this instant is from its own 30 minute average. Large means someone is pushing the pool. */
  movingBps: number
  oraclePaused: boolean | undefined
  halt: HaltReading | undefined
  /** undefined means news was unavailable. An empty list means it was checked and nothing named the company. */
  headlines: Headline[] | undefined
}

const bpsBetween = (a: bigint, b: bigint) => (b === 0n ? 0 : Number(((a - b) * 10_000n) / b))

/**
 * Which price the gap is measured against. While the market is shut and the pool traded before the close, it is
 * what the pool traded at the close, restated for any dividend or split since. Otherwise it is the last official
 * update. The charts use this same function, so a chart can never show a different reference from a decision.
 */
export function pickReference(
  session: MarketClock['session'],
  close: { priceE8: bigint; multiplierRaw: bigint; boundaryAt: Date } | undefined,
  multiplierNow: bigint,
  feed: FeedReading,
): MarketRead['reference'] {
  const feedAt = new Date(feed.updatedAt * 1000)
  return session !== 'regular' && close
    ? {
        kind: 'last_regular_close',
        priceE8: rescaleReference(close.priceE8, close.multiplierRaw, multiplierNow),
        at: close.boundaryAt,
      }
    : { kind: 'last_official_update', priceE8: feed.price, at: feedAt }
}

/** What a trade of this size costs against the pool's own price, in basis points. Never negative. */
export function costBpsFor(side: 'buy' | 'sell', amountIn: bigint, quoteOut: bigint, spotE8: bigint): number {
  const executionE8 =
    side === 'buy' ? (amountIn * PRICE_SCALE) / quoteOut : (quoteOut * PRICE_SCALE) / amountIn
  const against = side === 'buy' ? bpsBetween(executionE8, spotE8) : bpsBetween(spotE8, executionE8)
  return Math.max(against, 0)
}

export async function readMarket(
  pub: PublicClient,
  candidate: Candidate,
  now: Date,
  sources: { finnhubKey?: string | undefined; reference: ReferenceSource },
): Promise<MarketRead> {
  const { token, side, amountIn } = candidate
  const clock = marketClock(now)
  const closeAt = lastRegularClose(now)
  const [feed, pool, quoteOut, multiplierNow, close, oraclePaused, halt, headlines] = await Promise.all([
    readFeed(pub, token.feed),
    readPoolPrice(pub, token),
    quotePinned(pub, token, side, amountIn),
    pub.readContract({ address: token.address, abi: stockTokenAbi, functionName: 'uiMultiplier' }),
    // A reference that cannot be computed is not fatal: the desk falls back to the last official update.
    sources.reference(token, closeAt).catch(() => undefined),
    pub
      .readContract({ address: token.address, abi: stockTokenAbi, functionName: 'oraclePaused' })
      .catch(() => undefined),
    fetchHaltFlag(token.symbol),
    sources.finnhubKey ? fetchCompanyNews(token.symbol, [token.displayName], sources.finnhubKey) : undefined,
  ])

  const feedAt = new Date(feed.updatedAt * 1000)
  // A dividend or split since the close changes what one token stands for, so the reference is restated. With no
  // honest close from this pool, or with the market open, it falls back to the last official update.
  const reference = pickReference(clock.session, close, multiplierNow, feed)
  const gapBps = bpsBetween(pool.spotE8, reference.priceE8)

  return {
    at: now,
    clock,
    nextRegularOpen: nextRegularOpen(now),
    pool,
    reference,
    gapBps,
    inLine: Math.abs(gapBps) < IN_LINE_BPS,
    feed,
    feedAgeMarketSeconds: marketAgeSeconds(feedAt, now),
    feedGapBps: bpsBetween(pool.spotE8, feed.price),
    quoteOut,
    costBps: costBpsFor(side, amountIn, quoteOut, pool.spotE8),
    movingBps: Math.abs(bpsBetween(pool.spotE8, pool.twapE8)),
    oraclePaused,
    halt,
    headlines,
  }
}
