/** Registering and finding desks. Only a desk with a row here is ever woken or served. */
import { and, eq } from 'drizzle-orm'
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
