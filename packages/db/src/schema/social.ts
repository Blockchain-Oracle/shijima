/**
 * Rooms and Takes: what desk owners say to each other about a Stock Token. Kept by Abu from Masayume and Agari,
 * rebuilt without betting (FIDELITY L-42 to L-45).
 *
 * Only a signed-in wallet that owns a desk may write here, and the author is always the session's wallet, never
 * a field in the request. The words are plain text, stored as written. The chat never reads either table: what
 * strangers say must never become instructions to someone's desk.
 */
import { sql } from 'drizzle-orm'
import { type AnyPgColumn, boolean, check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamptz } from './columns'
import { owners } from './owners'

/** A ticker as the approved list writes it: NVDA, GOOGL, SPY. */
const isSymbol = (name: string, column: AnyPgColumn) => check(name, sql`${column} ~ '^[A-Z]{1,6}$'`)

/** One line in a Stock Token's Room. */
export const roomPosts = pgTable(
  'room_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    symbol: text('symbol').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    body: text('body').notNull(),
    /** The author asked to show it, and one of their desks held this token when they posted. Checked by us. */
    holds: boolean('holds').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('room_posts_symbol_idx').on(t.symbol, t.createdAt),
    index('room_posts_owner_idx').on(t.ownerId, t.createdAt),
    isSymbol('room_posts_symbol_format', t.symbol),
    check('room_posts_body_length', sql`char_length(${t.body}) between 1 and 280`),
  ],
)

/** A take: one short post about a Stock Token, filed under it and every other one its words name as $TICKER. */
export const takes = pgTable(
  'takes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    symbol: text('symbol').notNull(),
    caption: text('caption').notNull(),
    /** The stock it is about first, then the approved tickers its words name, at most four. */
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    holds: boolean('holds').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('takes_created_idx').on(t.createdAt),
    index('takes_owner_idx').on(t.ownerId, t.createdAt),
    index('takes_tags_idx').using('gin', t.tags),
    isSymbol('takes_symbol_format', t.symbol),
    check('takes_caption_length', sql`char_length(${t.caption}) between 1 and 240`),
  ],
)
