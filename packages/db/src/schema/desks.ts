/** The desk itself, its mandate, the audit trail of who changed what, and its Telegram link. */
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
import {
  deskEventKind,
  deskLifecycle,
  deskMode,
  deskState,
  eventActor,
  eventVia,
  mandateStatus,
  telegramLinkStatus,
} from './enums'
import { inviteCodes, owners } from './owners'

/**
 * One on-chain Desk clone. An owner may hold several, so `owner_id` is not unique.
 *
 * The row is written at sign-in time, BEFORE the contract exists: `address` is what the factory's predictDesk
 * returns for (owner, salt), so money can be bridged to it first when the owner has no ETH yet. `deployed_at`
 * stays null until createDesk confirms. Only desks with a row here are ever served or woken.
 */
export const desks = pgTable(
  'desks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    chainId: integer('chain_id').notNull().default(4663),
    address: text('address').notNull(),
    factory: text('factory').notNull(),
    salt: text('salt').notNull(),
    /** Deployment label from packages/chain/deployments.json, for example v0 or v1. */
    contractVersion: text('contract_version').notNull(),
    /** The operator key this desk expects. One key for all desks today. The contract allows one per desk. */
    operator: text('operator').notNull(),
    inviteCode: text('invite_code').references(() => inviteCodes.code),
    name: text('name'),

    mode: deskMode('mode').notNull().default('shadow'),
    state: deskState('state').notNull().default('active'),
    stateReason: text('state_reason'),

    /** Onboarding is resumable: it continues at the first milestone below that is still null. */
    lifecycle: deskLifecycle('lifecycle').notNull().default('onboarding'),
    deployedAt: timestamptz('deployed_at'),
    deployTx: text('deploy_tx'),
    firstFundedAt: timestamptz('first_funded_at'),
    telegramSkippedAt: timestamptz('telegram_skipped_at'),
    startedAt: timestamptz('started_at'),
    closedAt: timestamptz('closed_at'),

    /** Read-only public view, design brief 8.19. */
    shareSlug: text('share_slug'),
    shareEnabled: boolean('share_enabled').notNull().default(false),

    /** Loss stop. Baseline is start value plus net cash flows. A second breach in a row pauses on-chain. */
    drawdownBaselineUsdg: uint('drawdown_baseline_usdg'),
    drawdownBreaches: integer('drawdown_breaches').notNull().default(0),

    /** Shadow to live is earned: enough checks, the report opened, then the owner arms it. */
    shadowChecks: integer('shadow_checks').notNull().default(0),
    shadowReportOpenedAt: timestamptz('shadow_report_opened_at'),
    liveArmedAt: timestamptz('live_armed_at'),
    demotedAt: timestamptz('demoted_at'),
    demotionReason: text('demotion_reason'),

    /** The contract's own `seq` as we last saw it. Cross-checked against the chain on every wake. */
    chainSeq: bigint('chain_seq', { mode: 'number' }).notNull().default(0),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('desks_chain_address_key').on(t.chainId, t.address),
    uniqueIndex('desks_share_slug_key').on(t.shareSlug),
    index('desks_owner_idx').on(t.ownerId),
    index('desks_running_idx').on(t.lifecycle, t.state),
    isAddress('desks_address_format', t.address),
    isAddress('desks_factory_format', t.factory),
    isAddress('desks_operator_format', t.operator),
    isHash32('desks_salt_format', t.salt),
    nonNegative('desks_drawdown_baseline_nonneg', t.drawdownBaselineUsdg),
  ],
)

/** What a mandate asks the desk to hold. Weights are basis points and, with cash, total 10000. */
export interface MandateTargets {
  cashBps: number
  tokens: { token: string; weightBps: number }[]
}

/**
 * Versioned. Editing never rewrites history: a new version is drafted, read back, then applied, and the old
 * one becomes `superseded`. A decision record names the mandate version it was made under.
 */
export const mandates = pgTable(
  'mandates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    version: integer('version').notNull(),
    status: mandateStatus('status').notNull().default('draft'),
    preset: text('preset'),

    targets: jsonb('targets').$type<MandateTargets>().notNull(),
    driftToleranceBps: integer('drift_tolerance_bps').notNull(),
    maxPositionBps: integer('max_position_bps').notNull(),
    perActionCapUsdg: uint('per_action_cap_usdg').notNull(),
    dailyCapUsdg: uint('daily_cap_usdg').notNull(),
    lossStopBps: integer('loss_stop_bps').notNull(),
    largeActionUsdg: uint('large_action_usdg').notNull(),

    /** The owner's own words, and what they compiled into. FREEFORM_CONTEXT rules are never enforced. */
    notes: text('notes').notNull().default(''),
    compiledRules: jsonb('compiled_rules').$type<unknown[]>().notNull().default([]),
    readBack: jsonb('read_back').$type<Record<string, unknown>>(),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    appliedAt: timestamptz('applied_at'),
    supersededAt: timestamptz('superseded_at'),
  },
  (t) => [
    uniqueIndex('mandates_desk_version_key').on(t.deskId, t.version),
    // At most one mandate is in force per desk. The database enforces it, not a convention.
    uniqueIndex('mandates_one_applied_key').on(t.deskId).where(sql`${t.status} = 'applied'`),
    check(
      'mandates_bps_in_range',
      sql`${t.driftToleranceBps} between 0 and 10000 and ${t.maxPositionBps} between 0 and 10000 and ${t.lossStopBps} between 0 and 10000`,
    ),
    nonNegative('mandates_per_action_cap_nonneg', t.perActionCapUsdg),
    nonNegative('mandates_daily_cap_nonneg', t.dailyCapUsdg),
    nonNegative('mandates_large_action_nonneg', t.largeActionUsdg),
  ],
)

/** Who paused, resumed, changed mode or mandate, and from where. Append only. */
export const deskEvents = pgTable(
  'desk_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    kind: deskEventKind('kind').notNull(),
    actor: eventActor('actor').notNull(),
    via: eventVia('via').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [index('desk_events_desk_at_idx').on(t.deskId, t.at)],
)

/**
 * A desk's Telegram connection. The one-time code is single use and expires after ten minutes. The status
 * message is sent once, pinned silently, then edited in place, so its id is kept here.
 * Never exposed on the public read-only view.
 */
export const telegramLinks = pgTable(
  'telegram_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    status: telegramLinkStatus('status').notNull().default('pending'),
    code: text('code').notNull(),
    codeExpiresAt: timestamptz('code_expires_at').notNull(),
    telegramUserId: bigint('telegram_user_id', { mode: 'number' }),
    telegramChatId: bigint('telegram_chat_id', { mode: 'number' }),
    telegramUsername: text('telegram_username'),
    statusMessageId: bigint('status_message_id', { mode: 'number' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    linkedAt: timestamptz('linked_at'),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    uniqueIndex('telegram_links_code_key').on(t.code),
    uniqueIndex('telegram_links_one_linked_key').on(t.deskId).where(sql`${t.status} = 'linked'`),
    index('telegram_links_user_idx').on(t.telegramUserId),
  ],
)
