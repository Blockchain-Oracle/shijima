/**
 * What a wallet holds on Robinhood Chain, in dollars, read from the chain at the moment of asking.
 *
 * Every Stock Token is priced at what SELLING it now would give: a quote on the pool the desk trades it on, for
 * the whole amount held. That is "what you'd get", not a feed price, and it already counts the pool's depth and
 * fee. ETH is priced on the Chainlink ETH/USD feed, the one outside number, because nothing here sells ETH.
 */
import type { Address, PublicClient } from 'viem'
import { aggregatorV3Abi, erc20Abi, quoterV2Abi, stockTokenAbi, vaultAbi } from './abis'
import { ETH_USD_FEED, NATIVE, UNISWAP_V3, USDG, USDG_DECIMALS, VAULT } from './addresses'
import { readDeskState } from './desk'
import { APPROVED_TOKENS, type ApprovedToken, tokenByAddress } from './tokens'

export interface WalletHolding {
  kind: 'usdg' | 'eth' | 'stock'
  symbol: string
  name: string
  /** The token's contract; NATIVE for ETH. */
  token: Address
  decimals: number
  /** Raw units on the chain. */
  amountRaw: bigint
  /**
   * The Stock Token's share count as the issuer shows it: raw units times its live UI multiplier, which moves with
   * splits and dividends. Equal to the raw amount for USDG and ETH. 18 decimals for a stock.
   */
  displayRaw: bigint
  /** What selling it now would give, in USDG raw units (6 decimals). Null when no price could be read. */
  valueUsdg: bigint | null
  /** Where the dollars came from, so no number is shown without its source. */
  priceSource: 'usdg' | 'eth_usd_feed' | 'pool_quote' | 'none'
}

export interface WalletReading {
  owner: Address
  blockNumber: bigint
  readAt: Date
  /** USDG first, then ETH, then each Stock Token held, largest first. */
  holdings: WalletHolding[]
  /** The sum of every priced holding. */
  totalUsdg: bigint
  /** Symbols held that could not be priced this time: the total leaves them out. */
  unpriced: string[]
}

const ONE_E18 = 10n ** 18n

/**
 * Each Stock Token amount, sold now on its pinned pool, in USDG. One batched read (viem's multicall batching).
 * A quote the pool refuses, for an amount beyond its depth for instance, is null rather than a guess.
 */
export async function priceStocksNow(
  client: PublicClient,
  held: Record<string, bigint>,
  blockNumber?: bigint,
): Promise<Record<string, bigint | null>> {
  const entries = Object.entries(held).filter(([, amount]) => amount > 0n)
  const tokens = entries.map(([address]) => tokenByAddress(address))
  const quotes = await client.multicall({
    allowFailure: true,
    ...(blockNumber === undefined ? {} : { blockNumber }),
    contracts: entries.map(([address, amount], i) => ({
      address: UNISWAP_V3.quoterV2,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle' as const,
      args: [
        {
          tokenIn: address as Address,
          tokenOut: USDG,
          amountIn: amount,
          fee: (tokens[i] as ApprovedToken | undefined)?.pinnedFee ?? 500,
          sqrtPriceLimitX96: 0n,
        },
      ] as const,
    })),
  })
  const out: Record<string, bigint | null> = {}
  entries.forEach(([address], i) => {
    const q = quotes[i]
    out[address.toLowerCase()] =
      tokens[i] && q?.status === 'success' ? (q.result as readonly [bigint, ...unknown[]])[0] : null
  })
  return out
}

/** ETH in wei to USDG raw units at the feed's price (8 decimals). */
const ethToUsdg = (wei: bigint, priceE8: bigint) => (wei * priceE8) / 10n ** 20n

function stockHolding(t: ApprovedToken, amount: bigint, multiplier: bigint | null, value: bigint | null) {
  return {
    kind: 'stock' as const,
    symbol: t.symbol,
    name: t.displayName,
    token: t.address,
    decimals: t.decimals,
    amountRaw: amount,
    displayRaw: multiplier ? (amount * multiplier) / ONE_E18 : amount,
    valueUsdg: value,
    priceSource: value === null ? ('none' as const) : ('pool_quote' as const),
  }
}

const sortStocks = (a: WalletHolding, b: WalletHolding) => Number((b.valueUsdg ?? 0n) - (a.valueUsdg ?? 0n))

/**
 * A wallet's USDG, ETH and every listed Stock Token, each in dollars, at one block. Balances, multipliers and the
 * ETH feed are one multicall; the sale quotes for what is held are a second.
 */
