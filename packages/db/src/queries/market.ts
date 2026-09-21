/** Market facts shared by every desk. A close reference is computed from the chain once, then kept. */
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { pricePoints, referenceSnapshots } from '../schema'

export type ReferenceRow = typeof referenceSnapshots.$inferSelect

export async function findReference(
  db: DbOrTx,
  token: string,
  kind: 'close' | 'open',
  sessionDate: string,
): Promise<ReferenceRow | undefined> {
  const [row] = await db
    .select()
    .from(referenceSnapshots)
    .where(
      and(
        eq(referenceSnapshots.token, token.toLowerCase()),
        eq(referenceSnapshots.kind, kind),
        eq(referenceSnapshots.sessionDate, sessionDate),
      ),
    )
  return row
}

export async function saveReference(
  db: DbOrTx,
  row: {
    token: string
    kind: 'close' | 'open'
    sessionDate: string
    boundaryAt: Date
    priceE8: bigint
    multiplierRaw: bigint
    txHash: string
    blockNumber: number
  },
): Promise<void> {
  await db
    .insert(referenceSnapshots)
    .values({ ...row, token: row.token.toLowerCase(), txHash: row.txHash.toLowerCase() })
    .onConflictDoNothing({
      target: [referenceSnapshots.token, referenceSnapshots.kind, referenceSnapshots.sessionDate],
    })
}

export type PricePointInsert = typeof pricePoints.$inferInsert
export type PricePointRow = typeof pricePoints.$inferSelect

/** Saves one moment's prices. A slot already written is left as it is, so a restart never writes twice. */
export async function savePricePoints(db: DbOrTx, rows: PricePointInsert[]): Promise<number> {
  if (rows.length === 0) return 0
  const written = await db
    .insert(pricePoints)
    .values(rows.map((r) => ({ ...r, token: r.token.toLowerCase() })))
    .onConflictDoNothing({ target: [pricePoints.token, pricePoints.at] })
    .returning({ id: pricePoints.id })
  return written.length
}

/** True when any token already has a row for this moment. */
export async function priceSlotWritten(db: DbOrTx, at: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: pricePoints.id })
    .from(pricePoints)
    .where(eq(pricePoints.at, at))
    .limit(1)
  return Boolean(row)
}

/** One token's prices between two moments, oldest first: what a chart draws. */
export async function priceSeries(db: DbOrTx, token: string, from: Date, to: Date): Promise<PricePointRow[]> {
  return db
    .select()
    .from(pricePoints)
    .where(
      and(eq(pricePoints.token, token.toLowerCase()), gte(pricePoints.at, from), lte(pricePoints.at, to)),
    )
    .orderBy(asc(pricePoints.at))
}

/** The newest row for every token: what the ticker and the stock cards show. */
export async function latestPricePoints(db: DbOrTx): Promise<PricePointRow[]> {
  return db
    .selectDistinctOn([pricePoints.token])
    .from(pricePoints)
    .orderBy(pricePoints.token, desc(pricePoints.at))
}
