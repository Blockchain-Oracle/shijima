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
import { int, isAddress, isHash32, nonNegative, timestamptz, uint } from './columns'
import { desks } from './desks'
import { cashFlowKind, cashFlowStatus, moneyMoveKind, moneyMoveStatus, valueSnapshotKind } from './enums'
import { owners } from './owners'

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
    /**
     * Money in minus money out since the desk started, in USDG, up to and including this snapshot. Signed. Charts
     * subtract it, so an owner taking $2 out reads as no change rather than a loss. Added 23 Sep (0014) and
     * backfilled from every earlier "changed outside the agent" event. The database has NO default: an insert
     * that leaves it out has it filled by the trigger `desk_value_snapshots_carry_flows` with the desk's previous
     * total, because nothing moved. The default below only makes it optional on insert.
     */
    flowsUsdg: int('flows_usdg').notNull().default(sql`null`),
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

/** One transaction step of a planned move, as the browser was told to sign it. */
export interface MoneyMoveStep {
  chainId: number
  to: string
  kind: 'approve' | 'swap' | 'transfer' | 'relay' | 'desk'
  label: string
}

/**
 * One move of money the owner started in the app: the owner's intent, in one row. The server plans it and writes
 * it as `signing`; the browser signs each step and reports each hash; the server reads the chain (or Relay) and
 * sets the ending. Reconcile later ties the balance change it finds in an agent to the move that caused it, which
 * is how the record says "You added $5 from Base" instead of "changed outside the agent".
 */
export const moneyMoves = pgTable(
  'money_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    /** The agent money goes into or out of. Null for a move that only touches the owner's wallet. */
    deskId: uuid('desk_id').references(() => desks.id),
    kind: moneyMoveKind('kind').notNull(),
    status: moneyMoveStatus('status').notNull().default('signing'),
    fromChainId: integer('from_chain_id').notNull(),
    toChainId: integer('to_chain_id').notNull(),
    /** Lowercase token addresses; the zero address is the chain's native coin. */
    tokenIn: text('token_in').notNull(),
    amountIn: uint('amount_in').notNull(),
    tokenOut: text('token_out').notNull(),
    amountOutQuoted: uint('amount_out_quoted'),
    amountOutActual: uint('amount_out_actual'),
    /** What the move is worth in USDG (6 decimals) when planned: what lands, or what leaves. */
    usdgValue: uint('usdg_value'),
    /** Network fees and Relay's cut, in USDG (6 decimals). */
    feeUsdg: uint('fee_usdg'),
    recipient: text('recipient').notNull(),
    steps: jsonb('steps').$type<MoneyMoveStep[]>().notNull().default([]),
    /** Every hash the browser reported, in order. */
    txHashes: text('tx_hashes').array().notNull().default(sql`'{}'::text[]`),
    relayRequestId: text('relay_request_id'),
    error: text('error'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('money_moves_owner_created_idx').on(t.ownerId, t.createdAt),
    index('money_moves_desk_created_idx').on(t.deskId, t.createdAt),
    isAddress('money_moves_token_in_format', t.tokenIn),
    isAddress('money_moves_token_out_format', t.tokenOut),
    isAddress('money_moves_recipient_format', t.recipient),
    nonNegative('money_moves_amount_in_nonneg', t.amountIn),
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
    /** The move the owner started that caused this, when one matches. */
    moneyMoveId: uuid('money_move_id').references(() => moneyMoves.id),
    /**
     * The snapshot whose check found it. Reconcile sees a balance change, never the transaction behind it, so this
     * is what makes a row it writes traceable.
     */
    snapshotId: bigint('snapshot_id', { mode: 'number' }).references(() => deskValueSnapshots.id),
  },
  (t) => [
    uniqueIndex('cash_flows_tx_log_key').on(t.txHash, t.logIndex),
    uniqueIndex('cash_flows_relay_request_key').on(t.relayRequestId),
    uniqueIndex('cash_flows_snapshot_token_key').on(t.snapshotId, t.token),
    index('cash_flows_money_move_idx').on(t.moneyMoveId),
    index('cash_flows_desk_detected_idx').on(t.deskId, t.detectedAt),
    isAddress('cash_flows_token_format', t.token),
    isHash32('cash_flows_tx_hash_format', t.txHash),
    nonNegative('cash_flows_amount_nonneg', t.amount),
    nonNegative('cash_flows_usdg_value_nonneg', t.usdgValue),
    check(
      'cash_flows_is_traceable',
      sql`${t.txHash} is not null or ${t.relayRequestId} is not null or ${t.snapshotId} is not null`,
    ),
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
