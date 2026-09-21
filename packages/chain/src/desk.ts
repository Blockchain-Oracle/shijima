/**
 * Reads and operator writes for one Desk. Everything here takes explicit clients, so the same code runs
 * against mainnet, against a local fork, and in tests.
 */
import {
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  parseEventLogs,
  type Transport,
  type WalletClient,
} from 'viem'
import { aggregatorV3Abi, erc20Abi, quoterV2Abi } from './abis'
import { UNISWAP_V3, USDG, VAULT } from './addresses'
import { deskAbi } from './generated/desk-abi'
import { APPROVED_TOKENS, type ApprovedToken } from './tokens'

export type OperatorWallet = WalletClient<Transport, Chain, Account>

export interface DeskState {
  owner: Address
  operator: Address
  paused: boolean
  seq: bigint
  head: Hex
  perActionCapUsdg: bigint
  dailyCapUsdg: bigint
  remainingDailyCap: bigint
  usdg: bigint
  vaultShares: bigint
  /** Raw token units, keyed by lowercase token address. Only non-zero balances are present. */
  holdings: Record<string, bigint>
}

export async function readDeskState(client: PublicClient, desk: Address): Promise<DeskState> {
  const d = { address: desk, abi: deskAbi } as const
  // Two batches, not one. Mixing two ABIs in a single array defeats viem's type inference, and the casts
  // needed to silence that would hide exactly the kind of mistake types exist to catch.
  const [fields, balances] = await Promise.all([
    client.multicall({
      allowFailure: false,
      contracts: [
        { ...d, functionName: 'owner' },
        { ...d, functionName: 'operator' },
        { ...d, functionName: 'paused' },
        { ...d, functionName: 'seq' },
        { ...d, functionName: 'head' },
        { ...d, functionName: 'perActionCapUsdg' },
        { ...d, functionName: 'dailyCapUsdg' },
        { ...d, functionName: 'remainingDailyCap' },
      ],
    }),
    client.multicall({
      allowFailure: false,
      contracts: [USDG, VAULT, ...APPROVED_TOKENS.map((t) => t.address)].map(
        (token) => ({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [desk] }) as const,
      ),
    }),
  ])
  const [owner, operator, paused, seq, head, perActionCapUsdg, dailyCapUsdg, remainingDailyCap] = fields
  const [usdg = 0n, vaultShares = 0n, ...tokenBalances] = balances
  const holdings: Record<string, bigint> = {}
  APPROVED_TOKENS.forEach((t, i) => {
    const b = tokenBalances[i] ?? 0n
    if (b > 0n) holdings[t.address.toLowerCase()] = b
  })
  return {
    owner,
    operator,
    paused,
    seq,
    head,
    perActionCapUsdg,
    dailyCapUsdg,
    remainingDailyCap,
    usdg,
    vaultShares,
    holdings,
  }
}

export interface FeedReading {
  price: bigint
  updatedAt: number
}
export async function readFeed(client: PublicClient, feed: Address): Promise<FeedReading> {
  const [, answer, , updatedAt] = await client.readContract({
    address: feed,
    abi: aggregatorV3Abi,
    functionName: 'latestRoundData',
  })
  return { price: answer, updatedAt: Number(updatedAt) }
}

/** A real executable quote on the tier the owner pinned. The agent can never trade on any other tier. */
export async function quotePinned(
  client: PublicClient,
  token: ApprovedToken,
  side: 'buy' | 'sell',
  amountIn: bigint,
) {
  const [tokenIn, tokenOut] = side === 'buy' ? [USDG, token.address] : [token.address, USDG]
  const [amountOut] = await client.readContract({
    address: UNISWAP_V3.quoterV2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn, tokenOut, amountIn, fee: token.pinnedFee, sqrtPriceLimitX96: 0n }],
  })
  return amountOut
}

/** Pool price versus the feed, in whole basis points. Both prices are per RAW token, so they compare directly. */
export function gapBps(usdgAmount: bigint, tokenAmount: bigint, feedPrice: bigint): number {
  if (tokenAmount === 0n || feedPrice <= 0n)
    throw new Error('gapBps needs a non-zero token amount and a positive feed price')
  const poolPrice = (usdgAmount * 10n ** 20n) / tokenAmount // 8 decimals, like the feed
  return Number(((poolPrice - feedPrice) * 10_000n) / feedPrice)
}

