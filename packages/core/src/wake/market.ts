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
  const reference: MarketRead['reference'] =
    clock.session !== 'regular' && close
      ? {
          kind: 'last_regular_close',
          // A dividend or split since the close changes what one token stands for, so the reference is restated.
          priceE8: rescaleReference(close.priceE8, close.multiplierRaw, multiplierNow),
          at: close.boundaryAt,
        }
      : // Either the market is open, or this pool did not trade before the close and there is no honest
        // reference from it. Both fall back to the last official update, and the record says which it is.
        { kind: 'last_official_update', priceE8: feed.price, at: feedAt }

  // The price this trade would actually get, against the pool's own price. A buy pays above it, a sell gets below.
  const executionE8 =
    side === 'buy' ? (amountIn * PRICE_SCALE) / quoteOut : (quoteOut * PRICE_SCALE) / amountIn
  const against = side === 'buy' ? bpsBetween(executionE8, pool.spotE8) : bpsBetween(pool.spotE8, executionE8)
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
    costBps: Math.max(against, 0),
    movingBps: Math.abs(bpsBetween(pool.spotE8, pool.twapE8)),
    oraclePaused,
    halt,
    headlines,
  }
}
