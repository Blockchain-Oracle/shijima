/**
 * Rooms and Takes. Every write names its author by owner id, which the web takes from the signed-in session,
 * never from the request. Reading a Room is for members; takes are public, like a shared desk.
 */
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { desks, deskValueSnapshots, owners, roomPosts, takes } from '../schema'

/**
 * The owner behind a signed-in wallet, and whether they own a desk that exists on the chain. A desk's row is
 * written before its contract, as `onboarding`; every later lifecycle means the contract was made.
 */
export async function socialMember(db: DbOrTx, address: string) {
  const [row] = await db
    .select({ ownerId: owners.id, desks: sql<number>`count(${desks.id})::int` })
    .from(owners)
    .leftJoin(desks, and(eq(desks.ownerId, owners.id), ne(desks.lifecycle, 'onboarding')))
    .where(eq(owners.address, address.toLowerCase()))
    .groupBy(owners.id)
  return row ? { ownerId: row.ownerId, ownsDesk: row.desks > 0 } : undefined
}

/**
 * Whether one of this owner's desks held the token at its latest valuation. This is what earns the "holds it"
 * badge, and only when the author asked to show it: a badge a client could assert would be worth nothing.
 */
export async function holdsToken(db: DbOrTx, ownerId: string, token: string): Promise<boolean> {
  const rows = await db
    .selectDistinctOn([deskValueSnapshots.deskId], { holdings: deskValueSnapshots.holdings })
    .from(deskValueSnapshots)
    .innerJoin(desks, eq(desks.id, deskValueSnapshots.deskId))
    .where(eq(desks.ownerId, ownerId))
    .orderBy(deskValueSnapshots.deskId, desc(deskValueSnapshots.takenAt))
  const wanted = token.toLowerCase()
  return rows.some((r) =>
    r.holdings.some((h) => h.token.toLowerCase() === wanted && BigInt(h.amountRaw) > 0n),
  )
}

/** How many things this owner wrote to a table since a moment. Rate limits are counted here, in Postgres. */
export async function writtenSince(db: DbOrTx, table: 'room' | 'takes', ownerId: string, since: Date) {
  const t = table === 'room' ? roomPosts : takes
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t)
    .where(and(eq(t.ownerId, ownerId), gt(t.createdAt, since)))
  return row?.n ?? 0
}

export async function insertRoomPost(
  db: DbOrTx,
  post: { symbol: string; ownerId: string; body: string; holds: boolean },
) {
  const [row] = await db.insert(roomPosts).values(post).returning()
  return row
}

/** The latest lines of one Room, oldest first, each with its author's wallet. */
export async function roomThread(db: DbOrTx, symbol: string, limit = 100) {
  const rows = await db
    .select({
      id: roomPosts.id,
      body: roomPosts.body,
      holds: roomPosts.holds,
      createdAt: roomPosts.createdAt,
      author: owners.address,
    })
    .from(roomPosts)
    .innerJoin(owners, eq(owners.id, roomPosts.ownerId))
    .where(eq(roomPosts.symbol, symbol))
    .orderBy(desc(roomPosts.createdAt))
    .limit(limit)
  return rows.reverse()
}

export async function insertTake(
  db: DbOrTx,
  take: { ownerId: string; symbol: string; caption: string; tags: string[]; holds: boolean },
) {
  const [row] = await db.insert(takes).values(take).returning()
  return row
}

/** The newest takes, each with its author's wallet. With a symbol, only those filed under it. */
export async function latestTakes(db: DbOrTx, options: { limit: number; symbol?: string | undefined }) {
  return db
    .select({
      id: takes.id,
      symbol: takes.symbol,
      caption: takes.caption,
      tags: takes.tags,
      holds: takes.holds,
      createdAt: takes.createdAt,
      author: owners.address,
    })
    .from(takes)
    .innerJoin(owners, eq(owners.id, takes.ownerId))
    .where(options.symbol ? sql`${takes.tags} @> array[${options.symbol}]::text[]` : undefined)
    .orderBy(desc(takes.createdAt))
    .limit(options.limit)
}

export type RoomLine = Awaited<ReturnType<typeof roomThread>>[number]
export type TakeRow = Awaited<ReturnType<typeof latestTakes>>[number]
