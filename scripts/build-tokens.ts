/**
 * Builds the approved token list: packages/chain/tokens.json
 *
 * Why this exists. The Desk contract pins ONE fee tier and ONE price feed per token, chosen by the owner
 * and never by the agent, because an empty pool can be seeded by an attacker. So the list has to be
 * built from evidence, not assumed. The deep pool is not always the 0.05% tier.
 *
 * What it does. Takes every active Stock Token that has a Chainlink feed, scans all four Uniswap v3 fee
 * tiers, measures real round-trip cost at $100 and $1,000 through QuoterV2, reads the pool's TWAP
 * capacity, and keeps every name that passes. Read-only. Sends no transaction. Safe to rerun at any time.
 *
 * Run: pnpm tokens:build   Reads ALCHEMY_KEY from .env when present, otherwise uses the public RPC.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  aggregatorV3Abi,
  CHAINLINK_FEEDS_DIRECTORY,
  erc20Abi,
  FEE_TIERS,
  type FeeTier,
  makePublicClient,
  OFFICIAL_RPC,
  quoterV2Abi,
  RHJ_API,
  stockTokenAbi,
  UNISWAP_V3,
  USDG,
  v3FactoryAbi,
  v3PoolAbi,
} from '@desk/chain'
import { registerSecretsFromEnv } from '@desk/shared'
import { type Address, formatUnits, getAddress, zeroAddress } from 'viem'

registerSecretsFromEnv(process.env)

const SIZES = { s100: 100_000_000n, s1000: 1_000_000_000n } // USDG has 6 decimals
const MIN_POOL_USDG = 100_000 // dollars on the USDG side of the pinned pool
const MAX_ROUND_TRIP_BPS = 75 // the 0.3% tier costs about 60 bps in fees alone
const MIN_CARDINALITY = 30 // observations needed for a 30 minute TWAP to be meaningful
const MUST_CONSIDER = ['SPY', 'QQQ'] // the "Broad market" preset depends on these
/**
 * Depth decides who MAY be on the list, and since round 3 every token that passes is on it (the 20 strategies
 * need all of them). This order only sorts the list: broad funds first, then the largest companies, then a
 * Treasury bill fund, then the rest. A desk allows at most 16 of them on-chain (`deskTokenSet`).
 */
const PREFERRED = [
  'SPY',
  'QQQ',
  'NVDA',
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'META',
  'TSLA',
  'SGOV',
  'AMD',
  'PLTR',
  'MU',
  'INTC',
  'SPCX',
  'CRCL',
  'BABA',
  'USO',
  'SLV',
]
const DISPLAY: Record<string, string> = {
  NVDA: 'Nvidia',
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  AMZN: 'Amazon',
  GOOGL: 'Alphabet',
  META: 'Meta',
  TSLA: 'Tesla',
  AMD: 'AMD',
  SPY: 'S&P 500 fund',
  QQQ: 'Nasdaq 100 fund',
  PLTR: 'Palantir',
  COIN: 'Coinbase',
  MSTR: 'Strategy',
  TSM: 'TSMC',
  ORCL: 'Oracle',
  INTC: 'Intel',
  MU: 'Micron',
  ASML: 'ASML',
  BABA: 'Alibaba',
  SGOV: 'Treasury bill fund',
  SLV: 'Silver fund',
  USO: 'Oil fund',
  GME: 'GameStop',
  CRCL: 'Circle',
  SPCX: 'SpaceX',
}

// Alchemy first when a key is present, with the public RPC as the fallback transport.
const alchemy = process.env.ALCHEMY_KEY
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  : undefined
const client = makePublicClient(
  [process.env.RPC_URL, alchemy, OFFICIAL_RPC].filter((u): u is string => Boolean(u)),
)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const CHAIN_DIR = resolve(import.meta.dirname, '../packages/chain')
const FEEDS_SNAPSHOT = resolve(CHAIN_DIR, 'feeds.snapshot.json')
const TOKENS_FILE = resolve(CHAIN_DIR, 'tokens.json')

/**
 * The list before this run. Two rules protect desks already on mainnet, which store their pins on-chain:
 * 1. A pin never moves while the pinned pool still passes. The gate refuses any trade whose on-chain fee differs
 *    from ours (POOL_MISMATCH), so moving SGOV to a cheaper tier would silently stop every desk trading it.
 * 2. A token already listed is never dropped. Desks read balances only for listed tokens, so dropping one would
 *    hide a real holding. It stays with a `watch` note, and no strategy may use it (`pnpm strategies:verify`).
 */
type Listed = { symbol: string; address: string; pinnedFee: number; watch?: string } & Record<string, unknown>
const previous: Listed[] = existsSync(TOKENS_FILE)
  ? (JSON.parse(readFileSync(TOKENS_FILE, 'utf8')) as { tokens: Listed[] }).tokens
  : []
