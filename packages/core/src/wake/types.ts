import type { ApprovedToken } from '@desk/chain'

export type Side = 'buy' | 'sell'

/**
 * One thing arithmetic says would move the desk toward its mandate. The model never invents a candidate and
 * never changes its size beyond the fixed part sizes. It only says when.
 */
export interface Candidate {
  id: string
  side: Side
  token: ApprovedToken
  /** USDG, 6 decimals, for a buy. Raw token units, 18 decimals, for a sell. */
  amountIn: bigint
  /** Why arithmetic proposed it, in one plain sentence. */
  why: string
  /** True when the owner's own standing rule demanded this sale. The gate holds it to fewer refusals. */
  protective?: boolean
  /** The rule that demanded it, by id, so the model and the record can name it. */
  ruleId?: string
}

export const TOKEN_DECIMALS = 18
export const USDG_DECIMALS = 6
