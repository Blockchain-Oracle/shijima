/**
 * What the chat asks the worker to do. The web writes these rows and never sends anything itself.
 */
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { checkRequests, desks } from '../schema'

/** A second "check now" inside this window is refused, so a desk cannot be checked into a hurry. */
export const CHECK_COOLDOWN_MS = 10 * 60 * 1000

export type CheckRequestResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'pending' | 'cooldown' | 'not_running' }

/**
 * Ask for one check at once. Refused while one is already waiting, and within ten minutes of the last one,
 * unless it exists to carry out a "do it anyway" the owner already confirmed.
 */
export async function requestCheck(
  db: Db,
  input: { deskId: string; requestedBy: string; via: 'web' | 'telegram' | 'chat'; proposalId?: string },
  now = new Date(),
): Promise<CheckRequestResult> {
  return db.transaction(async (tx) => {
    const [desk] = await tx
      .select({ lifecycle: desks.lifecycle })
      .from(desks)
      .where(eq(desks.id, input.deskId))
    if (desk?.lifecycle !== 'running') return { ok: false, reason: 'not_running' }
    const [waiting] = await tx
      .select({ id: checkRequests.id })
      .from(checkRequests)
      .where(and(eq(checkRequests.deskId, input.deskId), eq(checkRequests.status, 'pending')))
    if (waiting) return { ok: false, reason: 'pending' }
    if (!input.proposalId) {
      const [recent] = await tx
        .select({ id: checkRequests.id })
        .from(checkRequests)
        .where(
          and(
            eq(checkRequests.deskId, input.deskId),
            isNull(checkRequests.proposalId),
            gt(checkRequests.createdAt, new Date(now.getTime() - CHECK_COOLDOWN_MS)),
          ),
        )
        .orderBy(desc(checkRequests.createdAt))
        .limit(1)
      if (recent) return { ok: false, reason: 'cooldown' }
    }
    const [row] = await tx
      .insert(checkRequests)
      .values({
        deskId: input.deskId,
        requestedBy: input.requestedBy.toLowerCase(),
        via: input.via,
        ...(input.proposalId ? { proposalId: input.proposalId } : {}),
        createdAt: now,
      })
      .returning({ id: checkRequests.id })
    if (!row) throw new Error('the check request was not saved')
    return { ok: true, id: row.id }
  })
}

export async function pendingCheckRequests(db: DbOrTx) {
  return db
    .select()
    .from(checkRequests)
    .where(eq(checkRequests.status, 'pending'))
    .orderBy(asc(checkRequests.createdAt))
}

export async function finishCheckRequest(
  db: DbOrTx,
  id: string,
  outcome: { status: 'done' | 'refused'; refusedReason?: string },
): Promise<void> {
  await db
    .update(checkRequests)
    .set({ status: outcome.status, refusedReason: outcome.refusedReason ?? null, doneAt: new Date() })
    .where(and(eq(checkRequests.id, id), eq(checkRequests.status, 'pending')))
}
