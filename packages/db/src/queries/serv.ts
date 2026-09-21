import type { DbOrTx } from '../client'
import { servCalls } from '../schema'

export type ServCallInsert = typeof servCalls.$inferInsert

/** Every SERV Reasoning call is logged, the failures above all. */
export async function logServCall(db: DbOrTx, call: ServCallInsert): Promise<void> {
  await db.insert(servCalls).values(call)
}
