/** Market facts shared by every desk. A close reference is computed from the chain once, then kept. */
import { and, eq } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { referenceSnapshots } from '../schema'

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
