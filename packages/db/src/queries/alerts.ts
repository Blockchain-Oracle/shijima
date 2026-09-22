/**
 * Price alerts: "tell me when Nvidia is 2% from its reference". The price logger checks them on every row it
 * writes, and an alert fires ONCE. Firing and the message it sends are one transaction, so an alert can never be
 * marked fired without its message, or send twice.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { notifications, priceAlerts } from '../schema'

export type PriceAlertRow = typeof priceAlerts.$inferSelect
export type PriceAlertKind = PriceAlertRow['kind']

/** An owner may keep this many waiting at once. Enough for a watchlist, too few to flood their Telegram. */
export const MAX_ACTIVE_ALERTS = 10

export async function createPriceAlert(
  db: DbOrTx,
  input: { ownerAddress: string; deskId: string; token: string; kind: PriceAlertKind; thresholdBps: number },
): Promise<string> {
  // Telegram and the bell are per desk, so an alert with no desk could never be delivered. Refused here.
  if (!input.deskId) throw new Error('a price alert needs a desk to be delivered to')
  const [row] = await db
    .insert(priceAlerts)
    .values({ ...input, ownerAddress: input.ownerAddress.toLowerCase(), token: input.token.toLowerCase() })
    .returning({ id: priceAlerts.id })
  if (!row) throw new Error('the alert was not saved')
  return row.id
}

export async function activeAlertCount(db: DbOrTx, ownerAddress: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(priceAlerts)
    .where(and(eq(priceAlerts.ownerAddress, ownerAddress.toLowerCase()), eq(priceAlerts.status, 'active')))
  return row?.n ?? 0
}

/** The owner's alerts, waiting ones first, then the most recent that fired. Optionally for one token. */
export async function ownerAlerts(db: DbOrTx, ownerAddress: string, token?: string, limit = 20) {
  const mine = eq(priceAlerts.ownerAddress, ownerAddress.toLowerCase())
  return db
    .select()
    .from(priceAlerts)
    .where(token ? and(mine, eq(priceAlerts.token, token.toLowerCase())) : mine)
    .orderBy(sql`${priceAlerts.status} = 'active' desc`, desc(priceAlerts.createdAt))
    .limit(limit)
}

/** Cancels one of the owner's own waiting alerts. Scoped by owner, so no id from a browser is trusted alone. */
export async function cancelPriceAlert(db: DbOrTx, ownerAddress: string, id: string): Promise<boolean> {
  const rows = await db
    .update(priceAlerts)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(priceAlerts.id, id),
        eq(priceAlerts.ownerAddress, ownerAddress.toLowerCase()),
        eq(priceAlerts.status, 'active'),
      ),
    )
    .returning({ id: priceAlerts.id })
  return rows.length > 0
}

export async function activeAlertsOnTokens(db: DbOrTx, tokens: string[]): Promise<PriceAlertRow[]> {
  if (tokens.length === 0) return []
  return db
    .select()
    .from(priceAlerts)
    .where(
      and(
        eq(priceAlerts.status, 'active'),
        inArray(
          priceAlerts.token,
          tokens.map((t) => t.toLowerCase()),
        ),
      ),
    )
}

/**
 * Marks one alert fired and queues its message, together. Returns false when another run fired it first: the
 * update only matches an alert that is still waiting.
 */
export async function firePriceAlert(
  db: Db,
  alert: PriceAlertRow,
  gapBps: number,
  message: { text: string; symbol: string },
  at: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // An alert with no desk has nowhere to go. It is cancelled, never silently consumed as if it had fired.
    if (!alert.deskId) {
      await tx
        .update(priceAlerts)
        .set({ status: 'cancelled' })
        .where(and(eq(priceAlerts.id, alert.id), eq(priceAlerts.status, 'active')))
      return false
    }
    const fired = await tx
      .update(priceAlerts)
      .set({ status: 'fired', firedAt: at, firedGapBps: gapBps })
      .where(and(eq(priceAlerts.id, alert.id), eq(priceAlerts.status, 'active')))
      .returning({ id: priceAlerts.id })
    if (fired.length === 0) return false
    await tx
      .insert(notifications)
      .values({
        deskId: alert.deskId,
        kind: 'price_alert',
        payload: { text: message.text, symbol: message.symbol, gapBps, alertId: alert.id },
        dedupeKey: `price_alert:${alert.id}`,
      })
      .onConflictDoNothing({ target: [notifications.deskId, notifications.dedupeKey] })
    return true
  })
}
