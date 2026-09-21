/**
 * The price logger. Every five minutes, one row per Stock Token: the pool's price and its 30-minute average,
 * the last official update, the reference the gap is measured against, the gap, what $100 and $1,000 would
 * cost to trade, and whether trading is halted. The charts draw from these rows.
 *
 * It uses the engine's own reads and the engine's own choice of reference (`pickReference`), so a chart can
 * never show a different price or a different reference from the one a decision saw. Reads only.
 *
 * The same function reads history: given a block, every read is pinned to it. The halt flag has no history,
 * so a backfilled row stores it as unknown.
 */
import {
  type ApprovedToken,
  fetchHaltFlag,
  quotePinned,
  readFeed,
  readPoolPrice,
  stockTokenAbi,
  TWAP_SECONDS,
} from '@desk/chain'
import { type Db, type PricePointInsert, priceSlotWritten, savePricePoints } from '@desk/db'
import { errorText, lastRegularClose, marketClock } from '@desk/shared'
import type { PublicClient } from 'viem'
import { costBpsFor, pickReference } from '../wake/market'
import type { ReferenceSource } from '../wake/reference'

export const PRICE_SLOT_MS = 5 * 60 * 1000
const SMALL = 100_000_000n // $100 of USDG
const LARGE = 1_000_000_000n // $1,000 of USDG

/** The five-minute slot a moment belongs to. Every writer agrees on it, so a slot is written once. */
export function priceSlot(at: Date): Date {
  return new Date(Math.floor(at.getTime() / PRICE_SLOT_MS) * PRICE_SLOT_MS)
}

const bps = (a: bigint, b: bigint) => (b === 0n ? 0 : Number(((a - b) * 10_000n) / b))

/** One token at one moment. `blockNumber` pins every chain read to history; omitted, it reads now. */
export async function readPricePoint(
  pub: PublicClient,
  token: ApprovedToken,
  at: Date,
  reference: ReferenceSource,
  blockNumber?: bigint,
): Promise<PricePointInsert> {
  const pinned = blockNumber === undefined ? {} : { blockNumber }
  const clock = marketClock(at)
  const [feed, pool, small, large, multiplierNow, oraclePaused, close, halt] = await Promise.all([
    readFeed(pub, token.feed, blockNumber),
    readPoolPrice(pub, token, TWAP_SECONDS, blockNumber),
    quotePinned(pub, token, 'buy', SMALL, blockNumber),
    quotePinned(pub, token, 'buy', LARGE, blockNumber),
    pub.readContract({ address: token.address, abi: stockTokenAbi, functionName: 'uiMultiplier', ...pinned }),
    pub
      .readContract({ address: token.address, abi: stockTokenAbi, functionName: 'oraclePaused', ...pinned })
      .catch(() => undefined),
    clock.session === 'regular' ? undefined : reference(token, lastRegularClose(at)).catch(() => undefined),
    blockNumber === undefined ? fetchHaltFlag(token.symbol).catch(() => undefined) : undefined,
  ])
  const ref = pickReference(clock.session, close, multiplierNow, feed)
  return {
    token: token.address,
    at,
    blockNumber: blockNumber === undefined ? null : Number(blockNumber),
    poolMidE8: pool.spotE8,
    twap30E8: pool.twapE8,
    feedPriceE8: feed.price,
    feedUpdatedAt: new Date(feed.updatedAt * 1000),
    gapBps: bps(pool.spotE8, ref.priceE8),
    costBps100: costBpsFor('buy', SMALL, small, pool.spotE8),
    costBps1000: costBpsFor('buy', LARGE, large, pool.spotE8),
    halted: halt?.isTradingHalt ?? null,
    oraclePaused: oraclePaused ?? null,
    referenceE8: ref.priceE8,
    referenceKind: ref.kind,
    referenceAt: ref.at,
  }
}

export interface PriceLogDeps {
  db: Db
  pub: PublicClient
  approved: ApprovedToken[]
  reference: ReferenceSource
  log?: (event: string, detail?: Record<string, unknown>) => void
}

/**
 * Writes this five-minute slot, once. A token whose reads fail is skipped and named, so one broken feed never
 * blanks the others. Returns how many rows were written: 0 when the slot was already done.
 */
export async function logPrices(deps: PriceLogDeps, now = new Date()): Promise<number> {
  const at = priceSlot(now)
  if (await priceSlotWritten(deps.db, at)) return 0
  const rows: PricePointInsert[] = []
  for (const token of deps.approved) {
    try {
      rows.push(await readPricePoint(deps.pub, token, at, deps.reference))
    } catch (e) {
      deps.log?.('price_unread', { token: token.symbol, error: errorText(e) })
    }
  }
  return savePricePoints(deps.db, rows)
}
