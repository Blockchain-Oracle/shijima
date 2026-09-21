/** The outbox for messages to the owner, and the log of every call to SERV Reasoning. */
import { sql } from 'drizzle-orm'
import { bigint, boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { timestamptz } from './columns'
import { decisions, wakes } from './decisions'
import { desks } from './desks'
import { notificationKind, notificationStatus, servMode } from './enums'

/**
 * Outbox. The engine writes a row in the same transaction as the thing it announces. The worker sends it and
 * marks it. `dedupe_key` enforces "once per token per cause per session" for the notable non-actions.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    decisionId: uuid('decision_id').references(() => decisions.id),
    kind: notificationKind('kind').notNull(),
    status: notificationStatus('status').notNull().default('pending'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    dedupeKey: text('dedupe_key'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
    sendAfter: timestamptz('send_after').notNull().defaultNow(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    sentAt: timestamptz('sent_at'),
  },
  (t) => [
    uniqueIndex('notifications_dedupe_key').on(t.deskId, t.dedupeKey),
    index('notifications_pending_idx').on(t.sendAfter).where(sql`${t.status} = 'pending'`),
  ],
)

/**
 * Every SERV Reasoning call: latency, tokens, finish reason and whether our own checks accepted it. SERV's
 * safety tools can fail open with no signal, so the README may claim only what this table shows.
 */
export const servCalls = pgTable(
  'serv_calls',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    deskId: uuid('desk_id').references(() => desks.id),
    wakeId: uuid('wake_id').references(() => wakes.id),
    decisionId: uuid('decision_id').references(() => decisions.id),
    purpose: text('purpose').notNull(),
    promptVersion: text('prompt_version').notNull(),
    model: text('model').notNull(),
    mode: servMode('mode').notNull(),
    ok: boolean('ok').notNull(),
    error: text('error'),
    /** Reasons our own validation rejected an answer that SERV itself returned as fine. */
    rejectedByOurChecks: jsonb('rejected_by_our_checks').$type<string[]>().notNull().default([]),
    latencyMs: integer('latency_ms').notNull(),
    totalTokens: integer('total_tokens'),
    finishReason: text('finish_reason'),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [index('serv_calls_at_idx').on(t.at), index('serv_calls_purpose_at_idx').on(t.purpose, t.at)],
)
