/**
 * The owner's own controls and settings: closing the desk, removing and restoring the assistant, Telegram,
 * the disclosure and the inbox. Every write here is called only after the server has checked who is signed in,
 * and every chain-backed one only after the chain itself confirmed the owner's transaction.
 */
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import {
  approvals,
  askRequests,
  decisions,
  deferrals,
  deskEvents,
  desks,
  disclosureAcceptances,
  notifications,
  owners,
  telegramLinks,
} from '../schema'
import type { By } from './engine'

/**
 * A message the owner sent by pressing a button instead of typing. It is saved already answered, because the
 * answer is the card, so the chat thread and the buttons share one history and one set of checks.
 */
export async function createAnsweredRequest(
  db: DbOrTx,
  input: {
    ownerAddress: string
    deskId: string
    via: 'web' | 'telegram'
    question: string
    reply: Record<string, unknown>
  },
): Promise<string> {
  const now = new Date()
  const [row] = await db
    .insert(askRequests)
    .values({
      ownerAddress: input.ownerAddress.toLowerCase(),
      deskId: input.deskId,
      kind: 'ask',
      via: input.via,
      question: input.question,
      payload: { source: 'button' },
      status: 'answered',
      reply: input.reply,
      claimedAt: now,
      answeredAt: now,
      createdAt: now,
    })
    .returning({ id: askRequests.id })
  if (!row) throw new Error('the message was not saved')
  return row.id
}

/** Every promise the running desk made: waiting requests and remembered waits. Ended together, with a reason. */
async function cancelPromises(tx: DbOrTx, deskId: string, reason: string, now: Date) {
  await tx
    .update(approvals)
    .set({ status: 'cancelled', cancelledReason: reason })
    .where(and(eq(approvals.deskId, deskId), eq(approvals.status, 'pending')))
  await tx
    .update(deferrals)
    .set({ status: 'cancelled', endedReason: reason, endedAt: now })
    .where(and(eq(deferrals.deskId, deskId), eq(deferrals.status, 'standing')))
}

/**
 * The owner closed the desk on-chain: everything went home and the assistant was removed. Checks stop for good,
 * because the worker wakes only running desks. The record stays readable.
 */
export async function closeDesk(db: Db, deskId: string, by: By, txHash: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [row] = await tx
      .update(desks)
      .set({
        lifecycle: 'closed',
        closedAt: now,
        state: 'paused_by_owner',
        stateReason: null,
        updatedAt: now,
      })
      .where(and(eq(desks.id, deskId), sql`${desks.lifecycle} <> 'closed'`))
      .returning({ id: desks.id })
    if (!row) return false
    await cancelPromises(tx, deskId, 'the desk was closed', now)
    await tx
      .update(telegramLinks)
      .set({ status: 'revoked', revokedAt: now })
      .where(and(eq(telegramLinks.deskId, deskId), eq(telegramLinks.status, 'linked')))
    await tx
      .insert(deskEvents)
      .values({ deskId, kind: 'closed', actor: by.actor, via: by.via, detail: { txHash }, at: now })
    return true
  })
}

/** Shown on the desk while the assistant is gone, and matched when it comes back. */
export const ASSISTANT_REMOVED =
  'You removed the assistant. It has no access, and your money stays in your account. Restart the desk with your wallet to bring it back.'

/**
 * The owner removed the assistant on-chain. The desk cannot act until it is restored, so it waits for the owner
 * rather than failing a check every hour.
 */
export async function markAssistantRemoved(db: Db, deskId: string, by: By, txHash: string): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date()
    await tx
      .update(desks)
      .set({ state: 'needs_attention', stateReason: ASSISTANT_REMOVED, updatedAt: now })
      .where(eq(desks.id, deskId))
    await cancelPromises(tx, deskId, 'the assistant was removed', now)
    await tx
      .insert(deskEvents)
      .values({ deskId, kind: 'operator_revoked', actor: by.actor, via: by.via, detail: { txHash }, at: now })
  })
}

/**
 * The owner restarted the desk on-chain, and the chain now shows our assistant in place and the desk unpaused.
 * Only a stop the owner caused is lifted here; anything the engine flagged stays for the engine to clear.
 */
export async function markAssistantBack(db: Db, deskId: string, by: By, txHash: string): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date()
    await tx
      .update(desks)
      .set({ state: 'active', stateReason: null, updatedAt: now })
      .where(
        and(
          eq(desks.id, deskId),
          eq(desks.state, 'needs_attention'),
          eq(desks.stateReason, ASSISTANT_REMOVED),
        ),
      )
    await tx
      .insert(deskEvents)
      .values({ deskId, kind: 'operator_set', actor: by.actor, via: by.via, detail: { txHash }, at: now })
  })
}

