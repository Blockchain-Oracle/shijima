/**
 * The free $1 (PLAN-ROUND-3 D3). The website queues a claim; the worker sends it and settles it here.
 *
 * The rules live in `queueGift`, inside one transaction under one lock, so two claims arriving together can never
 * both squeeze under the cap or both pass the IP check: one wallet once, one connection once, and only as many as the gift wallet can pay.
 */
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { type GiftAttempt, type GiftLeg, giftClaims } from '../schema'

/** $1 in USDG raw units (6 decimals). */
export const GIFT_USDG = 1_000_000n
/** 0.00008 ETH: enough gas to create an agent, fund it and later withdraw. */
export const GIFT_ETH_WEI = 80_000_000_000_000n
export const GIFT_CAP_DEFAULT = 20

/** Any fixed number: the lock every claim takes, so the rules are checked one claim at a time. */
const GIFT_LOCK_KEY = 4663_0009

export type GiftRow = typeof giftClaims.$inferSelect

export type GiftQueued =
  | { ok: true; row: GiftRow; requeued: boolean }
  | { ok: false; reason: 'already' | 'ip_used' | 'all_gone'; row?: GiftRow }

/**
 * Queues the gift for a signed-in wallet. A wallet whose earlier claim failed is queued again (a retry), and the
 * worker then sends only the leg that never paid. Anything else already on file is refused.
 */
export async function queueGift(
  db: Db,
  input: { wallet: string; ipHash: string; cap: number; now?: Date },
): Promise<GiftQueued> {
  const wallet = input.wallet.toLowerCase()
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${GIFT_LOCK_KEY})`)
    const [mine] = await tx.select().from(giftClaims).where(eq(giftClaims.wallet, wallet))
    if (mine) {
      if (mine.status !== 'failed') return { ok: false, reason: 'already', row: mine }
      const [row] = await tx
        .update(giftClaims)
        .set({ status: 'queued', error: null, updatedAt: now })
        .where(and(eq(giftClaims.id, mine.id), eq(giftClaims.status, 'failed')))
        .returning()
      return row ? { ok: true, row, requeued: true } : { ok: false, reason: 'already', row: mine }
    }
    const [total] = await tx.select({ n: count() }).from(giftClaims)
    if ((total?.n ?? 0) >= input.cap) return { ok: false, reason: 'all_gone' }
    // One per connection, ever (25 Sep, Abu): a fresh wallet on the same connection cannot claim a second dollar.
    const [sameIp] = await tx
      .select({ n: count() })
      .from(giftClaims)
      .where(eq(giftClaims.ipHash, input.ipHash))
    if ((sameIp?.n ?? 0) > 0) return { ok: false, reason: 'ip_used' }
    const [row] = await tx
      .insert(giftClaims)
      .values({
        wallet,
        ipHash: input.ipHash,
        usdgAmount: GIFT_USDG,
        ethAmountWei: GIFT_ETH_WEI,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!row) throw new Error('the gift claim was not saved')
    return { ok: true, row, requeued: false }
  })
}

export async function giftOfWallet(db: DbOrTx, wallet: string): Promise<GiftRow | undefined> {
  const [row] = await db.select().from(giftClaims).where(eq(giftClaims.wallet, wallet.toLowerCase()))
  return row
}

/** Claims on file that the worker has not paid yet: they are owed out of the gift wallet's current balance. */
export async function giftsOwed(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(giftClaims)
    .where(inArray(giftClaims.status, ['queued', 'sending']))
  return row?.n ?? 0
}

/** How many gifts are spoken for: every claim on file counts, sent or still on its way. */
export async function giftsClaimed(db: DbOrTx): Promise<number> {
  const [row] = await db.select({ n: count() }).from(giftClaims)
  return row?.n ?? 0
}

// The worker's side. Only the worker (the leader, one process) calls these.

/** Claims the worker has started sending and not yet finished. Settled before anything new is sent. */
export function sendingGifts(db: DbOrTx): Promise<GiftRow[]> {
  return db
    .select()
    .from(giftClaims)
    .where(eq(giftClaims.status, 'sending'))
    .orderBy(asc(giftClaims.createdAt))
}

export async function nextQueuedGift(db: DbOrTx): Promise<GiftRow | undefined> {
  const [row] = await db
    .select()
    .from(giftClaims)
    .where(eq(giftClaims.status, 'queued'))
    .orderBy(asc(giftClaims.createdAt))
    .limit(1)
  return row
}

/** Moves a queued claim to sending. False when the row was no longer queued. */
export async function startGift(db: DbOrTx, id: string): Promise<boolean> {
  const rows = await db
    .update(giftClaims)
    .set({ status: 'sending', error: null, updatedAt: new Date() })
    .where(and(eq(giftClaims.id, id), eq(giftClaims.status, 'queued')))
    .returning({ id: giftClaims.id })
  return rows.length > 0
}

/** The write-ahead step: a signed transfer is recorded here BEFORE it is broadcast. */
export async function journalGiftAttempt(db: Db, id: string, attempt: GiftAttempt): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(giftClaims).where(eq(giftClaims.id, id)).for('update')
    if (!row) throw new Error(`no gift claim ${id}`)
    await tx
      .update(giftClaims)
      .set({ attempts: [...row.attempts, attempt], updatedAt: new Date() })
      .where(eq(giftClaims.id, id))
  })
}

/** Records what became of one signed transfer. A confirmed one is the leg's payment, and is kept as its tx. */
export async function settleGiftAttempt(
  db: Db,
  id: string,
  txHash: string,
  outcome: NonNullable<GiftAttempt['outcome']>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(giftClaims).where(eq(giftClaims.id, id)).for('update')
    if (!row) throw new Error(`no gift claim ${id}`)
    const hash = txHash.toLowerCase()
    const attempt = row.attempts.find((a) => a.txHash === hash)
    if (!attempt) throw new Error(`gift claim ${id} never journaled ${hash}`)
    const attempts = row.attempts.map((a) => (a.txHash === hash ? { ...a, outcome } : a))
    const paid: Partial<Record<'usdgTx' | 'ethTx', string>> =
      outcome === 'confirmed' ? { [attempt.leg === 'usdg' ? 'usdgTx' : 'ethTx']: hash } : {}
    await tx
      .update(giftClaims)
      .set({ attempts, ...paid, updatedAt: new Date() })
      .where(eq(giftClaims.id, id))
  })
}

export async function finishGift(
  db: DbOrTx,
  id: string,
  result: { status: 'sent' } | { status: 'failed'; error: string },
): Promise<void> {
  await db
    .update(giftClaims)
    .set({
      status: result.status,
      error: result.status === 'failed' ? result.error : null,
      updatedAt: new Date(),
    })
    .where(eq(giftClaims.id, id))
}

/** Says on every waiting claim why it is waiting (the sender is off), so the website can show it. */
export async function noteQueuedGifts(db: DbOrTx, note: string): Promise<number> {
  const rows = await db
    .update(giftClaims)
    .set({ error: note })
    .where(and(eq(giftClaims.status, 'queued'), sql`${giftClaims.error} is distinct from ${note}`))
    .returning({ id: giftClaims.id })
  return rows.length
}

/** The transfers of one leg that may still land: signed and journaled, with no outcome yet. */
export const openAttempts = (row: GiftRow, leg: GiftLeg): GiftAttempt[] =>
  row.attempts.filter((a) => a.leg === leg && !a.outcome)
