/**
 * Telegram tied to the owner's wallet (DECISIONS F6), not to one desk. The owner row is the say-so and the chat;
 * each open desk still gets its own `telegram_links` row, because the outbox and the pinned status message are
 * per desk. Claiming a code links every open desk; `registerDesk` calls `attachOwnerTelegram` for each new one.
 *
 * The old per-desk codes still work: a chat linked that way keeps hearing about its one desk.
 */
import { randomBytes } from 'node:crypto'
import { and, desc, eq, gt, inArray, ne, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { deskEvents, desks, owners, telegramLinks, telegramOwners } from '../schema'
import type { By } from './engine'

export type TelegramOwnerRow = typeof telegramOwners.$inferSelect

/**
 * A desk the chat may hear about and act on: open, and past the studio (deployed, or registered by a script and
 * running). A draft that never reached the chain must never become the chat's agent: /pause would hit it while the
 * live one trades.
 */
export const finishedDesk = sql`(${desks.lifecycle} <> 'closed' and (${desks.deployedAt} is not null or ${desks.lifecycle} <> 'onboarding'))`

/** A code for a desk row the owner never typed: unique, never shown, already spent. */
const spentCode = () => `o${randomBytes(9).toString('hex')}`

/** A single-use code that ties a Telegram chat to the owner's wallet. It dies after ten minutes. */
export async function createTelegramOwnerLink(db: DbOrTx, ownerId: string, code: string, minutes = 10) {
  const [row] = await db
    .insert(telegramOwners)
    .values({ ownerId, code, codeExpiresAt: new Date(Date.now() + minutes * 60_000) })
    .returning()
  return row
}

/** The owner's Telegram as settings shows it: connected, or a code still waiting to be used. */
export async function telegramForOwner(db: DbOrTx, ownerId: string) {
  const rows = await db
    .select({
      id: telegramOwners.id,
      status: telegramOwners.status,
      code: telegramOwners.code,
      codeExpiresAt: telegramOwners.codeExpiresAt,
      username: telegramOwners.telegramUsername,
      linkedAt: telegramOwners.linkedAt,
    })
    .from(telegramOwners)
    .where(and(eq(telegramOwners.ownerId, ownerId), inArray(telegramOwners.status, ['pending', 'linked'])))
    .orderBy(desc(telegramOwners.createdAt))
  const linked = rows.find((r) => r.status === 'linked')
  if (linked) return { linked, pending: null }
  // An owner who linked a desk the old way is connected too: show that chat rather than ask again.
  const [legacy] = await db
    .select({ username: telegramLinks.telegramUsername, linkedAt: telegramLinks.linkedAt })
    .from(telegramLinks)
    .innerJoin(desks, eq(telegramLinks.deskId, desks.id))
    .where(and(eq(desks.ownerId, ownerId), eq(telegramLinks.status, 'linked')))
    .limit(1)
  const now = Date.now()
  const pending = rows.find((r) => r.status === 'pending' && r.codeExpiresAt.getTime() > now)
  return {
    linked: legacy ? { username: legacy.username, linkedAt: legacy.linkedAt } : null,
    pending: pending ?? null,
  }
}

type Chat = { userId: number; chatId: number; username?: string | null | undefined }

/** Links one desk to the chat, keeping a row that already points at this user (and its pinned message). */
async function linkDeskToChat(tx: DbOrTx, deskId: string, chat: Chat, by: By, now: Date): Promise<boolean> {
  const [same] = await tx
    .select({ id: telegramLinks.id })
    .from(telegramLinks)
    .where(
      and(
        eq(telegramLinks.deskId, deskId),
        eq(telegramLinks.status, 'linked'),
        eq(telegramLinks.telegramUserId, chat.userId),
      ),
    )
  if (same) return false
  await tx
    .update(telegramLinks)
    .set({ status: 'revoked', revokedAt: now })
    .where(and(eq(telegramLinks.deskId, deskId), inArray(telegramLinks.status, ['pending', 'linked'])))
  await tx.insert(telegramLinks).values({
    deskId,
    status: 'linked',
    code: spentCode(),
    codeExpiresAt: now,
    telegramUserId: chat.userId,
    telegramChatId: chat.chatId,
    telegramUsername: chat.username ?? null,
    linkedAt: now,
  })
  await tx
    .insert(deskEvents)
    .values({ deskId, kind: 'telegram_linked', actor: by.actor, via: by.via, at: now })
  return true
}

export type TelegramOwnerClaim =
  | { ok: true; row: TelegramOwnerRow; desks: number }
  | { ok: false; reason: 'used' | 'another_desk' }

/**
 * Spends an owner code: the chat now hears about every open desk of that wallet, and every desk made later.
 * Guarded like the desk codes: pending, unexpired, and a Telegram account already speaking for SOMEONE ELSE's
 * wallet is refused, so one chat never mixes two people's money.
 */
export async function claimTelegramOwnerLink(db: Db, code: string, chat: Chat): Promise<TelegramOwnerClaim> {
  const now = new Date()
  const by: By = { actor: 'owner', via: 'telegram' }
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(telegramOwners)
      .where(
        and(
          eq(telegramOwners.code, code),
          eq(telegramOwners.status, 'pending'),
          gt(telegramOwners.codeExpiresAt, now),
        ),
      )
      .for('update')
    if (!pending) return { ok: false, reason: 'used' }
    const [otherOwner] = await tx
      .select({ id: telegramOwners.id })
      .from(telegramOwners)
      .where(
        and(
          eq(telegramOwners.telegramUserId, chat.userId),
          eq(telegramOwners.status, 'linked'),
          ne(telegramOwners.ownerId, pending.ownerId),
        ),
      )
    const [otherDesk] = await tx
      .select({ id: telegramLinks.id })
      .from(telegramLinks)
      .innerJoin(desks, eq(telegramLinks.deskId, desks.id))
      .where(
        and(
          eq(telegramLinks.telegramUserId, chat.userId),
          eq(telegramLinks.status, 'linked'),
          ne(desks.ownerId, pending.ownerId),
        ),
      )
    // A fresh code is the owner signed in on the website, asking for this chat: the chat moves to that wallet.
    // One Telegram talks for one wallet at a time, so its links to any other wallet or agent end here (25 Sep: a
    // chat still tied to an old wallet ignored every new code, and Start seemed to do nothing).
    if (otherOwner || otherDesk) {
      await tx
        .update(telegramOwners)
        .set({ status: 'revoked', revokedAt: now })
        .where(and(eq(telegramOwners.telegramUserId, chat.userId), eq(telegramOwners.status, 'linked')))
      await tx
        .update(telegramLinks)
        .set({ status: 'revoked', revokedAt: now })
        .where(and(eq(telegramLinks.telegramUserId, chat.userId), eq(telegramLinks.status, 'linked')))
    }
    // A new chat for the same wallet replaces the old one, and every other code still waiting dies with it.
    await tx
      .update(telegramOwners)
      .set({ status: 'revoked', revokedAt: now })
      .where(
        and(
          eq(telegramOwners.ownerId, pending.ownerId),
          inArray(telegramOwners.status, ['pending', 'linked']),
          ne(telegramOwners.id, pending.id),
        ),
      )
    const [row] = await tx
      .update(telegramOwners)
      .set({
        status: 'linked',
        telegramUserId: chat.userId,
        telegramChatId: chat.chatId,
        telegramUsername: chat.username ?? null,
        linkedAt: now,
      })
      .where(eq(telegramOwners.id, pending.id))
      .returning()
    if (!row) return { ok: false, reason: 'used' }
    const open = await tx
      .select({ id: desks.id })
      .from(desks)
      .where(and(eq(desks.ownerId, pending.ownerId), finishedDesk))
    for (const d of open) await linkDeskToChat(tx, d.id, chat, by, now)
    return { ok: true, row, desks: open.length }
  })
}

