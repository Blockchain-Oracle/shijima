/**
 * The free $1 to try (PLAN-ROUND-3 D3): $1 USDG and a pinch of ETH for gas, sent from a gift wallet to a
 * signed-in wallet. The website only writes a `queued` row; the worker holds the gift key and sends.
 *
 * Every signed transfer is journaled in `attempts` BEFORE it is broadcast, the way the operator's actions are,
 * so a crash at any line leaves enough here to ask the chain what happened. A leg is paid when its `*_tx` is set,
 * and only then.
 */
import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { isAddress, isHash32, nonNegative, timestamptz, uint } from './columns'
import { giftStatus } from './enums'

export type GiftLeg = 'usdg' | 'eth'

/** One signed transfer. `outcome` is empty while it may still land. */
export interface GiftAttempt {
  leg: GiftLeg
  txHash: string
  nonce: number
  preparedAt: string
  outcome?: 'confirmed' | 'reverted' | 'never_landed'
}

export const giftClaims = pgTable(
  'gift_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The session's wallet, lower case. One gift per wallet, ever. */
    wallet: text('wallet').notNull(),
    /** A salted hash of the claimer's IP address, never the address itself. One claim per IP a day. */
    ipHash: text('ip_hash').notNull(),
    status: giftStatus('status').notNull().default('queued'),
    /** USDG raw units, 6 decimals. */
    usdgAmount: uint('usdg_amount').notNull(),
    ethAmountWei: uint('eth_amount_wei').notNull(),
    /** Set only when that transfer is confirmed. */
    usdgTx: text('usdg_tx'),
    ethTx: text('eth_tx'),
    /** Every transfer ever signed for this claim, journaled before broadcast. */
    attempts: jsonb('attempts').$type<GiftAttempt[]>().notNull().default([]),
    /** Why it failed, or why it is still waiting (the sender is off). Cleared once sent. */
    error: text('error'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('gift_claims_wallet_key').on(t.wallet),
    index('gift_claims_ip_idx').on(t.ipHash, t.createdAt),
    index('gift_claims_status_idx').on(t.status, t.createdAt),
    isAddress('gift_claims_wallet_format', t.wallet),
    isHash32('gift_claims_usdg_tx_format', t.usdgTx),
    isHash32('gift_claims_eth_tx_format', t.ethTx),
    nonNegative('gift_claims_usdg_amount_nonneg', t.usdgAmount),
    nonNegative('gift_claims_eth_amount_nonneg', t.ethAmountWei),
    check(
      'gift_claims_sent_has_both',
      sql`${t.status} <> 'sent' or (${t.usdgTx} is not null and ${t.ethTx} is not null)`,
    ),
  ],
)
