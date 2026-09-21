/**
 * The reference price: what the pool itself was trading at when the US market last closed.
 *
 * It is the last swap in the token's pinned pool AT OR BEFORE the 16:00 New York boundary. Anyone can recompute
 * it from the chain's logs at any time, so it is a fact and not a snapshot we ask to be trusted.
 *
 * Why not the Chainlink feed: the feed only moves on a 0.5% change, so at the close it can already be half a
 * percent away from where the pool traded. A weekend "gap" measured against it would be part staleness.
 * The feed stays what the CONTRACT enforces its 8% band against. This is what the desk REASONS about.
 */
import { type Hex, type PublicClient, parseAbiItem } from 'viem'
import { stockTokenAbi } from './abis'
import { USDG } from './addresses'
import type { ApprovedToken } from './tokens'
import { priceE8FromSqrt } from './twap'

const swapEvent = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
)

export interface BlockMark {
  number: bigint
  timestamp: bigint
}

/** The newest block whose timestamp is at or before `at`. A binary search: about 27 reads on this chain. */
export async function blockAtOrBefore(pub: PublicClient, at: Date): Promise<BlockMark> {
  const target = BigInt(Math.floor(at.getTime() / 1000))
  const latest = await pub.getBlock()
  if (latest.timestamp <= target) return { number: latest.number, timestamp: latest.timestamp }
  let lo = 1n
  let hi = latest.number
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n
    const block = await pub.getBlock({ blockNumber: mid })
    if (block.timestamp <= target) lo = mid
    else hi = mid - 1n
  }
  const found = await pub.getBlock({ blockNumber: lo })
  return { number: found.number, timestamp: found.timestamp }
}

export interface CloseReference {
  token: string
  boundaryAt: Date
  /** USDG per whole token, 8 decimals, right after the last swap at or before the boundary. */
  priceE8: bigint
  blockNumber: bigint
  txHash: Hex
  swapAt: Date
  /** The token's multiplier at the boundary. If it changes later, the reference is rescaled by the ratio. */
  multiplierRaw: bigint
}

const FIRST_WINDOW = 40_000n
const LAST_WINDOW = 3_000_000n

/** undefined means the pool did not trade in the days before the boundary, so there is no honest reference. */
export async function readCloseReference(
  pub: PublicClient,
  token: ApprovedToken,
  boundaryAt: Date,
  boundary: BlockMark,
): Promise<CloseReference | undefined> {
  for (let window = FIRST_WINDOW; window <= LAST_WINDOW; window *= 5n) {
    const fromBlock = boundary.number > window ? boundary.number - window : 1n
    const logs = await pub.getLogs({
      address: token.pool,
      event: swapEvent,
      fromBlock,
      toBlock: boundary.number,
    })
    const last = logs.at(-1)
    if (last?.args.sqrtPriceX96 === undefined) continue
    const [block, multiplierRaw] = await Promise.all([
      pub.getBlock({ blockNumber: last.blockNumber }),
      pub.readContract({
        address: token.address,
        abi: stockTokenAbi,
        functionName: 'uiMultiplier',
        blockNumber: boundary.number,
      }),
    ])
    return {
      token: token.address,
      boundaryAt,
      priceE8: priceE8FromSqrt(last.args.sqrtPriceX96, BigInt(token.address) < BigInt(USDG)),
      blockNumber: last.blockNumber,
      txHash: last.transactionHash,
      swapAt: new Date(Number(block.timestamp) * 1000),
      multiplierRaw,
    }
  }
  return undefined
}

/** A reference taken before a dividend or split, restated in today's tokens. */
export function rescaleReference(priceE8: bigint, multiplierThen: bigint, multiplierNow: bigint): bigint {
  return multiplierThen === 0n ? priceE8 : (priceE8 * multiplierNow) / multiplierThen
}