/** A desk just deployed: if its owner has Telegram, it reports there from the start. Idempotent, all or nothing. */
export async function attachOwnerTelegram(db: Db, deskId: string, ownerId: string): Promise<boolean> {
  return db.transaction((tx) => attachIn(tx, deskId, ownerId))
}

async function attachIn(db: DbOrTx, deskId: string, ownerId: string): Promise<boolean> {
  const [ready] = await db
    .select({ id: desks.id })
    .from(desks)
    .where(and(eq(desks.id, deskId), eq(desks.ownerId, ownerId), finishedDesk))
  if (!ready) return false
  const [owned] = await db
    .select({
      userId: telegramOwners.telegramUserId,
      chatId: telegramOwners.telegramChatId,
      username: telegramOwners.telegramUsername,
    })
    .from(telegramOwners)
    .where(and(eq(telegramOwners.ownerId, ownerId), eq(telegramOwners.status, 'linked')))
  // An owner who linked an earlier desk the old way (one code per desk) has a chat too: use it.
  const [legacy] = owned
    ? []
    : await db
        .select({
          userId: telegramLinks.telegramUserId,
          chatId: telegramLinks.telegramChatId,
          username: telegramLinks.telegramUsername,
        })
        .from(telegramLinks)
        .innerJoin(desks, eq(telegramLinks.deskId, desks.id))
        .where(and(eq(desks.ownerId, ownerId), eq(telegramLinks.status, 'linked'), ne(desks.id, deskId)))
        .orderBy(desc(telegramLinks.linkedAt))
        .limit(1)
  const link = owned ?? legacy
  if (!link?.userId || !link.chatId) return false
  const [existing] = await db
    .select({ id: telegramLinks.id })
    .from(telegramLinks)
    .where(and(eq(telegramLinks.deskId, deskId), eq(telegramLinks.status, 'linked')))
  if (existing) return false
  return linkDeskToChat(
    db,
    deskId,
    { userId: link.userId, chatId: link.chatId, username: link.username },
    { actor: 'system', via: 'worker' },
    new Date(),
  )
}

