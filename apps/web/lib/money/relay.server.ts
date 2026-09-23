/**
 * Relay, the one bridge: money from Base, Arbitrum, Ethereum or BNB Chain arrives in an agent as USDG, and USDG
 * leaves Robinhood Chain as USDC or ETH elsewhere. Money goes straight from the owner's wallet to Relay's contracts
 * and on to the recipient, never through us.
 *
 * The chains and their tokens come from Relay's own list, so decimals are Relay's (BNB Chain's USDC has 18), never
 * a constant of ours. Relay refuses Stock Tokens: they are not in its list for Robinhood Chain.
 */
import { CHAIN_ID } from '@desk/chain'
import { type Address, decodeFunctionData, encodeFunctionData, erc20Abi, type Hex, isAddress } from 'viem'
import type { MoveStep } from './types'

const RELAY = 'https://api.relay.link'
const CHAINS_TTL_MS = 60 * 60 * 1000

/** The chains the wallet in the browser knows (`lib/wagmi.ts`). Relay lists sixty; we offer these. */
export const RELAY_CHAIN_IDS = [CHAIN_ID, 8453, 42161, 1, 56] as const

export interface RelayToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  native: boolean
}

export interface RelayChain {
  id: number
  name: string
  explorerUrl: string
  tokens: RelayToken[]
}

interface RawCurrency {
  address: string
  symbol: string
  name: string
  decimals: number
  supportsBridging?: boolean
}
interface RawChain {
  id: number
  displayName: string
  explorerUrl: string
  disabled?: boolean
  depositEnabled?: boolean
  currency: RawCurrency
  erc20Currencies?: RawCurrency[]
  featuredTokens?: RawCurrency[]
}

async function relay<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${RELAY}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { message?: string }
  if (!res.ok) throw new Error(json.message ?? `Relay answered ${res.status}`)
  return json
}

let chainsCache: { at: number; chains: RelayChain[] } | undefined

/** Relay's chains we offer, each with the tokens Relay moves there. Read once an hour. */
export async function relayChains(): Promise<RelayChain[]> {
  if (chainsCache && Date.now() - chainsCache.at < CHAINS_TTL_MS) return chainsCache.chains
  const { chains } = await relay<{ chains: RawChain[] }>('/chains')
  const picked = chains
    .filter((c) => (RELAY_CHAIN_IDS as readonly number[]).includes(c.id) && !c.disabled)
    .map((c): RelayChain => {
      const seen = new Set<string>()
      const tokens: RelayToken[] = []
      for (const t of [c.currency, ...(c.featuredTokens ?? []), ...(c.erc20Currencies ?? [])]) {
        const address = t.address.toLowerCase()
        if (!isAddress(address) || seen.has(address) || t.supportsBridging === false) continue
        seen.add(address)
        tokens.push({
          address: address as Address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          native: address === '0x0000000000000000000000000000000000000000',
        })
      }
      return { id: c.id, name: c.displayName, explorerUrl: c.explorerUrl, tokens }
    })
    .sort((a, b) => RELAY_CHAIN_IDS.indexOf(a.id as never) - RELAY_CHAIN_IDS.indexOf(b.id as never))
  chainsCache = { at: Date.now(), chains: picked }
  return picked
}

/** One token Relay moves on one chain, or undefined when it does not. */
export async function relayToken(chainId: number, token: string): Promise<RelayToken | undefined> {
  const chain = (await relayChains()).find((c) => c.id === chainId)
  return chain?.tokens.find((t) => t.address === token.toLowerCase())
}

interface RawQuote {
  requestId?: string
  steps: {
    id: string
    description?: string
    kind: string
    requestId?: string
    items: { data: { to: Address; data: Hex; value?: string; chainId: number } }[]
  }[]
  fees?: { gas?: { amountUsd?: string } }
  details: {
    currencyIn: { amount: string; amountUsd?: string; currency: { decimals: number; symbol: string } }
    currencyOut: {
      amount: string
      amountUsd?: string
      minimumAmount?: string
      currency: { decimals: number; symbol: string }
    }
    totalImpact?: { usd: string; percent: string }
    timeEstimate?: number
  }
}

