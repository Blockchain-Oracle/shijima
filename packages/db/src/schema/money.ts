/** Money over time: what the desk was worth, what came in and went out, and the fee as it builds up. */
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { isAddress, isHash32, nonNegative, timestamptz, uint } from './columns'
import { desks } from './desks'
import { cashFlowKind, cashFlowStatus, valueSnapshotKind } from './enums'

/** One holding inside a value snapshot. Amounts are decimal strings of raw units, as in the record. */
export interface SnapshotHolding {
  token: string
  amountRaw: string
  priceE8: string
  valueUsdg: string
  /** How far that price sat from the last official update. Absent on snapshots taken before this existed. */
  gapToFeedBps?: number
}

/**
 * The desk's value at a moment. Holdings are valued on the pool's 30 minute average, NEVER on the feed,
 * because the feed is frozen all weekend. `price_source` says which, so no number is shown without it.
 */
export const deskValueSnapshots = pgTable(
  'desk_value_snapshots',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    kind: valueSnapshotKind('kind').notNull(),
    takenAt: timestamptz('taken_at').notNull(),
    totalUsdg: uint('total_usdg').notNull(),
    cashUsdg: uint('cash_usdg').notNull(),
    vaultUsdg: uint('vault_usdg').notNull(),
    /**
     * The vault's SHARES, which is what reconcile compares: their dollar value grows with interest, so comparing
     * dollars would read the vault's own interest as money arriving from outside. Added 22 Sep; older rows are 0,
     * which is true, because no desk held shares before sweeps.
     */
    vaultShares: uint('vault_shares').notNull().default(sql`0`),
    holdings: jsonb('holdings').$type<SnapshotHolding[]>().notNull(),
    priceSource: text('price_source').notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }),
  },
  (t) => [
    uniqueIndex('desk_value_snapshots_desk_kind_taken_key').on(t.deskId, t.kind, t.takenAt),
    index('desk_value_snapshots_desk_taken_idx').on(t.deskId, t.takenAt),
    nonNegative('desk_value_snapshots_total_nonneg', t.totalUsdg),
    nonNegative('desk_value_snapshots_cash_nonneg', t.cashUsdg),
    nonNegative('desk_value_snapshots_vault_nonneg', t.vaultUsdg),
    nonNegative('desk_value_snapshots_vault_shares_nonneg', t.vaultShares),
  ],
)

/**
 * Money in and out. A deposit is any USDG arriving, because Relay delivers from a solver and not from the
 * owner. A withdrawal is a `Withdrawn` event. `usdg_value` is the value at that moment, which is what moves
 * the loss-stop baseline. A bridge that has not arrived yet has no transaction on this chain, only a Relay id.
 */
export const cashFlows = pgTable(
  'cash_flows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    kind: cashFlowKind('kind').notNull(),
    status: cashFlowStatus('status').notNull().default('confirmed'),
    token: text('token').notNull(),
    amount: uint('amount').notNull(),
    usdgValue: uint('usdg_value'),
    txHash: text('tx_hash'),
    logIndex: integer('log_index'),
    blockNumber: bigint('block_number', { mode: 'number' }),
    relayRequestId: text('relay_request_id'),
    originChainId: integer('origin_chain_id'),
    detectedAt: timestamptz('detected_at').notNull().defaultNow(),
    confirmedAt: timestamptz('confirmed_at'),
  },
  (t) => [
    uniqueIndex('cash_flows_tx_log_key').on(t.txHash, t.logIndex),
    uniqueIndex('cash_flows_relay_request_key').on(t.relayRequestId),
    index('cash_flows_desk_detected_idx').on(t.deskId, t.detectedAt),
    isAddress('cash_flows_token_format', t.token),
    isHash32('cash_flows_tx_hash_format', t.txHash),
    nonNegative('cash_flows_amount_nonneg', t.amount),
    nonNegative('cash_flows_usdg_value_nonneg', t.usdgValue),
    check('cash_flows_is_traceable', sql`${t.txHash} is not null or ${t.relayRequestId} is not null`),
  ],
)

/**
 * The yearly fee, 0.5% of what the desk holds, building up honestly. Waived during the beta and always zero
 * in Shadow. It is recorded anyway so "Fee so far: $0.03, waived" is a real number.
 */
export const feeAccruals = pgTable(
  'fee_accruals',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    periodStart: timestamptz('period_start').notNull(),
    periodEnd: timestamptz('period_end').notNull(),
    basisUsdg: uint('basis_usdg').notNull(),
    rateBps: integer('rate_bps').notNull(),
    amountUsdg: uint('amount_usdg').notNull(),
    waived: boolean('waived').notNull().default(true),
  },
  (t) => [
    uniqueIndex('fee_accruals_desk_period_key').on(t.deskId, t.periodStart),
    check('fee_accruals_period_order', sql`${t.periodEnd} > ${t.periodStart}`),
    nonNegative('fee_accruals_basis_nonneg', t.basisUsdg),
    nonNegative('fee_accruals_amount_nonneg', t.amountUsdg),
  ],
)
