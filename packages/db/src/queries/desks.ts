/** Registering and finding desks. Only a desk with a row here is ever woken or served. */
import { and, eq, isNull } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { desks, owners } from '../schema'

export type DeskRow = typeof desks.$inferSelect

export interface RegisterDeskInput {
  ownerAddress: string
  deskAddress: string
  factory: string
  salt: string
  contractVersion: string
  operator: string
  chainId?: number
  name?: string
  deployedAt?: Date
  deployTx?: string
}

/**
 * Idempotent. Calling it again for the same desk returns the existing row untouched, so scripts can call it
 * on every run. Addresses are stored lowercase, whatever case they arrive in.
 */
export async function registerDesk(db: DbOrTx, input: RegisterDeskInput): Promise<DeskRow> {
  const ownerAddress = input.ownerAddress.toLowerCase()
  const address = input.deskAddress.toLowerCase()
  const chainId = input.chainId ?? 4663

  await db.insert(owners).values({ address: ownerAddress }).onConflictDoNothing({ target: owners.address })
  const [owner] = await db.select().from(owners).where(eq(owners.address, ownerAddress))
  if (!owner) throw new Error(`owner ${ownerAddress} could not be created`)

  await db
    .insert(desks)
    .values({
      ownerId: owner.id,
      chainId,
      address,
      factory: input.factory.toLowerCase(),
      salt: input.salt.toLowerCase(),
      contractVersion: input.contractVersion,
      operator: input.operator.toLowerCase(),
      name: input.name ?? null,
      deployedAt: input.deployedAt ?? null,
      deployTx: input.deployTx?.toLowerCase() ?? null,
    })
    .onConflictDoNothing({ target: [desks.chainId, desks.address] })
  const desk = await findDeskByAddress(db, address, chainId)
  if (!desk) throw new Error(`desk ${address} could not be registered`)
  if (desk.ownerId !== owner.id) {
    throw new Error(`desk ${address} is already registered to a different owner`)
  }
  return desk
}

/**
 * The owner's row for a wallet that has just proved itself. Created on the first sign-in, so the disclosure can
 * be accepted before any desk exists. Idempotent: a returning owner only has their last visit noted.
 */
export async function ensureOwner(db: DbOrTx, address: string): Promise<{ id: string }> {
  const lower = address.toLowerCase()
  const now = new Date()
  await db
    .insert(owners)
    .values({ address: lower, lastSeenAt: now })
    .onConflictDoUpdate({ target: owners.address, set: { lastSeenAt: now } })
  const [owner] = await db.select({ id: owners.id }).from(owners).where(eq(owners.address, lower))
  if (!owner) throw new Error(`owner ${lower} could not be created`)
  return owner
}

export async function findDeskByAddress(
  db: DbOrTx,
  address: string,
  chainId = 4663,
): Promise<DeskRow | undefined> {
  const [row] = await db
    .select()
    .from(desks)
    .where(and(eq(desks.chainId, chainId), eq(desks.address, address.toLowerCase())))
  return row
}

/**
 * The owner's unfinished desk from the studio: a row written at Publish with its own salt and the address the
 * factory will give it, before the contract exists. There is at most one per owner and factory; the studio resumes
 * it rather than making another, so money already sent to that address is never stranded.
 */
export async function draftDeskOf(
  db: DbOrTx,
  ownerAddress: string,
  factory: string,
): Promise<DeskRow | undefined> {
  const [row] = await db
    .select({ desk: desks })
    .from(desks)
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(
      and(
        eq(owners.address, ownerAddress.toLowerCase()),
        eq(desks.factory, factory.toLowerCase()),
        eq(desks.lifecycle, 'onboarding'),
        isNull(desks.deployedAt),
      ),
    )
    .orderBy(desks.createdAt)
    .limit(1)
  return row?.desk
}

/** Names a draft desk. Only a draft: a desk that exists keeps the name it was created with here. */
export async function nameDraftDesk(db: DbOrTx, deskId: string, name: string): Promise<void> {
  await db
    .update(desks)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(desks.id, deskId), eq(desks.lifecycle, 'onboarding'), isNull(desks.deployedAt)))
}

/** The chain confirmed the desk. From here it is served and, once its mandate is applied, woken. */
export async function markDeskDeployed(db: DbOrTx, deskId: string, deployTx: string | null): Promise<void> {
  const now = new Date()
  await db
    .update(desks)
    .set({ deployedAt: now, deployTx: deployTx?.toLowerCase() ?? null, updatedAt: now })
    .where(and(eq(desks.id, deskId), isNull(desks.deployedAt)))
}

/** The owner chose to go on without Telegram (design brief 8.8). Remembered, so the studio stops asking. */
export async function skipTelegram(db: DbOrTx, deskId: string): Promise<void> {
  await db
    .update(desks)
    .set({ telegramSkippedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(desks.id, deskId), isNull(desks.telegramSkippedAt)))
}
