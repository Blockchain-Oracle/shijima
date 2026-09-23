/**
 * Copy trading (D4, D5). A follower is its own desk, with its own contract, money and limits. The leader can never
 * touch it. When the leader acts, the worker makes the same move on the follower, as a share of the follower's own
 * value, through the follower's own gate and mode. The link is the only thing tying the two together.
 */
import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { isHash32, nonNegative, timestamptz, uint } from './columns'
import { desks } from './desks'
import { copyLinkStatus } from './enums'

export const copyLinks = pgTable(
  'copy_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerDeskId: uuid('follower_desk_id')
      .notNull()
      .references(() => desks.id),
    leaderDeskId: uuid('leader_desk_id')
      .notNull()
      .references(() => desks.id),
    /** The one-time fee agreed when copying started, USDG with 6 decimals. 80% to the creator, 20% to Shijima. */
    feeUsdg: uint('fee_usdg').notNull().default(sql`0`),
    creatorFeeTx: text('creator_fee_tx'),
    platformFeeTx: text('platform_fee_tx'),
    status: copyLinkStatus('status').notNull().default('active'),
    /**
     * Only the leader's moves made at or after this are copied. Set when the link starts and again on resume, so a
     * pause never ends in a burst of stale copies.
     */
    activeSince: timestamptz('active_since').notNull().defaultNow(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // A desk copies at most one leader at a time. Stopped links stay as history.
    uniqueIndex('copy_links_one_active_follower_key')
      .on(t.followerDeskId)
      .where(sql`${t.status} <> 'stopped'`),
    index('copy_links_leader_idx').on(t.leaderDeskId, t.status),
    check('copy_links_not_self', sql`${t.followerDeskId} <> ${t.leaderDeskId}`),
    nonNegative('copy_links_fee_nonneg', t.feeUsdg),
    isHash32('copy_links_creator_fee_tx_format', t.creatorFeeTx),
    isHash32('copy_links_platform_fee_tx_format', t.platformFeeTx),
  ],
)
