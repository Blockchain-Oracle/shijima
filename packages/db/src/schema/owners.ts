/** Who may use the product: the wallet that signed in, what they accepted, and the beta invite codes. */
import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { isAddress, timestamptz } from './columns'

/** An owner is a wallet address proven by a signed message. There is no email and no password. */
export const owners = pgTable(
  'owners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    address: text('address').notNull(),
    /** IANA zone captured from the browser. Telegram has no other way to show "expires 05:00" in local time. */
    timezone: text('timezone'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastSeenAt: timestamptz('last_seen_at'),
  },
  (t) => [uniqueIndex('owners_address_key').on(t.address), isAddress('owners_address_format', t.address)],
)

/**
 * The plain-language disclosure is versioned, so a change to it can ask for a fresh acceptance. A row exists
 * only if the owner also declared they are not in a place where Stock Tokens are restricted.
 */
export const disclosureAcceptances = pgTable(
  'disclosure_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    version: text('version').notNull(),
    notRestricted: boolean('not_restricted').notNull(),
    acceptedAt: timestamptz('accepted_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('disclosure_acceptances_owner_version_key').on(t.ownerId, t.version),
    check('disclosure_acceptances_declared', sql`${t.notRestricted}`),
  ],
)

/** Creating a desk sits behind a beta invite code. */
export const inviteCodes = pgTable(
  'invite_codes',
  {
    code: text('code').primaryKey(),
    note: text('note'),
    maxUses: integer('max_uses').notNull().default(1),
    uses: integer('uses').notNull().default(0),
    expiresAt: timestamptz('expires_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [check('invite_codes_uses_within_max', sql`${t.uses} >= 0 and ${t.uses} <= ${t.maxUses}`)],
)
