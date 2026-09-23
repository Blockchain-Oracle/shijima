/**
 * The money path: a wake, the decisions it produced, the transactions those decisions sent, and what came
 * of them. Nothing here is ever deleted. Every foreign key is the default NO ACTION for that reason.
 */
import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
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
import {
  actionKind,
  actionStatus,
  answerChannel,
  approvalReason,
  approvalStatus,
  decisionOutcome,
  deferralStatus,
  deskMode,
  gradeVerdict,
  recordKind,
  tradeSide,
  wakeStatus,
  wakeTrigger,
} from './enums'
import { owners } from './owners'

/**
 * One check of one desk. OpenServ cron is the primary clock and our tick loop is the safety net, so the same
 * hour can fire twice. The unique key on (desk, scheduled_for) makes the second fire do nothing.
 */
export const wakes = pgTable(
  'wakes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    scheduledFor: timestamptz('scheduled_for').notNull(),
    trigger: wakeTrigger('trigger').notNull(),
    status: wakeStatus('status').notNull().default('running'),
    /** Which outside sources answered this hour: rpc, halt flag, news, SERV. Drives "data trouble on our side". */
    sourceHealth: jsonb('source_health').$type<Record<string, unknown>>(),
    error: text('error'),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    finishedAt: timestamptz('finished_at'),
  },
  (t) => [
    uniqueIndex('wakes_desk_scheduled_key').on(t.deskId, t.scheduledFor),
    index('wakes_desk_started_idx').on(t.deskId, t.startedAt),
  ],
)

/**
 * One entry in a desk's record, including "nothing to do".
 *
 * `seq` is gap free per desk and is allocated under pg_advisory_xact_lock(desk). `prev_hash` is the previous
 * record's `record_hash`, and it is INSIDE the hashed body, so the records form a chain. An on-chain action
 * carries its own record's hash, which therefore commits to every earlier record too. That is how a
 * non-action gets sealed: by the next action or the daily checkpoint. `sealed_by_tx` names that transaction.
 *
 * This `seq` is NOT the contract's `seq`. The contract counts on-chain actions only.
 *
 * `record` is exactly what was hashed and is fixed before anything is sent. `result` is appended afterwards
 * and is not hashed. `private` holds what the owner may see but the public may not, such as headline text.
 */
export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    wakeId: uuid('wake_id').references(() => wakes.id),
    seq: integer('seq').notNull(),
    kind: recordKind('kind').notNull().default('decision'),
    schemaVersion: integer('schema_version').notNull(),

    /** Columns the record list filters and sorts on. The truth is `record`. These are a projection of it. */
    outcome: decisionOutcome('outcome').notNull(),
    mode: deskMode('mode').notNull(),
    shadow: boolean('shadow').notNull(),
    token: text('token'),
    side: tradeSide('side'),
    amountUsdg: uint('amount_usdg'),
    confidencePercent: integer('confidence_percent'),
    summary: text('summary').notNull(),
    failureCode: text('failure_code'),

    record: jsonb('record').$type<Record<string, unknown>>().notNull(),
    recordHash: text('record_hash').notNull(),
    prevHash: text('prev_hash').notNull(),
    private: jsonb('private').$type<Record<string, unknown>>(),
    result: jsonb('result').$type<Record<string, unknown>>(),

    sealedByTx: text('sealed_by_tx'),
    sealedAt: timestamptz('sealed_at'),

    /**
     * Set when OpenServ asked for this decision: the hourly workflow's task, or a linked workspace's check_now.
     * The workspace is its lasting key (the bucket folder), the task and execution are the platform's own ids.
     */
    openservWorkspace: text('openserv_workspace'),
    openservTaskId: text('openserv_task_id'),
    openservExecutionId: text('openserv_execution_id'),

    /**
     * Copy trading (D4): the leader's decision this record copied, or missed copying. One per follower per leader
     * decision, enforced below, so a restart can never copy the same move twice.
     */
    copiedFromDecisionId: uuid('copied_from_decision_id').references((): AnyPgColumn => decisions.id),

    decidedAt: timestamptz('decided_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('decisions_desk_seq_key').on(t.deskId, t.seq),
    uniqueIndex('decisions_record_hash_key').on(t.recordHash),
    index('decisions_desk_decided_idx').on(t.deskId, t.decidedAt),
    index('decisions_desk_outcome_idx').on(t.deskId, t.outcome),
    index('decisions_unsealed_idx').on(t.deskId, t.seq).where(sql`${t.sealedByTx} is null`),
    uniqueIndex('decisions_desk_copied_from_key')
      .on(t.deskId, t.copiedFromDecisionId)
      .where(sql`${t.copiedFromDecisionId} is not null`),
    check('decisions_seq_positive', sql`${t.seq} >= 1`),
    check(
      'decisions_confidence_range',
      sql`${t.confidencePercent} is null or ${t.confidencePercent} between 0 and 100`,
    ),
    isHash32('decisions_record_hash_format', t.recordHash),
    isHash32('decisions_prev_hash_format', t.prevHash),
    isHash32('decisions_sealed_by_tx_format', t.sealedByTx),
    isAddress('decisions_token_format', t.token),
    nonNegative('decisions_amount_nonneg', t.amountUsdg),
  ],
)