/** Disconnects the wallet's Telegram: the owner row, waiting codes, and every desk's link, at once. */
export async function unlinkOwnerTelegram(db: Db, ownerId: string, by: By): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const owned = await tx
      .update(telegramOwners)
      .set({ status: 'revoked', revokedAt: now })
      .where(and(eq(telegramOwners.ownerId, ownerId), inArray(telegramOwners.status, ['pending', 'linked'])))
      .returning({ id: telegramOwners.id })
    const deskRows = await tx
      .update(telegramLinks)
      .set({ status: 'revoked', revokedAt: now })
      .where(
        and(
          inArray(telegramLinks.status, ['pending', 'linked']),
          inArray(
            telegramLinks.deskId,
            tx.select({ id: desks.id }).from(desks).where(eq(desks.ownerId, ownerId)),
          ),
        ),
      )
      .returning({ deskId: telegramLinks.deskId })
    for (const deskId of new Set(deskRows.map((r) => r.deskId))) {
      await tx
        .insert(deskEvents)
        .values({ deskId, kind: 'telegram_unlinked', actor: by.actor, via: by.via, at: now })
    }
    return owned.length + deskRows.length > 0
  })
}

/** The wallet this Telegram user speaks for, when linked the new way. Undefined for a chat linked per desk. */
export async function telegramOwnerForUser(db: DbOrTx, telegramUserId: number) {
  const [row] = await db
    .select({ link: telegramOwners, owner: owners })
    .from(telegramOwners)
    .innerJoin(owners, eq(telegramOwners.ownerId, owners.id))
    .where(and(eq(telegramOwners.telegramUserId, telegramUserId), eq(telegramOwners.status, 'linked')))
  return row
}

/** Every open desk this Telegram user hears about, oldest first, so a numbered list stays stable. */
export async function desksForTelegramUser(db: DbOrTx, telegramUserId: number) {
  return db
    .select({ id: desks.id, name: desks.name, state: desks.state, mode: desks.mode })
    .from(telegramLinks)
    .innerJoin(desks, eq(telegramLinks.deskId, desks.id))
    .where(
      and(eq(telegramLinks.telegramUserId, telegramUserId), eq(telegramLinks.status, 'linked'), finishedDesk),
    )
    .orderBy(desks.createdAt)
}

/**
 * Which agent the chat's commands act on. Only a desk this user is linked to can be chosen, and only a chat linked
 * to the wallet (an owner row) can choose: a chat linked the old way, per agent, has no switch to offer.
 */
export async function setTelegramCurrentDesk(db: DbOrTx, telegramUserId: number, deskId: string) {
  const rows = await db
    .update(telegramOwners)
    .set({ currentDeskId: deskId })
    .where(
      and(
        eq(telegramOwners.telegramUserId, telegramUserId),
        eq(telegramOwners.status, 'linked'),
        sql`exists (select 1 from ${telegramLinks} join ${desks} on ${desks.id} = ${telegramLinks.deskId}
          where ${telegramLinks.deskId} = ${deskId} and ${telegramLinks.telegramUserId} = ${telegramUserId}
          and ${telegramLinks.status} = 'linked' and ${finishedDesk})`,
      ),
    )
    .returning({ id: telegramOwners.id })
  return rows.length > 0
}

/** Is this chat still linked to this wallet? An answer is dropped rather than sent to a chat that has left. */
export async function chatLinkedToOwner(db: DbOrTx, chatId: number, ownerAddress: string): Promise<boolean> {
  const address = ownerAddress.toLowerCase()
  const [byWallet] = await db
    .select({ id: telegramOwners.id })
    .from(telegramOwners)
    .innerJoin(owners, eq(telegramOwners.ownerId, owners.id))
    .where(
      and(
        eq(telegramOwners.telegramChatId, chatId),
        eq(telegramOwners.status, 'linked'),
        eq(owners.address, address),
      ),
    )
  if (byWallet) return true
  const [byDesk] = await db
    .select({ id: telegramLinks.id })
    .from(telegramLinks)
    .innerJoin(desks, eq(telegramLinks.deskId, desks.id))
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(
      and(
        eq(telegramLinks.telegramChatId, chatId),
        eq(telegramLinks.status, 'linked'),
        eq(owners.address, address),
      ),
    )
  return Boolean(byDesk)
}
