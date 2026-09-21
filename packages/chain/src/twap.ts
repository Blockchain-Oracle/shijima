/**
 * The pool's 30 minute average price. Holdings are valued on THIS, never on the Chainlink feed: the feed is
 * frozen all weekend, so a loss stop measured on it could never fire when it matters. An average over half an
 * hour also cannot be moved by one large trade in one block, which a spot price can.
 *
 * Prices are integers scaled to 8 decimals, like the feed, so the two compare directly: USDG per whole token.
 */
import type { PublicClient } from 'viem'
import { v3PoolAbi } from './abis'
import { USDG } from './addresses'
import type { ApprovedToken } from './tokens'

export const TWAP_SECONDS = 1800
const Q192 = 2n ** 192n
const MAX_UINT256 = 2n ** 256n - 1n
/** Token 18 decimals, USDG 6, result 8: 18 - 6 + 8. The same scale Desk.sol calls PRICE_SCALE. */
const PRICE_SCALE = 10n ** 20n
const MAX_TICK = 887272

/** Uniswap v3 TickMath.getSqrtRatioAtTick, ported bit for bit. Checked against every approved pool's slot0. */
const TICK_FACTORS: [number, bigint][] = [
  [0x2, 0xfff97272373d413259a46990580e213an],
  [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000, 0x48a170391f7dc42444e8fa2n],
]

export function sqrtRatioAtTick(tick: number): bigint {
  const abs = Math.abs(tick)
  if (!Number.isInteger(tick) || abs > MAX_TICK) throw new Error(`tick ${tick} is out of range`)
  let ratio = abs & 0x1 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 1n << 128n
  for (const [bit, factor] of TICK_FACTORS) if (abs & bit) ratio = (ratio * factor) >> 128n
  if (tick > 0) ratio = MAX_UINT256 / ratio
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n)
}

/** USDG per whole token, 8 decimals, from a sqrt price. `tokenIsToken0` says which way round the pool is. */
export function priceE8FromSqrt(sqrtPriceX96: bigint, tokenIsToken0: boolean): bigint {
  const squared = sqrtPriceX96 * sqrtPriceX96 // raw token1 per raw token0, times 2^192
  return tokenIsToken0 ? (squared * PRICE_SCALE) / Q192 : (Q192 * PRICE_SCALE) / squared
}

export interface PoolPrice {
  /** The average over the window. This is the valuation price. */
  twapE8: bigint
  /** The price this instant. Shown beside the average, never used to value holdings. */
  spotE8: bigint
  seconds: number
}

export async function readPoolPrice(
  pub: PublicClient,
  token: ApprovedToken,
  seconds = TWAP_SECONDS,
): Promise<PoolPrice> {
  const pool = { address: token.pool, abi: v3PoolAbi } as const
  const [observed, slot0] = await pub.multicall({
    allowFailure: false,
    contracts: [
      { ...pool, functionName: 'observe', args: [[seconds, 0]] },
      { ...pool, functionName: 'slot0' },
    ],
  })
  const [older, newer] = observed[0]
  if (older === undefined || newer === undefined)
    throw new Error(`pool ${token.pool} returned no observations`)
  const delta = newer - older
  const window = BigInt(seconds)
  // Round toward negative infinity, as Uniswap's OracleLibrary does. Bigint division rounds toward zero.
  const avgTick = Number(delta / window) - (delta < 0n && delta % window !== 0n ? 1 : 0)
  // Uniswap orders a pair by address. USDG is the other side of every one of our pools.
  const tokenIsToken0 = BigInt(token.address) < BigInt(USDG)
  return {
    twapE8: priceE8FromSqrt(sqrtRatioAtTick(avgTick), tokenIsToken0),
    spotE8: priceE8FromSqrt(slot0[0], tokenIsToken0),
    seconds,
  }
}