/**
 * One transaction sent with the operator key. A decision can have several legs, for example redeem then
 * buy, all carrying the same decision hash. A failed leg stops the rest.
 *
 * The write-ahead rule: `tx_hash` and `nonce` are committed here BEFORE the transaction is broadcast. After
 * a crash, every row still in planned, prepared or sent is resolved from the chain, never guessed and never
 * sent twice. `deadline_unix` is the contract's own deadline. Once it has passed with no receipt, the
 * transaction can never land, so `never_landed` is a fact and not a timeout.
 */
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => decisions.id),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    leg: integer('leg').notNull().default(0),
    kind: actionKind('kind').notNull(),
    status: actionStatus('status').notNull().default('planned'),

    operator: text('operator').notNull(),
    nonce: integer('nonce'),
    txHash: text('tx_hash'),
    calldataHash: text('calldata_hash'),
    deadlineUnix: bigint('deadline_unix', { mode: 'number' }),

    token: text('token'),
    amountIn: uint('amount_in'),
    expectedOut: uint('expected_out'),
    minOut: uint('min_out'),
    actualOut: uint('actual_out'),

    /** Read back from the receipt and the contract's event. */
    chainSeq: bigint('chain_seq', { mode: 'number' }),
    blockNumber: bigint('block_number', { mode: 'number' }),
    gasUsed: uint('gas_used'),
    effectiveGasPrice: uint('effective_gas_price'),
    feedPriceE8: uint('feed_price_e8'),

    failureCode: text('failure_code'),
    failureDetail: text('failure_detail'),

    plannedAt: timestamptz('planned_at').notNull().defaultNow(),
    preparedAt: timestamptz('prepared_at'),
    sentAt: timestamptz('sent_at'),
    resolvedAt: timestamptz('resolved_at'),
  },
  (t) => [
    uniqueIndex('actions_decision_leg_key').on(t.decisionId, t.leg),
    uniqueIndex('actions_tx_hash_key').on(t.txHash),
    // The resolver's whole job is this small set, so it gets its own index.
    index('actions_unresolved_idx')
      .on(t.status, t.plannedAt)
      .where(sql`${t.status} in ('planned', 'prepared', 'sent')`),
    index('actions_desk_idx').on(t.deskId, t.plannedAt),
    // A row cannot claim to be signed without saying what was signed.
    check(
      'actions_signed_has_hash_and_nonce',
      sql`${t.status} = 'planned' or ${t.status} = 'never_landed' or (${t.txHash} is not null and ${t.nonce} is not null)`,
    ),
    isAddress('actions_operator_format', t.operator),
    isAddress('actions_token_format', t.token),
    isHash32('actions_tx_hash_format', t.txHash),
    isHash32('actions_calldata_hash_format', t.calldataHash),
    nonNegative('actions_amount_in_nonneg', t.amountIn),
    nonNegative('actions_expected_out_nonneg', t.expectedOut),
    nonNegative('actions_min_out_nonneg', t.minOut),
    nonNegative('actions_actual_out_nonneg', t.actualOut),
  ],
)

