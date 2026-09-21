/**
 * The chat, and the three things it can ask the worker to do.
 *
 * The web app holds no keys, so it never calls the model. It writes a request row and polls. The worker, which
 * holds the SERV key, claims the row, answers, and writes the reply back. The model only ever PROPOSES: a
 * proposal is saved with an expiry, the owner confirms it on a card, and only the saved copy is carried out,
 * through the same guarded paths the website and Telegram already use.
 */
import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { isAddress, timestamptz } from './columns'
import { wakes } from './decisions'
import { desks } from './desks'
import {
  askPath,
  askProposalStatus,
  askRequestKind,
  askRequestStatus,
  checkRequestStatus,
  eventVia,
  priceAlertKind,
  priceAlertStatus,
} from './enums'

/**
 * One message to the desk. `desk_id` is empty only for a test read in the studio, before the desk exists;
 * then `payload` carries the draft mandate itself.
 */
export const askRequests = pgTable(
  'ask_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerAddress: text('owner_address').notNull(),
    deskId: uuid('desk_id').references(() => desks.id),
    kind: askRequestKind('kind').notNull(),
    via: eventVia('via').notNull(),
    /** What the owner wrote. Plain text, at most 1,000 characters. */
    question: text('question').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: askRequestStatus('status').notNull().default('pending'),
    /** `{ reply, cites, chart?, proposalId? }`, written by the worker. */
    reply: jsonb('reply').$type<Record<string, unknown>>(),
    error: text('error'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    claimedAt: timestamptz('claimed_at'),
    answeredAt: timestamptz('answered_at'),
  },
  (t) => [
    isAddress('ask_requests_owner_format', t.ownerAddress),
    check('ask_requests_question_length', sql`char_length(${t.question}) <= 1000`),
    index('ask_requests_pending_idx').on(t.createdAt).where(sql`${t.status} = 'pending'`),
    index('ask_requests_owner_at_idx').on(t.ownerAddress, t.createdAt),
  ],
)

/**
 * One thing the model proposed, after plain code checked it. Nothing runs until the owner confirms, and then
 * only these saved `args`, never anything re-read from the model. `desk_view` is what the owner was shown:
 * the desk's own opinion, and for "do it anyway" the fresh quote, so the worker can hold the trade to it.
 */
export const askProposals = pgTable(
  'ask_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => askRequests.id),
    deskId: uuid('desk_id').references(() => desks.id),
    ownerAddress: text('owner_address').notNull(),
    kind: text('kind').notNull(),
    args: jsonb('args').$type<Record<string, unknown>>().notNull(),
    deskView: jsonb('desk_view').$type<Record<string, unknown>>().notNull().default({}),
    path: askPath('path').notNull(),
    status: askProposalStatus('status').notNull().default('open'),
    expiresAt: timestamptz('expires_at').notNull(),
    confirmedAt: timestamptz('confirmed_at'),
    doneAt: timestamptz('done_at'),
    txHash: text('tx_hash'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    isAddress('ask_proposals_owner_format', t.ownerAddress),
    check('ask_proposals_tx_hash_format', sql`${t.txHash} IS NULL OR ${t.txHash} ~ '^0x[0-9a-f]{64}$'`),
    index('ask_proposals_desk_idx').on(t.deskId, t.createdAt),
  ],
)

/**
 * "Check now." The worker runs one check for the desk at the request's own time, so it never collides with the
 * hourly check keyed on the top of the hour. One pending request per desk; a manual check never counts toward
 * the practice total.
 */
export const checkRequests = pgTable(
  'check_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    requestedBy: text('requested_by').notNull(),
    via: eventVia('via').notNull(),
    /** Set when this check exists to carry out a confirmed "do it anyway". */
    proposalId: uuid('proposal_id').references(() => askProposals.id),
    status: checkRequestStatus('status').notNull().default('pending'),
    refusedReason: text('refused_reason'),
    wakeId: uuid('wake_id').references(() => wakes.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    doneAt: timestamptz('done_at'),
  },
  (t) => [
    isAddress('check_requests_by_format', t.requestedBy),
    uniqueIndex('check_requests_one_pending_key').on(t.deskId).where(sql`${t.status} = 'pending'`),
  ],
)

/** "Tell me when NVDA is 2% from its reference." Checked by the price logger; sent by Telegram and the inbox. */
export const priceAlerts = pgTable(
  'price_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerAddress: text('owner_address').notNull(),
    deskId: uuid('desk_id').references(() => desks.id),
    token: text('token').notNull(),
    kind: priceAlertKind('kind').notNull(),
    thresholdBps: integer('threshold_bps').notNull(),
    status: priceAlertStatus('status').notNull().default('active'),
    /** The price point that fired it, so the message can quote the exact numbers. */
    firedGapBps: integer('fired_gap_bps'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    firedAt: timestamptz('fired_at'),
  },
  (t) => [
    isAddress('price_alerts_owner_format', t.ownerAddress),
    isAddress('price_alerts_token_format', t.token),
    check('price_alerts_threshold_range', sql`${t.thresholdBps} > 0 AND ${t.thresholdBps} <= 5000`),
    index('price_alerts_active_idx').on(t.token).where(sql`${t.status} = 'active'`),
  ],
)
