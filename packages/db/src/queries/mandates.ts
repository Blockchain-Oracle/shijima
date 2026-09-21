/**
 * Applying a mandate. Editing never rewrites history: the mandate in force becomes `superseded` and a new
 * version is `applied`, in one transaction. A decision record names the version it was made under.
 *
 * A mandate change also cancels every pending approval and standing deferral, because both were promises made
 * under the old instructions (architecture 1.4 step 8).
 */
import type { Mandate } from '@desk/shared'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { approvals, deferrals, deskEvents, desks, mandates } from '../schema'

export type MandateRow = typeof mandates.$inferSelect

export async function currentMandate(db: DbOrTx, deskId: string): Promise<MandateRow | undefined> {
  const [row] = await db
    .select()
    .from(mandates)
    .where(and(eq(mandates.deskId, deskId), eq(mandates.status, 'applied')))
  return row
}

export async function applyMandate(
  db: Db,
  deskId: string,
  mandate: Mandate,
  by: { actor: 'owner' | 'desk' | 'system'; via: 'web' | 'telegram' | 'chain' | 'worker' },
): Promise<MandateRow> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [last] = await tx
      .select({ version: mandates.version })
      .from(mandates)
      .where(eq(mandates.deskId, deskId))
      .orderBy(desc(mandates.version))
      .limit(1)
    await tx
      .update(mandates)
      .set({ status: 'superseded', supersededAt: now })
      .where(and(eq(mandates.deskId, deskId), eq(mandates.status, 'applied')))
    const [row] = await tx
      .insert(mandates)
      .values({
        deskId,
        version: (last?.version ?? 0) + 1,
        status: 'applied',
        preset: mandate.preset,
        targets: {
          cashBps: mandate.targets.cashBps,
          tokens: mandate.targets.tokens.map((t) => ({
            token: t.token.toLowerCase(),
            weightBps: t.weightBps,
          })),
        },
        driftToleranceBps: mandate.driftToleranceBps,
        maxPositionBps: mandate.maxPositionBps,
        perActionCapUsdg: mandate.perActionCapUsdg,
        dailyCapUsdg: mandate.dailyCapUsdg,
        lossStopBps: mandate.lossStopBps,
        largeActionUsdg: mandate.largeActionUsdg,
        notes: mandate.notes,
        appliedAt: now,
      })
      .returning()
    if (!row) throw new Error('the mandate was not saved')

    await tx
      .update(approvals)
      .set({ status: 'cancelled', cancelledReason: 'the mandate changed' })
      .where(and(eq(approvals.deskId, deskId), eq(approvals.status, 'pending')))
    await tx
      .update(deferrals)
      .set({ status: 'cancelled', endedReason: 'the mandate changed', endedAt: now })
      .where(and(eq(deferrals.deskId, deskId), eq(deferrals.status, 'standing')))
    await tx.insert(deskEvents).values({
      deskId,
      kind: 'mandate_applied',
      actor: by.actor,
      via: by.via,
      detail: { version: row.version, preset: mandate.preset },
      at: now,
    })
    return row
  })
}

/** The row as the engine's Mandate type. The database already stores amounts as bigint. */
export function mandateFromRow(row: MandateRow): Mandate {
  return {
    preset: row.preset,
    targets: row.targets,
    driftToleranceBps: row.driftToleranceBps,
    maxPositionBps: row.maxPositionBps,
    perActionCapUsdg: row.perActionCapUsdg,
    dailyCapUsdg: row.dailyCapUsdg,
    lossStopBps: row.lossStopBps,
    largeActionUsdg: row.largeActionUsdg,
    notes: row.notes,
  }
}

/** How many checks a desk has completed. Shadow to live is earned with 24 of them. */
export async function bumpShadowChecks(db: DbOrTx, deskId: string): Promise<void> {
  await db
    .update(desks)
    .set({ shadowChecks: sql`${desks.shadowChecks} + 1` })
    .where(eq(desks.id, deskId))
}
