/**
 * The shapes a money move takes between the server that plans it and the browser that signs it. Plain JSON: every
 * amount is a decimal string of raw units, so nothing is lost crossing a server action.
 *
 * One pattern for every move: the server plans the steps and saves the move as `signing`; the browser signs each
 * step in order and reports each hash; the server reads the chain (or Relay) and sets one of five honest endings.
 */
import type { Address, Hex } from 'viem'

export type MoveKind = 'fund' | 'send' | 'bridge_in' | 'bridge_out' | 'get_gas'
export type MoveEnding = 'done' | 'nothing_sent' | 'approved_only' | 'on_its_way' | 'may_have_been_sent'

/** Where the money starts: a chain, a token on it (the zero address for the native coin), and raw units. */
export interface MoveSource {
  chainId: number
  token: Address
  amountRaw: string
}

/** What the screens may ask for. Withdraw and "sell one stock" go through the agent's chain cards instead. */
export type MoveInput =
  /** Into an agent, from any token: USDG, ETH, a Stock Token on Robinhood Chain, or a Relay token elsewhere. */
  | { kind: 'fund'; deskId: string; source: MoveSource }
  /** From the owner's wallet on Robinhood Chain to any address: USDG, ETH or a Stock Token. */
  | { kind: 'send'; source: MoveSource; recipient: Address }
  /** USDG on Robinhood Chain out to another chain, as USDC or its native coin, to the owner's own wallet there. */
  | { kind: 'bridge_out'; amountRaw: string; to: { chainId: number; token: Address } }
  /**
   * A dollar (or `amountUsdg` raw) of USDG swapped to ETH in the owner's wallet. With no ETH to pay for that swap,
   * `origin` names where Relay brings gas from instead.
   */
  | { kind: 'get_gas'; amountUsdg?: string; origin?: MoveSource }

export interface MoveStep {
  chainId: number
  to: Address
  data: Hex
  /** Wei, as a decimal string. */
  value: string
  kind: 'approve' | 'swap' | 'transfer' | 'relay'
  /** What signing this does, in the owner's words. */
  label: string
  /**
   * For an approval: what it allows. The browser reads the allowance first and skips the step when it already
   * covers the amount; approvals are always for the exact amount, never unlimited.
   */
  approve?: { token: Address; spender: Address; amountRaw: string }
}

export interface MovePlan {
  moveId: string
  kind: MoveKind
  fromChainId: number
  toChainId: number
  recipient: Address
  steps: MoveStep[]
  /** Read before signing: what you send, what lands, the minimum, the cost, how long. */
  lines: string[]
  /** What you send, in words, and its raw units and decimals. */
  send: { symbol: string; amountRaw: string; decimals: number }
  /** What lands, in the output token's raw units, and its symbol and decimals. */
  receive: { symbol: string; amountRaw: string; decimals: number; minimumRaw: string }
  /** The move's worth in USDG raw units (6 decimals), and its cost. */
  usdgValue: string
  feeUsdg: string
  /** ISO time. After it, the browser plans again: prices move. */
  expiresAt: string
  relayRequestId: string | null
  /** Seconds, when Relay gives an estimate. */
  timeEstimate: number | null
}

/** A plan, or the reason there is none. A `hint` points the screen somewhere better. */
export type PlanResult =
  | { ok: true; plan: MovePlan }
  | {
      ok: false
      why: string
      hint?: { kind: 'use_fund'; deskId: string; deskSlug: string | null } | { kind: 'need_origin' }
    }

/** What the screen shows while the owner types: nothing saved, nothing signed. */
export interface MoveQuote {
  receive: { symbol: string; amountRaw: string; decimals: number; minimumRaw: string }
  usdgValue: string
  feeUsdg: string
  timeEstimate: number | null
  /** How it moves: Relay across chains, a Uniswap swap, or a plain transfer. */
  route: 'relay' | 'uniswap' | 'direct'
  signatures: number
}

export type QuoteResult =
  | { ok: true; quote: MoveQuote }
  | { ok: false; why: string; hint?: Extract<PlanResult, { ok: false }>['hint'] }

/** A link a person can open to see a transaction for themselves. */
export interface TxLink {
  chainId: number
  hash: Hex
  url: string
}

export interface MoveOutcome {
  moveId: string
  ending: MoveEnding | 'signing'
  /** One line, in dollars. */
  text: string
  links: TxLink[]
  /** Relay's own page for a cross-chain move. */
  relayUrl: string | null
  /** True while the move can still change: on its way, or may have been sent. Check again later. */
  open: boolean
}
