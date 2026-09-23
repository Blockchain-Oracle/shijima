/**
 * Checks every strategy in packages/shared/src/presets.ts against mainnet before it ships. Read-only. Sends no
 * transaction. Safe to rerun at any time.
 *
 * For each token a strategy holds, on the pinned pool the desk will trade through:
 *   - the price feed: 8 decimals, a positive answer, younger than the 6 days the Desk contract accepts (wall
 *     clock), and updated within its heartbeat (24h, from feeds.snapshot.json) plus an hour, counted in MARKET
 *     time: the feed is 24/5 and moves on a 0.5% change or the heartbeat, so a weekend never counts as stale;
 *   - the pool: at least $100,000 of USDG, at least 30 observations for the 30 minute average, and a round trip
 *     at $1,000 of at most 0.75%, quoted through QuoterV2. The deepest tier is shown beside it for reference.
 * For each strategy: weights plus cash add to 100%, at most 16 tokens (Desk.sol MAX_TOKENS), every token listed
 * and not on watch, and no two strategies the same.
 *
 * Exits 1 when any token a strategy uses is unusable, or any strategy is malformed.
 *
 * Run: pnpm strategies:verify   Reads ALCHEMY_KEY or RPC_URL from .env when present, otherwise the public RPC.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  APPROVED_TOKENS,
  type ApprovedToken,
  aggregatorV3Abi,
  erc20Abi,
  FEE_TIERS,
  makePublicClient,
  OFFICIAL_RPC,
  quoterV2Abi,
  UNISWAP_V3,
  USDG,
  v3FactoryAbi,
  v3PoolAbi,
} from '@desk/chain'
import { marketAgeSeconds, PRESETS, registerSecretsFromEnv } from '@desk/shared'
import { type Address, formatUnits, zeroAddress } from 'viem'

registerSecretsFromEnv(process.env)

const MIN_POOL_USDG = 100_000
const MAX_ROUND_TRIP_BPS = 75
const MIN_CARDINALITY = 30
const MAX_TOKENS = 16 // Desk.sol
const MAX_FEED_AGE_S = 6 * 24 * 3600 // Desk.sol refuses an older feed
const HEARTBEAT_GRACE_S = 3600
const heartbeats = new Map(
  (
    JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../packages/chain/feeds.snapshot.json'), 'utf8'),
    ) as Array<{ proxyAddress: string; heartbeat?: number }>
  ).map((f) => [f.proxyAddress.toLowerCase(), f.heartbeat ?? 86_400]),
)
const ONE_THOUSAND = 1_000_000_000n // USDG has 6 decimals

const alchemy = process.env.ALCHEMY_KEY
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  : undefined
const client = makePublicClient(
  [process.env.RPC_URL, alchemy, OFFICIAL_RPC].filter((u): u is string => Boolean(u)),
)
const multi = <C extends readonly unknown[]>(contracts: C) =>
  client.multicall({ contracts: contracts as never, allowFailure: true }) as Promise<
    Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: Error }>
  >
const ok = <T>(r: { status: string; result?: unknown } | undefined): T | undefined =>
  r && r.status === 'success' ? (r.result as T) : undefined
const hours = (s: number) => `${(s / 3600).toFixed(1)}h`

async function checkToken(t: ApprovedToken, now: Date) {
  const problems: string[] = []
  const [dec, round, usdg, slot0, ...pools] = await multi([
    { address: t.feed, abi: aggregatorV3Abi, functionName: 'decimals' },
    { address: t.feed, abi: aggregatorV3Abi, functionName: 'latestRoundData' },
    { address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [t.pool] },
    { address: t.pool, abi: v3PoolAbi, functionName: 'slot0' },
    ...FEE_TIERS.map((fee) => ({
      address: UNISWAP_V3.factory,
      abi: v3FactoryAbi,
      functionName: 'getPool',
      args: [USDG, t.address, fee],
    })),
  ])

  // the feed
  const answer = ok<readonly [bigint, bigint, bigint, bigint, bigint]>(round)
  const updatedAt = Number(answer?.[3] ?? 0n)
  const wallAge = updatedAt ? now.getTime() / 1000 - updatedAt : Number.POSITIVE_INFINITY
  const marketAge = updatedAt ? marketAgeSeconds(new Date(updatedAt * 1000), now) : Number.POSITIVE_INFINITY
  if (ok<number>(dec) !== 8) problems.push('feed is not 8 decimals')
  if (!answer || answer[1] <= 0n || updatedAt === 0) problems.push('feed has no positive price')
  else if (wallAge > MAX_FEED_AGE_S) problems.push(`feed is ${hours(wallAge)} old, the contract refuses it`)
  else if (marketAge > (heartbeats.get(t.feed.toLowerCase()) ?? 86_400) + HEARTBEAT_GRACE_S)
    problems.push(`feed not updated for ${hours(marketAge)} of market time`)

  // the pinned pool
  const usdgInPool = Number(formatUnits(ok<bigint>(usdg) ?? 0n, 6))
  const cardinality = ok<readonly [bigint, number, number, number]>(slot0)?.[3] ?? 0
  if (usdgInPool < MIN_POOL_USDG)
    problems.push(`pool holds $${Math.round(usdgInPool)}, under $${MIN_POOL_USDG}`)
  if (cardinality < MIN_CARDINALITY)
    problems.push(`pool keeps ${cardinality} observations, under ${MIN_CARDINALITY}`)

  // the round trip at $1,000 on the pinned tier: buy with USDG, then sell what came back
  let roundTripBps = Number.POSITIVE_INFINITY
  try {
    const quote = (tokenIn: Address, tokenOut: Address, amountIn: bigint) =>
      client.simulateContract({
        address: UNISWAP_V3.quoterV2,
        abi: quoterV2Abi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, amountIn, fee: t.pinnedFee, sqrtPriceLimitX96: 0n }],
      })
    const bought = (await quote(USDG, t.address, ONE_THOUSAND)).result[0]
    const back = (await quote(t.address, USDG, bought)).result[0]
    roundTripBps = Number(((ONE_THOUSAND - back) * 1_000_000n) / ONE_THOUSAND) / 100
  } catch {
    problems.push('no quote on the pinned pool')
  }
  if (roundTripBps > MAX_ROUND_TRIP_BPS && Number.isFinite(roundTripBps))
    problems.push(`round trip at $1,000 is ${roundTripBps} bps, over ${MAX_ROUND_TRIP_BPS}`)

  // the deepest tier, for reference
  const tierPools = FEE_TIERS.map((fee, i) => ({ fee, pool: ok<Address>(pools[i]) ?? zeroAddress })).filter(
    (p) => p.pool !== zeroAddress,
  )
  const depths = await multi(
    tierPools.map((p) => ({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [p.pool] })),
  )
  const deepest = tierPools
    .map((p, i) => ({ ...p, usdg: Number(formatUnits(ok<bigint>(depths[i]) ?? 0n, 6)) }))
    .sort((a, b) => b.usdg - a.usdg)[0]

  return {
    symbol: t.symbol,
    feedAge: Number.isFinite(marketAge) ? `${hours(marketAge)} mkt / ${hours(wallAge)} wall` : 'none',
    pinned: `${t.pinnedFee / 10_000}%`,
    poolUsdg: Math.round(usdgInPool),
    deepest: deepest ? `${deepest.fee / 10_000}% $${Math.round(deepest.usdg)}` : 'none',
    rt1000bps: Number.isFinite(roundTripBps) ? roundTripBps : 'none',
    obs: cardinality,
    problems,
  }
}

async function main() {
  const now = new Date()
  const bySymbol = new Map(APPROVED_TOKENS.map((t) => [t.symbol, t]))
  const failures: string[] = []

  // the strategies themselves
  const seen = new Map<string, string>()
  for (const p of PRESETS) {
    const symbols = Object.keys(p.weights)
    const total = p.cashBps + Object.values(p.weights).reduce((a, b) => a + b, 0)
    if (total !== 10_000) failures.push(`${p.id}: weights and cash add to ${total} bps, not 10000`)
    if (symbols.length > MAX_TOKENS)
      failures.push(`${p.id}: ${symbols.length} tokens, a desk holds at most 16`)
    for (const s of symbols) {
      const t = bySymbol.get(s)
      if (!t) failures.push(`${p.id}: ${s} is not on the approved list`)
      else if (t.watch) failures.push(`${p.id}: ${s} is on watch (${t.watch})`)
    }
    const key = JSON.stringify([p.cashBps, Object.entries(p.weights).sort()])
    const twin = seen.get(key)
    if (twin) failures.push(`${p.id}: the same basket as ${twin}`)
    seen.set(key, p.id)
  }
  if (new Set(PRESETS.map((p) => p.id)).size !== PRESETS.length) failures.push('two strategies share an id')

  // every token any strategy uses, checked live
  const used = [...new Set(PRESETS.flatMap((p) => Object.keys(p.weights)))]
  const tokens = used.flatMap((s) => bySymbol.get(s) ?? [])
  const rows = []
  for (const t of tokens) rows.push(await checkToken(t, now))
  const bad = new Map(rows.filter((r) => r.problems.length).map((r) => [r.symbol, r.problems]))
  for (const [s, problems] of bad) failures.push(`${s}: ${problems.join('; ')}`)

  console.log(
    `\nstrategies:verify  ${now.toISOString()}  ${PRESETS.length} strategies, ${tokens.length} tokens\n`,
  )
  console.table(
    rows.map((r) => ({
      token: r.symbol,
      'feed age': r.feedAge,
      pinned: r.pinned,
      'pool USDG': r.poolUsdg,
      'deepest tier': r.deepest,
      'rt $1k bps': r.rt1000bps,
      obs: r.obs,
      status: r.problems.length ? 'FAIL' : 'ok',
      'used by': PRESETS.filter((p) => p.weights[r.symbol]).length,
    })),
  )
  console.table(
    PRESETS.map((p) => {
      const blockers = Object.keys(p.weights).filter(
        (s) => bad.has(s) || !bySymbol.get(s) || bySymbol.get(s)?.watch,
      )
      return {
        id: p.id,
        name: p.name,
        tokens: Object.keys(p.weights).length,
        cash: `${p.cashBps / 100}%`,
        status: blockers.length ? `BLOCKED by ${blockers.join(', ')}` : 'ok',
      }
    }),
  )
  if (failures.length) {
    console.error(`\n${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`)
    process.exit(1)
  }
  console.log('\nevery strategy is usable on mainnet now.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
