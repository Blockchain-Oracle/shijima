/**
 * The approved token list. Built from live chain evidence by `pnpm tokens:build`, never edited by hand.
 * Tokens are keyed by contract ADDRESS everywhere in this codebase, never by symbol: symbols can change.
 */
import type { Address } from 'viem'
import data from '../tokens.json' with { type: 'json' }
import type { FeeTier } from './addresses'

export interface ApprovedToken {
  symbol: string
  displayName: string
  address: Address
  decimals: number
  feed: Address
  feedDecimals: number
  feedDescription: string
  /** Chosen by depth first, then cost. The Desk contract stores this per token. The agent can never change it. */
  pinnedFee: FeeTier
  pool: Address
  usdgInPool: number
  roundTripBps100: number
  roundTripBps1000: number
  observationCardinality: number
  uiMultiplier: string
  tradability: string
  /**
   * Set when a token already listed no longer passes the rule. It stays listed so desks that hold it still see
   * it, but no strategy may use it. The text is the reason, e.g. "pinned pool holds $95295 of USDG, under $100000".
   */
  watch?: string
}

export const TOKENS_GENERATED_AT: string = data.generatedAt
export const APPROVED_TOKENS = data.tokens as ApprovedToken[]

const byAddress = new Map(APPROVED_TOKENS.map((t) => [t.address.toLowerCase(), t]))
export const tokenByAddress = (address: string): ApprovedToken | undefined =>
  byAddress.get(address.toLowerCase())
