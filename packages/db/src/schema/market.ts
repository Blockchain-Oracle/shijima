/**
 * Market data shared by every desk. Tokens are keyed by contract ADDRESS everywhere, never by symbol.
 * Prices are integers scaled to 8 decimals, like the feed, so a pool price and a feed price compare directly.
 * A boolean that can be unknown stays NULL. Unknown is never written as false.
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { isAddress, isHash32, nonNegative, timestamptz, uint } from './columns'
import { desks } from './desks'
import { companyEventKind, multiplierEventKind, referenceKind, tokenFlag } from './enums'

/**
 * The reference price: the last swap at or before the 16:00 New York boundary, recomputable from swap logs
 * at any time. If a multiplier lands mid-weekend the reference is rescaled, so the multiplier is kept.
 */
export const referenceSnapshots = pgTable(
  'reference_snapshots',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    token: text('token').notNull(),
    kind: referenceKind('kind').notNull(),
    /** The New York trading date this boundary belongs to. */
    sessionDate: date('session_date').notNull(),
    boundaryAt: timestamptz('boundary_at').notNull(),
    priceE8: uint('price_e8').notNull(),
    multiplierRaw: uint('multiplier_raw').notNull(),
    txHash: text('tx_hash'),
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reference_snapshots_token_kind_date_key').on(t.token, t.kind, t.sessionDate),
    isAddress('reference_snapshots_token_format', t.token),
    isHash32('reference_snapshots_tx_hash_format', t.txHash),
    nonNegative('reference_snapshots_price_nonneg', t.priceE8),
  ],
)

/** The price logger's rows: what each token looked like at a moment. Feeds replay and the comparison page. */
export const pricePoints = pgTable(
  'price_points',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    token: text('token').notNull(),
    at: timestamptz('at').notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }),
    poolMidE8: uint('pool_mid_e8'),
    twap30E8: uint('twap30_e8'),
    feedPriceE8: uint('feed_price_e8'),
    feedUpdatedAt: timestamptz('feed_updated_at'),
    gapBps: integer('gap_bps'),
    costBps100: integer('cost_bps_100'),
    costBps1000: integer('cost_bps_1000'),
    halted: boolean('halted'),
    oraclePaused: boolean('oracle_paused'),
    /** The price the gap is measured against (added 21 Sep), so a chart can draw the line and say how old it is. */
    referenceE8: uint('reference_e8'),
    /** `last_regular_close` while the market is shut, else `last_official_update`. Never called "last close". */
    referenceKind: text('reference_kind'),
    referenceAt: timestamptz('reference_at'),
  },
  (t) => [
    uniqueIndex('price_points_token_at_key').on(t.token, t.at),
    isAddress('price_points_token_format', t.token),
    check(
      'price_points_reference_kind',
      sql`${t.referenceKind} IS NULL OR ${t.referenceKind} IN ('last_regular_close', 'last_official_update')`,
    ),
  ],
)

/** A Stock Token's multiplier changed: a split or a dividend, told apart by the ratio. Raises "value jumped". */
export const multiplierEvents = pgTable(
  'multiplier_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    token: text('token').notNull(),
    kind: multiplierEventKind('kind').notNull(),
    oldMultiplierRaw: uint('old_multiplier_raw').notNull(),
    newMultiplierRaw: uint('new_multiplier_raw').notNull(),
    txHash: text('tx_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    at: timestamptz('at').notNull(),
  },
  (t) => [
    uniqueIndex('multiplier_events_tx_log_key').on(t.txHash, t.logIndex),
    index('multiplier_events_token_at_idx').on(t.token, t.at),
    isAddress('multiplier_events_token_format', t.token),
    isHash32('multiplier_events_tx_hash_format', t.txHash),
  ],
)

/** Earnings and other company events, from the Finnhub calendar. Drives the event window and the banner. */
export const companyEvents = pgTable(
  'company_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    token: text('token').notNull(),
    symbol: text('symbol').notNull(),
    kind: companyEventKind('kind').notNull(),
    eventDate: date('event_date').notNull(),
    /** Before the open, after the close, or during hours, when the source says. */
    timing: text('timing'),
    source: text('source').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('company_events_token_kind_date_key').on(t.token, t.kind, t.eventDate),
    index('company_events_date_idx').on(t.eventDate),
    isAddress('company_events_token_format', t.token),
  ],
)

/**
 * A condition on a token a desk holds, such as halted or beyond the 8% band. Alerts fire when a flag CHANGES,
 * not every hour it stays true, so the row remembers when it began, ended and was last announced.
 */
export const deskTokenFlags = pgTable(
  'desk_token_flags',
  {
    deskId: uuid('desk_id')
      .notNull()
      .references(() => desks.id),
    token: text('token').notNull(),
    flag: tokenFlag('flag').notNull(),
    active: boolean('active').notNull(),
    since: timestamptz('since').notNull().defaultNow(),
    clearedAt: timestamptz('cleared_at'),
    lastAlertedAt: timestamptz('last_alerted_at'),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
  },
  (t) => [
    primaryKey({ columns: [t.deskId, t.token, t.flag] }),
    index('desk_token_flags_active_idx').on(t.deskId).where(sql`${t.active}`),
    isAddress('desk_token_flags_token_format', t.token),
  ],
)

/**
 * Headlines, fetched once per ticker and shared by every desk, deduplicated by URL hash.
 * LICENCE: Finnhub's free plan forbids passing its text on. `title` is for the model and the owner's own
 * view. The public view and the hashed record only ever carry source, time, link and a hash of the title.
 */
export const newsCache = pgTable(
  'news_cache',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    symbol: text('symbol').notNull(),
    urlHash: text('url_hash').notNull(),
    url: text('url').notNull(),
    source: text('source').notNull(),
    title: text('title').notNull(),
    titleHash: text('title_hash').notNull(),
    publishedAt: timestamptz('published_at').notNull(),
    fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('news_cache_symbol_url_key').on(t.symbol, t.urlHash),
    index('news_cache_symbol_published_idx').on(t.symbol, t.publishedAt),
    isHash32('news_cache_url_hash_format', t.urlHash),
    isHash32('news_cache_title_hash_format', t.titleHash),
  ],
)
