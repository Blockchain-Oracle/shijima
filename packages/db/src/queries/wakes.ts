/** One check of one desk. The unique key on (desk, scheduled_for) is what makes a double fire harmless. */
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { wakes } from '../schema'

export type WakeRow = typeof wakes.$inferSelect
export type WakeTrigger = WakeRow['trigger']

/** Returns undefined when this desk already has a wake for that time: someone else got there first. */
export async function startWake(
  db: DbOrTx,
  input: { deskId: string; scheduledFor: Date; trigger: WakeTrigger },
): Promise<WakeRow | undefined> {
  const [row] = await db
    .insert(wakes)
    .values(input)
    .onConflictDoNothing({ target: [wakes.deskId, wakes.scheduledFor] })
    .returning()
  return row
}

export async function finishWake(
  db: DbOrTx,
  wakeId: string,
  outcome: {
    status: Exclude<WakeRow['status'], 'running'>
    error?: string
    sourceHealth?: Record<string, unknown>
  },
): Promise<void> {
  await db
    .update(wakes)
    .set({
      status: outcome.status,
      error: outcome.error ?? null,
      sourceHealth: outcome.sourceHealth ?? null,
      finishedAt: new Date(),
    })
    .where(eq(wakes.id, wakeId))
}