const previousPin = new Map(previous.map((t) => [t.address.toLowerCase(), t.pinnedFee]))

/** The network this is built on drops connections. Retry with backoff, never fail on the first timeout. */
async function fetchJson<T>(url: string, attempts = 5): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`${url} answered ${res.status}`)
      return (await res.json()) as T
    } catch (e) {
      lastError = e
      console.warn(`  fetch failed (${i + 1}/${attempts}): ${url}`)
      await sleep(1500 * (i + 1))
    }
  }
  throw lastError
}

async function inChunks<T, R>(items: T[], size: number, fn: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await fn(items.slice(i, i + size))))
    await sleep(250) // the public RPC is rate limited
  }
  return out
}
const multi = <C extends readonly unknown[]>(contracts: C) =>
  client.multicall({ contracts: contracts as never, allowFailure: true }) as Promise<
    Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: Error }>
  >
const ok = <T>(r: { status: string; result?: unknown } | undefined): T | undefined =>
  r && r.status === 'success' ? (r.result as T) : undefined

interface Asset {
  tokenSymbol: string
  tokenName: string
  status: string
  tokenDecimals: number
  deployments: Array<{ chainId: number; contractAddress: string }>
}
interface Feed {
  name: string
  proxyAddress: string
  decimals: number
}

async function main() {
  const assets = (await fetchJson<{ assets: Asset[] }>(`${RHJ_API}/assets`)).assets
  // The feed directory changes rarely. A fresh copy refreshes the snapshot. A failed fetch falls back to it.
  let feeds: Feed[]
  try {
    feeds = await fetchJson<Feed[]>(CHAINLINK_FEEDS_DIRECTORY)
    writeFileSync(FEEDS_SNAPSHOT, `${JSON.stringify(feeds, null, 2)}\n`)
  } catch {
    if (!existsSync(FEEDS_SNAPSHOT)) throw new Error('feed directory unreachable and no snapshot on disk')
    console.warn('  using packages/chain/feeds.snapshot.json. Every feed is still re-checked on-chain below.')
    feeds = JSON.parse(readFileSync(FEEDS_SNAPSHOT, 'utf8')) as Feed[]
  }

  const feedBySymbol = new Map<string, Feed>()
  for (const f of feeds) {
    const m = /^Robinhood\s+([A-Z.]+)\s*[/-]\s*USD$/.exec(f.name.trim())
    if (m?.[1] && f.proxyAddress) feedBySymbol.set(m[1], f)
  }

  const candidates = assets
    .filter((a) => a.status === 'ASSET_STATUS_ACTIVE' && feedBySymbol.has(a.tokenSymbol))
    .map((a) => ({
      symbol: a.tokenSymbol,
      rhName: a.tokenName,
      decimals: a.tokenDecimals,
      address: getAddress(a.deployments.find((d) => d.chainId === 4663)?.contractAddress ?? zeroAddress),
      feed: getAddress((feedBySymbol.get(a.tokenSymbol) as Feed).proxyAddress),
    }))
    .filter((c) => c.address !== zeroAddress)
  console.log(
    `assets ${assets.length}, stock token feeds ${feedBySymbol.size}, candidates ${candidates.length}`,
  )

  // 1. every pool on every tier
  const pairs = candidates.flatMap((c) => FEE_TIERS.map((fee) => ({ c, fee })))
  const poolRes = await inChunks(pairs, 80, (chunk) =>
    multi(
      chunk.map(({ c, fee }) => ({
        address: UNISWAP_V3.factory,
        abi: v3FactoryAbi,
        functionName: 'getPool',
        args: [USDG, c.address, fee],
      })),
    ),
  )
  const pools = pairs
    .map((p, i) => ({ ...p, pool: ok<Address>(poolRes[i]) ?? zeroAddress }))
    .filter((p) => p.pool !== zeroAddress)
  console.log(`pools found ${pools.length}`)

  // 2. depth, liquidity, TWAP capacity
  const stateRes = await inChunks(pools, 40, (chunk) =>
    multi(
      chunk.flatMap((p) => [
        { address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [p.pool] },
        { address: p.pool, abi: v3PoolAbi, functionName: 'liquidity' },
        { address: p.pool, abi: v3PoolAbi, functionName: 'slot0' },
      ]),
    ),
  )
  const withState = pools.map((p, i) => {
    const slot0 = ok<readonly [bigint, number, number, number, number, number, boolean]>(stateRes[i * 3 + 2])
    return {
      ...p,
      usdgInPool: Number(formatUnits(ok<bigint>(stateRes[i * 3]) ?? 0n, 6)),
      liquidity: ok<bigint>(stateRes[i * 3 + 1]) ?? 0n,
      cardinality: slot0?.[3] ?? 0,
    }
  })

  // 3. real round-trip cost, only where there is something to trade against
  const quotable = withState.filter((p) => p.usdgInPool >= 5_000 && p.liquidity > 0n)
  const buyRes = await inChunks(quotable, 12, (chunk) =>
    multi(
      chunk.flatMap((p) =>
        Object.values(SIZES).map((amountIn) => ({
          address: UNISWAP_V3.quoterV2,
          abi: quoterV2Abi,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: USDG, tokenOut: p.c.address, amountIn, fee: p.fee, sqrtPriceLimitX96: 0n }],
        })),
      ),
    ),
  )
  const buys = quotable.map((p, i) => ({
    ...p,
    out100: ok<readonly [bigint]>(buyRes[i * 2])?.[0] ?? 0n,
    out1000: ok<readonly [bigint]>(buyRes[i * 2 + 1])?.[0] ?? 0n,
  }))
  const sellable = buys.filter((p) => p.out100 > 0n && p.out1000 > 0n)
  const sellRes = await inChunks(sellable, 12, (chunk) =>
    multi(
      chunk.flatMap((p) =>
        [p.out100, p.out1000].map((amountIn) => ({
          address: UNISWAP_V3.quoterV2,
          abi: quoterV2Abi,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: p.c.address, tokenOut: USDG, amountIn, fee: p.fee, sqrtPriceLimitX96: 0n }],
        })),
      ),
    ),
  )
  const bps = (start: bigint, end: bigint) =>
    end === 0n ? 99_999 : Number(((start - end) * 1_000_000n) / start) / 100
  const measured = sellable.map((p, i) => ({
    ...p,
    roundTripBps100: bps(SIZES.s100, ok<readonly [bigint]>(sellRes[i * 2])?.[0] ?? 0n),
    roundTripBps1000: bps(SIZES.s1000, ok<readonly [bigint]>(sellRes[i * 2 + 1])?.[0] ?? 0n),
  }))

  // 4. feed and token facts
  const factRes = await inChunks(candidates, 30, (chunk) =>
    multi(
      chunk.flatMap((c) => [
        { address: c.feed, abi: aggregatorV3Abi, functionName: 'decimals' },
        { address: c.feed, abi: aggregatorV3Abi, functionName: 'description' },
        { address: c.feed, abi: aggregatorV3Abi, functionName: 'latestRoundData' },
        { address: c.address, abi: stockTokenAbi, functionName: 'uiMultiplier' },
      ]),
    ),
  )
  const facts = new Map(
    candidates.map((c, i) => {
      const round = ok<readonly [bigint, bigint, bigint, bigint, bigint]>(factRes[i * 4 + 2])
      return [
        c.symbol,
        {
          feedDecimals: ok<number>(factRes[i * 4]) ?? 0,
          feedDescription: ok<string>(factRes[i * 4 + 1]) ?? '',
          feedAnswer: round?.[1] ?? 0n,
          feedUpdatedAt: Number(round?.[3] ?? 0n),
          uiMultiplier: ok<bigint>(factRes[i * 4 + 3]) ?? 0n,
        },
      ] as const
    }),
  )

  // 5. pin one tier per token. Depth and TWAP capacity FILTER first, then the cheapest real round trip wins.
  // Cost alone is the wrong rule: it pinned Tesla's $19K pool over its $439K pool for a fraction of a bp.
  // A thin pool makes the 30 minute average cheap to move, and the desk values holdings on that average.
  const scan = candidates.map((c) => {
    const byCost = (a: (typeof measured)[number], b: (typeof measured)[number]) =>
      a.roundTripBps1000 - b.roundTripBps1000 || b.usdgInPool - a.usdgInPool
    const tiers = measured.filter((m) => m.c.symbol === c.symbol).sort(byCost)
    const deep = tiers.filter((t) => t.usdgInPool >= MIN_POOL_USDG && t.cardinality >= MIN_CARDINALITY)
    const pinned = tiers.find((t) => t.fee === previousPin.get(c.address.toLowerCase()))
    const best = pinned ?? deep[0] ?? tiers[0]
    const f = facts.get(c.symbol)
    const reasons: string[] = []
    if (!best) reasons.push('no pool with at least $5,000 of USDG')
    if (best && best.usdgInPool < MIN_POOL_USDG)
      reasons.push(`pinned pool holds $${Math.round(best.usdgInPool)} of USDG, under $${MIN_POOL_USDG}`)
    if (best && best.roundTripBps1000 > MAX_ROUND_TRIP_BPS)
      reasons.push(`round trip at $1,000 is ${best.roundTripBps1000} bps, over ${MAX_ROUND_TRIP_BPS}`)
    if (best && best.cardinality < MIN_CARDINALITY)
      reasons.push(`pool keeps ${best.cardinality} observations, too few for a 30 minute average`)
    if (f?.feedDecimals !== 8 || f.feedAnswer <= 0n) reasons.push('feed is not a healthy 8 decimal price')
    return { c, best, tiers, f, qualifies: reasons.length === 0, reasons }
  })

  const qualified = scan.filter((s) => s.qualifies)
  const listedBefore = (s: (typeof scan)[number]) => previousPin.has(s.c.address.toLowerCase())
  const watched = scan.filter((s) => !s.qualifies && listedBefore(s) && s.best && s.f)
  const rank = (sym: string) => (PREFERRED.indexOf(sym) === -1 ? PREFERRED.length : PREFERRED.indexOf(sym))
  const chosen = [...qualified, ...watched].sort(
    (a, b) => rank(a.c.symbol) - rank(b.c.symbol) || (b.best?.usdgInPool ?? 0) - (a.best?.usdgInPool ?? 0),
  )
  const note = (rt: number) =>
    rt <= 15 ? 'Very easy to trade' : rt <= 35 ? 'Easy to trade' : 'Costs more to trade'

  const tokens = chosen.map((s) => {
    const b = s.best as NonNullable<typeof s.best>
    const f = s.f as NonNullable<typeof s.f>
    return {
      symbol: s.c.symbol,
      displayName: DISPLAY[s.c.symbol] ?? s.c.rhName.split(' • ')[0] ?? s.c.symbol,
      address: s.c.address, // tokens are keyed by address everywhere, never by symbol
      decimals: s.c.decimals,
      feed: s.c.feed,
      feedDecimals: f.feedDecimals,
      feedDescription: f.feedDescription,
      pinnedFee: b.fee as FeeTier,
      pool: b.pool,
      usdgInPool: Math.round(b.usdgInPool),
      roundTripBps100: b.roundTripBps100,
      roundTripBps1000: b.roundTripBps1000,
      observationCardinality: b.cardinality,
      uiMultiplier: f.uiMultiplier.toString(),
      tradability: note(b.roundTripBps1000),
      ...(s.qualifies ? {} : { watch: s.reasons.join('; ') }),
    }
  })
  const lost = previous.filter(
    (p) => !tokens.some((t) => t.address.toLowerCase() === p.address.toLowerCase()),
  )
  if (lost.length) {
    // No fresh numbers for it at all (no pool left above $5,000). Keep the last entry so balances stay visible.
    for (const p of lost)
      tokens.push({
        ...(p as unknown as (typeof tokens)[number]),
        watch: 'no pool with at least $5,000 of USDG',
      })
  }

  const generatedAt = new Date().toISOString()
  const dir = CHAIN_DIR
  writeFileSync(
    resolve(dir, 'tokens.json'),
    `${JSON.stringify(
      {
        generatedAt,
        chainId: 4663,
        thresholds: {
          MIN_POOL_USDG,
          MAX_ROUND_TRIP_BPS,
          MIN_CARDINALITY,
        },
        tokens,
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    resolve(dir, 'tokens.scan.json'),
    `${JSON.stringify(
      {
        generatedAt,
        candidates: scan.map((s) => ({
          symbol: s.c.symbol,
          address: s.c.address,
          feed: s.c.feed,
          qualifies: s.qualifies,
          reasons: s.reasons,
          tiers: s.tiers.map((t) => ({
            fee: t.fee,
            pool: t.pool,
            usdgInPool: Math.round(t.usdgInPool),
            roundTripBps100: t.roundTripBps100,
            roundTripBps1000: t.roundTripBps1000,
            cardinality: t.cardinality,
          })),
        })),
      },
      null,
      2,
    )}\n`,
  )

  console.log(
    `\nqualified ${qualified.length} of ${candidates.length}. listed ${tokens.length}, of which on watch: ${
      tokens
        .filter((t) => t.watch)
        .map((t) => t.symbol)
        .join(', ') || 'none'
    }\n`,
  )
  console.table(
    tokens.map((t) => ({
      symbol: t.symbol,
      name: t.displayName,
      fee: t.pinnedFee,
      usdg: t.usdgInPool,
      rt100: t.roundTripBps100,
      rt1000: t.roundTripBps1000,
      obs: t.observationCardinality,
      note: t.watch ? `WATCH: ${t.watch}` : t.tradability,
    })),
  )
  // Desk.sol MAX_TOKENS: a new desk allows every listed token at creation, so a 17th would make createDesk revert.
  if (tokens.length > 16) console.warn(`WARNING: ${tokens.length} tokens listed, a desk can allow only 16.`)
  const missed = MUST_CONSIDER.filter((m) => !tokens.some((t) => t.symbol === m))
  if (missed.length)
    console.warn(`WARNING: ${missed.join(', ')} did not qualify. The "Broad market" preset needs a rethink.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