/**
 * "Wait for the reopen" written down, so later hours say "still waiting (decided 02:00)" with no model call.
 * Only arithmetic breaks one: the gap moves 100 bps, a note rule fires, a new on-topic headline, drift grows
 * by half the tolerance, or cash arrives. `baseline` holds the numbers those comparisons are made against.
 */
export const deferrals = pgTable(
  'deferrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => decisions.id),
    token: text('token').notNull(),
    side: tradeSide('side').notNull(),
    status: deferralStatus('status').notNull().default('standing'),
    revisitAt: timestamptz('revisit_at').notNull(),
    baseline: jsonb('baseline').$type<Record<string, unknown>>().notNull(),
    endedReason: text('ended_reason'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    endedAt: timestamptz('ended_at'),
  },
  (t) => [
    uniqueIndex('deferrals_one_standing_key').on(t.deskId, t.token).where(sql`${t.status} = 'standing'`),
    index('deferrals_revisit_idx').on(t.revisitAt).where(sql`${t.status} = 'standing'`),
    isAddress('deferrals_token_format', t.token),
  ],
)

/**
 * A request to the owner. It expires at the next scheduled check. The web app and Telegram only ever flip
 * this row with a guarded update (`where status = 'pending' and expires_at > now() returning`). The worker
 * then re-checks everything with a fresh quote and writes a new execution record. The web never trades.
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => decisions.id),
    status: approvalStatus('status').notNull().default('pending'),
    reason: approvalReason('reason').notNull(),
    /** What the owner was shown: amounts, cost and the floor. The fresh quote must land within 50 bps of it. */
    preview: jsonb('preview').$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    answeredBy: uuid('answered_by').references(() => owners.id),
    answeredAt: timestamptz('answered_at'),
    answeredVia: answerChannel('answered_via'),
    telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
    executionDecisionId: uuid('execution_decision_id').references(() => decisions.id),
    cancelledReason: text('cancelled_reason'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('approvals_decision_key').on(t.decisionId),
    index('approvals_pending_idx').on(t.deskId, t.expiresAt).where(sql`${t.status} = 'pending'`),
    // An answer always says who, when and where. An unanswered row says none of them.
    check(
      'approvals_answer_is_complete',
      sql`(${t.status} in ('approved', 'rejected')) = (${t.answeredBy} is not null and ${t.answeredAt} is not null and ${t.answeredVia} is not null)`,
    ),
  ],
)

/**
 * "How it looks now", once the market has reopened. One grade per decision, against its main alternative.
 * Under 25 bps is "no real difference". A grade judges the timing call. It is never a profit claim.
 * `replay` marks grades produced by running the engine over a past weekend.
 */
export const grades = pgTable(
  'grades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => decisions.id),
    verdict: gradeVerdict('verdict').notNull(),
    /** Positive means the choice made beat the alternative by this much. */
    differenceBps: integer('difference_bps'),
    chosen: text('chosen').notNull(),
    alternative: text('alternative').notNull(),
    decisionPriceE8: uint('decision_price_e8'),
    reopenPriceE8: uint('reopen_price_e8'),
    replay: boolean('replay').notNull().default(false),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    gradedAt: timestamptz('graded_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('grades_decision_key').on(t.decisionId),
    index('grades_desk_graded_idx').on(t.deskId, t.gradedAt),
    check(
      'grades_ungradable_has_no_number',
      sql`(${t.verdict} = 'ungradable') = (${t.differenceBps} is null)`,
    ),
  ],
)