export interface RelayQuote {
  requestId: string
  steps: MoveStep[]
  amountIn: bigint
  amountInUsd: number | null
  amountOut: bigint
  minimumOut: bigint
  outDecimals: number
  outSymbol: string
  amountOutUsd: number | null
  /** Relay's cut and price impact plus the origin chain's network fee, in dollars. */
  feeUsd: number
  timeEstimate: number | null
}

/**
 * A Relay quote, EXACT_INPUT, as steps the browser signs. An approval Relay asks for is rewritten to the exact
 * amount going in, whatever Relay suggested, and every step must be on the origin chain.
 */
export async function relayQuote(input: {
  user: Address
  recipient: Address
  originChainId: number
  destinationChainId: number
  originCurrency: Address
  destinationCurrency: Address
  amountRaw: bigint
}): Promise<RelayQuote> {
  const q = await relay<RawQuote>('/quote', {
    user: input.user,
    recipient: input.recipient,
    originChainId: input.originChainId,
    destinationChainId: input.destinationChainId,
    originCurrency: input.originCurrency,
    destinationCurrency: input.destinationCurrency,
    amount: input.amountRaw.toString(),
    tradeType: 'EXACT_INPUT',
  })
  const requestId = q.requestId ?? q.steps.find((s) => s.requestId)?.requestId
  if (!requestId) throw new Error('Relay gave no request id')
  const steps: MoveStep[] = []
  for (const step of q.steps) {
    if (step.kind !== 'transaction')
      throw new Error(`Relay asked for a ${step.kind} step, which we do not sign`)
    for (const item of step.items) {
      if (item.data.chainId !== input.originChainId) throw new Error('Relay asked for a different chain')
      if (step.id === 'approve') {
        const decoded = decodeFunctionData({ abi: erc20Abi, data: item.data.data })
        if (decoded.functionName !== 'approve') throw new Error('Relay’s approval is not an approval')
        const [spender] = decoded.args as readonly [Address, bigint]
        steps.push({
          chainId: item.data.chainId,
          to: item.data.to,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, input.amountRaw],
          }),
          value: '0',
          kind: 'approve',
          label: step.description ?? 'Approve',
          approve: { token: item.data.to, spender, amountRaw: input.amountRaw.toString() },
        })
      } else {
        steps.push({
          chainId: item.data.chainId,
          to: item.data.to,
          data: item.data.data,
          value: item.data.value ?? '0',
          kind: 'relay',
          label: step.description ?? 'Send to Relay',
        })
      }
    }
  }
  const d = q.details
  const impact = d.totalImpact ? Math.abs(Number(d.totalImpact.usd)) : 0
  const gas = Number(q.fees?.gas?.amountUsd ?? 0)
  return {
    requestId,
    steps,
    amountIn: BigInt(d.currencyIn.amount),
    amountInUsd: d.currencyIn.amountUsd ? Number(d.currencyIn.amountUsd) : null,
    amountOut: BigInt(d.currencyOut.amount),
    minimumOut: BigInt(d.currencyOut.minimumAmount ?? d.currencyOut.amount),
    outDecimals: d.currencyOut.currency.decimals,
    outSymbol: d.currencyOut.currency.symbol,
    amountOutUsd: d.currencyOut.amountUsd ? Number(d.currencyOut.amountUsd) : null,
    feeUsd: (Number.isFinite(impact) ? impact : 0) + (Number.isFinite(gas) ? gas : 0),
    timeEstimate: d.timeEstimate ?? null,
  }
}

export type RelayState = 'success' | 'pending' | 'failure' | 'refund' | 'unknown'

/** Where a Relay request stands. Anything Relay cannot say is `unknown`, never "failed". */
export async function relayStatus(requestId: string): Promise<{ state: RelayState; txHashes: string[] }> {
  try {
    const s = await relay<{ status?: string; txHashes?: string[] }>(
      `/intents/status/v3?requestId=${encodeURIComponent(requestId)}`,
    )
    const state: RelayState =
      s.status === 'success'
        ? 'success'
        : s.status === 'failure'
          ? 'failure'
          : s.status === 'refund'
            ? 'refund'
            : s.status === 'pending' || s.status === 'waiting' || s.status === 'delayed'
              ? 'pending'
              : 'unknown'
    return { state, txHashes: s.txHashes ?? [] }
  } catch {
    return { state: 'unknown', txHashes: [] }
  }
}

export const relayRequestUrl = (requestId: string) => `https://relay.link/transaction/${requestId}`