export async function readWallet(client: PublicClient, owner: Address): Promise<WalletReading> {
  const blockNumber = await client.getBlockNumber()
  const at = { blockNumber } as const
  const [balances, multipliers, feed, eth] = await Promise.all([
    client.multicall({
      ...at,
      allowFailure: false,
      contracts: [USDG, ...APPROVED_TOKENS.map((t) => t.address)].map(
        (token) => ({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }) as const,
      ),
    }),
    client.multicall({
      ...at,
      allowFailure: true,
      contracts: APPROVED_TOKENS.map(
        (t) => ({ address: t.address, abi: stockTokenAbi, functionName: 'uiMultiplier' }) as const,
      ),
    }),
    client
      .readContract({ ...at, address: ETH_USD_FEED, abi: aggregatorV3Abi, functionName: 'latestRoundData' })
      .then((r) => r[1])
      .catch(() => null),
    client.getBalance({ address: owner, ...at }),
  ])
  const [usdg = 0n, ...stockBalances] = balances
  const held: Record<string, bigint> = {}
  APPROVED_TOKENS.forEach((t, i) => {
    const b = stockBalances[i] ?? 0n
    if (b > 0n) held[t.address.toLowerCase()] = b
  })
  const prices = await priceStocksNow(client, held, blockNumber)

  const stocks: WalletHolding[] = []
  APPROVED_TOKENS.forEach((t, i) => {
    const amount = held[t.address.toLowerCase()]
    if (!amount) return
    const m = multipliers[i]
    stocks.push(
      stockHolding(
        t,
        amount,
        m?.status === 'success' ? (m.result as bigint) : null,
        prices[t.address.toLowerCase()] ?? null,
      ),
    )
  })
  stocks.sort(sortStocks)

  const holdings: WalletHolding[] = [
    {
      kind: 'usdg',
      symbol: 'USDG',
      name: 'Global Dollar',
      token: USDG,
      decimals: USDG_DECIMALS,
      amountRaw: usdg,
      displayRaw: usdg,
      valueUsdg: usdg,
      priceSource: 'usdg',
    },
    {
      kind: 'eth',
      symbol: 'ETH',
      name: 'Ether',
      token: NATIVE,
      decimals: 18,
      amountRaw: eth,
      displayRaw: eth,
      valueUsdg: feed !== null && feed > 0n ? ethToUsdg(eth, feed) : null,
      priceSource: feed !== null && feed > 0n ? 'eth_usd_feed' : 'none',
    },
    ...stocks,
  ]
  return {
    owner,
    blockNumber,
    readAt: new Date(),
    holdings,
    totalUsdg: holdings.reduce((s, h) => s + (h.valueUsdg ?? 0n), 0n),
    unpriced: holdings.filter((h) => h.valueUsdg === null && h.amountRaw > 0n).map((h) => h.symbol),
  }
}

export interface DeskWalletReading {
  desk: Address
  blockNumber: bigint
  readAt: Date
  /** USDG loose in the agent. */
  cashUsdg: bigint
  /** The savings vault's shares, and what they redeem for now (`convertToAssets`). */
  vaultShares: bigint
  savingsUsdg: bigint
  /** Each Stock Token the agent holds, priced as a sale now, largest first. */
  stocks: WalletHolding[]
  totalUsdg: bigint
  unpriced: string[]
}

/** One agent's money, from the chain: cash, savings and stocks, each in dollars. */
export async function readDeskWallet(client: PublicClient, desk: Address): Promise<DeskWalletReading> {
  const [state, blockNumber] = await Promise.all([readDeskState(client, desk), client.getBlockNumber()])
  const [savingsUsdg, prices, multipliers] = await Promise.all([
    state.vaultShares > 0n
      ? client.readContract({
          address: VAULT,
          abi: vaultAbi,
          functionName: 'convertToAssets',
          args: [state.vaultShares],
        })
      : Promise.resolve(0n),
    priceStocksNow(client, state.holdings),
    client.multicall({
      allowFailure: true,
      contracts: Object.keys(state.holdings).map(
        (a) => ({ address: a as Address, abi: stockTokenAbi, functionName: 'uiMultiplier' }) as const,
      ),
    }),
  ])
  const stocks = Object.entries(state.holdings)
    .flatMap(([address, amount], i) => {
      const t = tokenByAddress(address)
      if (!t) return []
      const m = multipliers[i]
      return [
        stockHolding(
          t,
          amount,
          m?.status === 'success' ? (m.result as bigint) : null,
          prices[address] ?? null,
        ),
      ]
    })
    .sort(sortStocks)
  const stockTotal = stocks.reduce((s, h) => s + (h.valueUsdg ?? 0n), 0n)
  return {
    desk,
    blockNumber,
    readAt: new Date(),
    cashUsdg: state.usdg,
    vaultShares: state.vaultShares,
    savingsUsdg,
    stocks,
    totalUsdg: state.usdg + savingsUsdg + stockTotal,
    unpriced: stocks.filter((s) => s.valueUsdg === null).map((s) => s.symbol),
  }
}