export interface TradeArgs {
  desk: Address
  token: Address
  amountIn: bigint
  minOut: bigint
  deadline: number
  decisionHash: Hex
}
export interface TradeResult {
  txHash: Hex
  blockNumber: bigint
  gasUsed: bigint
  seq: bigint
  amountOut: bigint
  feedPrice: bigint
  eventHash: Hex
}

/** Simulate first, so a revert costs nothing and names its cause. Then send, wait, and read the event back. */
async function trade(
  side: 'buy' | 'sell',
  pub: PublicClient,
  wallet: OperatorWallet,
  a: TradeArgs,
): Promise<TradeResult> {
  const { request } = await pub.simulateContract({
    account: wallet.account,
    address: a.desk,
    abi: deskAbi,
    functionName: side,
    args: [a.token, a.amountIn, a.minOut, a.deadline, a.decisionHash],
  })
  const txHash = await wallet.writeContract(request)
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error(`${side} reverted on-chain, tx ${txHash}`)
  const base = { txHash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed }
  if (side === 'buy') {
    const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Bought', logs: receipt.logs })
    if (!log) throw new Error(`no Bought event in tx ${txHash}`)
    return {
      ...base,
      seq: log.args.seq,
      amountOut: log.args.tokenOut,
      feedPrice: log.args.feedPrice,
      eventHash: log.args.decisionHash,
    }
  }
  const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Sold', logs: receipt.logs })
  if (!log) throw new Error(`no Sold event in tx ${txHash}`)
  return {
    ...base,
    seq: log.args.seq,
    amountOut: log.args.usdgOut,
    feedPrice: log.args.feedPrice,
    eventHash: log.args.decisionHash,
  }
}
export const deskBuy = (pub: PublicClient, wallet: OperatorWallet, a: TradeArgs) =>
  trade('buy', pub, wallet, a)
export const deskSell = (pub: PublicClient, wallet: OperatorWallet, a: TradeArgs) =>
  trade('sell', pub, wallet, a)

/** Seals a non-action into the on-chain record chain. "I looked, and chose not to act" is a record too. */
export async function deskCheckpoint(
  pub: PublicClient,
  wallet: OperatorWallet,
  desk: Address,
  decisionHash: Hex,
) {
  const { request } = await pub.simulateContract({
    account: wallet.account,
    address: desk,
    abi: deskAbi,
    functionName: 'checkpoint',
    args: [decisionHash],
  })
  const txHash = await wallet.writeContract(request)
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error(`checkpoint reverted on-chain, tx ${txHash}`)
  const [log] = parseEventLogs({ abi: deskAbi, eventName: 'Checkpoint', logs: receipt.logs })
  if (!log) throw new Error(`no Checkpoint event in tx ${txHash}`)
  return {
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    seq: log.args.seq,
    eventHash: log.args.decisionHash,
  }
}

/** How the OWNER configured one token on this desk. The contract trades only through this fee tier. */
export interface DeskTokenConfig {
  fee: number
  feed: Address
  enabled: boolean
}
export async function readTokenConfig(
  client: PublicClient,
  desk: Address,
  token: Address,
): Promise<DeskTokenConfig> {
  const [fee, feed, enabled] = await client.readContract({
    address: desk,
    abi: deskAbi,
    functionName: 'tokenCfg',
    args: [token],
  })
  return { fee, feed, enabled }
}

/**
 * True when the code at `desk` is exactly an EIP-1167 minimal proxy of `implementation`. A desk row whose
 * address does not pass this was not made by our factory, and the engine must never act for it.
 */
export async function isCloneOf(
  client: PublicClient,
  desk: Address,
  implementation: Address,
): Promise<boolean> {
  const code = await client.getCode({ address: desk })
  const expected = `0x363d3d373d3d3d363d73${implementation.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`
  return code?.toLowerCase() === expected
}
