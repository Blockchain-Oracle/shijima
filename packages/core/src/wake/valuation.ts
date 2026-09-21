/**
 * What the desk is worth and how it is spread, right now.
 *
 * Holdings are valued on the pool's 30 MINUTE AVERAGE, never on the Chainlink feed. The feed is frozen all
 * weekend, so a loss limit measured on it could never fire when it matters. The feed is still read, as a sanity
 * band: an average more than 8% from the feed is the state where the contract refuses the agent's trades.
 */
import {
  type ApprovedToken,
  type DeskState,
  type FeedReading,
  type PoolPrice,
  readFeed,
  readPoolPrice,
  VAULT,
  vaultAbi,
} from '@desk/chain'
import { engineCopy, errorText, type Mandate } from '@desk/shared'
import type { PublicClient } from 'viem'

export const PRICE_SOURCE = 'pool_twap_30m'
const PRICE_SCALE = 10n ** 20n
const BAND_BPS = 800

export interface HoldingValue {
  token: ApprovedToken
  balance: bigint
  /** The valuation price: 30 minute pool average, 8 decimals. */
  twapE8: bigint
  spotE8: bigint
  feedE8: bigint
  feedUpdatedAt: number
  valueUsdg: bigint
  weightBps: number
  /** 0 for a token the desk holds but the mandate no longer names. */
  targetBps: number
  /** weight minus target. Positive means over target. */
  driftBps: number
  /** How far the valuation price sits from the last official update, in basis points. */
  gapToFeedBps: number
  /** True while the average is within the contract's 8% band of the feed. */
  insideBand: boolean
}

/** Either a token's two prices, or why they could not be read. A closed union, so neither half is optional. */
type PriceRead =
  | { token: ApprovedToken; pool: PoolPrice; feed: FeedReading }
  | { token: ApprovedToken; error: string }

/** A holding whose price could not be read. It is NOT valued and NOT traded, and the record says so. */
export interface UnpricedHolding {
  token: ApprovedToken
  balance: bigint
  why: string
}

export interface Valuation {
  at: Date
  totalUsdg: bigint
  cashUsdg: bigint
  vaultUsdg: bigint
  cashWeightBps: number
  cashTargetBps: number
  holdings: HoldingValue[]
  /**
   * Tokens whose price could not be read this time. Their value is NOT in `totalUsdg`, because a number we
   * cannot source is not a number we show. Every weight is therefore a share of what could be valued, and the
   * desk refuses to trade these tokens until a price returns.
   */
  unpriced: UnpricedHolding[]
}

const bps = (part: bigint, whole: bigint) => (whole === 0n ? 0 : Number((part * 10_000n) / whole))

/** Values every token the mandate names, plus anything else the desk still holds. */
export async function readValuation(
  pub: PublicClient,
  state: DeskState,
  mandate: Mandate,
  approved: ApprovedToken[],
  now: Date,
): Promise<Valuation> {
  const targets = new Map(mandate.targets.tokens.map((t) => [t.token.toLowerCase(), t.weightBps]))
  const relevant = approved.filter(
    (t) => targets.has(t.address.toLowerCase()) || (state.holdings[t.address.toLowerCase()] ?? 0n) > 0n,
  )
  const [prices, vaultUsdg] = await Promise.all([
    // One unreadable pool must not fail the whole check. A pool too young to answer a 30 minute average, or an
    // RPC that drops, takes that one token out of the picture and leaves the rest of the desk working.
    Promise.all(
      relevant.map(async (t): Promise<PriceRead> => {
        try {
          const [pool, feed] = await Promise.all([readPoolPrice(pub, t), readFeed(pub, t.feed)])
          return { token: t, pool, feed }
        } catch (e) {
          return { token: t, error: errorText(e) }
        }
      }),
    ),
    state.vaultShares === 0n
      ? 0n
      : pub.readContract({
          address: VAULT,
          abi: vaultAbi,
          functionName: 'convertToAssets',
          args: [state.vaultShares],
        }),
  ])
  const priced = prices.flatMap((p) => ('pool' in p ? [p] : []))
  const unpriced: UnpricedHolding[] = prices.flatMap((p) =>
    'pool' in p
      ? []
      : [
          {
            token: p.token,
            balance: state.holdings[p.token.address.toLowerCase()] ?? 0n,
            why: engineCopy.priceUnreadable(p.token.displayName, p.error),
          },
        ],
  )

  const valued = priced.map(({ token, pool, feed }) => {
    const balance = state.holdings[token.address.toLowerCase()] ?? 0n
    return { token, balance, pool, feed, valueUsdg: (balance * pool.twapE8) / PRICE_SCALE }
  })
  const cashUsdg = state.usdg + vaultUsdg
  const totalUsdg = valued.reduce((sum, v) => sum + v.valueUsdg, cashUsdg)

  return {
    at: now,
    totalUsdg,
    cashUsdg: state.usdg,
    vaultUsdg,
    cashWeightBps: bps(cashUsdg, totalUsdg),
    cashTargetBps: mandate.targets.cashBps,
    unpriced,
    holdings: valued.map(({ token, balance, pool, feed, valueUsdg }) => {
      const weightBps = bps(valueUsdg, totalUsdg)
      const targetBps = targets.get(token.address.toLowerCase()) ?? 0
      const offFeed = feed.price === 0n ? 0 : Number(((pool.twapE8 - feed.price) * 10_000n) / feed.price)
      return {
        token,
        balance,
        twapE8: pool.twapE8,
        spotE8: pool.spotE8,
        feedE8: feed.price,
        feedUpdatedAt: feed.updatedAt,
        valueUsdg,
        weightBps,
        targetBps,
        driftBps: weightBps - targetBps,
        gapToFeedBps: offFeed,
        insideBand: Math.abs(offFeed) < BAND_BPS,
      }
    }),
  }
}