// ---------------------------------------------------------------- Telegram

/** The desk's Telegram connection as settings shows it: connected, or a code still waiting to be used. */
export async function telegramForDesk(db: DbOrTx, deskId: string) {
  const rows = await db
    .select({
      id: telegramLinks.id,
      status: telegramLinks.status,
      code: telegramLinks.code,
      codeExpiresAt: telegramLinks.codeExpiresAt,
      username: telegramLinks.telegramUsername,
      linkedAt: telegramLinks.linkedAt,
    })
    .from(telegramLinks)
    .where(and(eq(telegramLinks.deskId, deskId), inArray(telegramLinks.status, ['pending', 'linked'])))
    .orderBy(desc(telegramLinks.createdAt))
  const linked = rows.find((r) => r.status === 'linked')
  const now = Date.now()
  const pending = rows.find((r) => r.status === 'pending' && r.codeExpiresAt.getTime() > now)
  return { linked: linked ?? null, pending: pending ?? null }
}

/** Disconnects Telegram. The bot stops answering for this desk at once, and waiting codes die with it. */
export async function unlinkTelegram(db: Db, deskId: string, by: By): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const rows = await tx
      .update(telegramLinks)
      .set({ status: 'revoked', revokedAt: now })
      .where(and(eq(telegramLinks.deskId, deskId), inArray(telegramLinks.status, ['pending', 'linked'])))
      .returning({ status: telegramLinks.status })
    if (rows.length === 0) return false
    await tx
      .insert(deskEvents)
      .values({ deskId, kind: 'telegram_unlinked', actor: by.actor, via: by.via, at: now })
    return true
  })
}

// ---------------------------------------------------------------- the disclosure

export async function disclosureAccepted(db: DbOrTx, ownerId: string, version: string) {
  const [row] = await db
    .select({ acceptedAt: disclosureAcceptances.acceptedAt })
    .from(disclosureAcceptances)
    .where(and(eq(disclosureAcceptances.ownerId, ownerId), eq(disclosureAcceptances.version, version)))
  return row?.acceptedAt ?? null
}

/** One acceptance per owner per version, and only with the declaration that they are not in a restricted place. */
export async function acceptDisclosure(db: DbOrTx, ownerId: string, version: string): Promise<void> {
  await db
    .insert(disclosureAcceptances)
    .values({ ownerId, version, notRestricted: true })
    .onConflictDoNothing()
}

// ---------------------------------------------------------------- the inbox

/** The kinds an owner reads in the web inbox. The pinned status message is Telegram's own, so it is left out. */
export const INBOX_KINDS = [
  'approval_request',
  'large_action_request',
  'acted',
  'would_have',
  'not_acted',
  'alert',
  'monday_report',
  'price_alert',
] as const

/** The owner's messages across every desk they own, newest first. */
export async function ownerInbox(db: DbOrTx, ownerAddress: string, limit = 30) {
  return db
    .select({
      id: notifications.id,
      deskId: notifications.deskId,
      deskName: desks.name,
      kind: notifications.kind,
      payload: notifications.payload,
      decisionSeq: decisions.seq,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .innerJoin(desks, eq(notifications.deskId, desks.id))
    .leftJoin(decisions, eq(notifications.decisionId, decisions.id))
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(and(eq(owners.address, ownerAddress.toLowerCase()), inArray(notifications.kind, [...INBOX_KINDS])))
    .orderBy(desc(notifications.id))
    .limit(limit)
}

export async function unreadCount(db: DbOrTx, ownerAddress: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .innerJoin(desks, eq(notifications.deskId, desks.id))
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(
      and(
        eq(owners.address, ownerAddress.toLowerCase()),
        inArray(notifications.kind, [...INBOX_KINDS]),
        isNull(notifications.readAt),
      ),
    )
  return row?.n ?? 0
}

/** Marks every message the owner can see as read. Scoped to the owner's own desks, so no id is trusted. */
export async function markInboxRead(db: DbOrTx, ownerAddress: string): Promise<void> {
  await db.execute(sql`
    update ${notifications} set read_at = now()
    where read_at is null
      and desk_id in (
        select d.id from ${desks} d join ${owners} o on o.id = d.owner_id where o.address = ${ownerAddress.toLowerCase()}
      )
  `)
}
