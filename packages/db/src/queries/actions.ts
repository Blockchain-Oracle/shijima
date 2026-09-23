/**
 * The life of one operator transaction, as guarded state changes.
 *
 *   planned -> prepared -> sent -> confirmed | reverted | never_landed
 *
 * `prepared` is committed BEFORE the transaction is broadcast, so after any crash the database already knows
 * the hash to look for. A `prepared` row may in fact have been broadcast (the crash came before `sent` was
 * written), so the resolver treats prepared and sent alike: it asks the chain.
 *
 * Every change is `update ... where status = <expected> returning`. No row back means someone else already
 * moved it, and that is an error here, never a silent overwrite.
 */
import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { actions, decisions, desks } from '../schema'
import type { ActionRow } from './records'

export class ActionStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionStateError'
  }
}

const UNRESOLVED = ['planned', 'prepared', 'sent'] as const
/** A failed trade leg fails the decision. A failed seal or pause does not: the decision still stands. */
const TRADE_LEGS: ActionRow['kind'][] = ['buy', 'sell', 'sweep', 'redeem']

export interface SignedTransaction {
  txHash: string
  nonce: number
  calldataHash: string
  /** The contract's own deadline, when the call has one. Without one, never_landed cannot be proven by time. */
  deadlineUnix?: number
}

/** One action row by id: what an outside caller (the AgentKit action) must name before it may send anything. */
export async function actionById(db: DbOrTx, actionId: string): Promise<ActionRow | undefined> {
  const [row] = await db.select().from(actions).where(eq(actions.id, actionId))
  return row
}

export async function markActionPrepared(
  db: DbOrTx,
  actionId: string,
  signed: SignedTransaction,
): Promise<ActionRow> {
  const [row] = await db
    .update(actions)
    .set({
      status: 'prepared',
      txHash: signed.txHash.toLowerCase(),
      nonce: signed.nonce,
      calldataHash: signed.calldataHash.toLowerCase(),
      deadlineUnix: signed.deadlineUnix ?? null,
      preparedAt: new Date(),
    })
    .where(and(eq(actions.id, actionId), eq(actions.status, 'planned')))
    .returning()
  if (!row)
    throw new ActionStateError(`action ${actionId} is not in "planned", so it cannot become "prepared"`)
  return row
}

export async function markActionSent(db: DbOrTx, actionId: string): Promise<ActionRow> {
  const [row] = await db
    .update(actions)
    .set({ status: 'sent', sentAt: new Date() })
    .where(and(eq(actions.id, actionId), eq(actions.status, 'prepared')))
    .returning()
  if (!row) throw new ActionStateError(`action ${actionId} is not in "prepared", so it cannot become "sent"`)
  return row
}

export type ActionResolution =
  | {
      status: 'confirmed'
      chainSeq: number
      blockNumber: number
      gasUsed: bigint
      effectiveGasPrice: bigint
      actualOut?: bigint
      feedPriceE8?: bigint
    }
  | {
      status: 'reverted'
      blockNumber: number
      gasUsed: bigint
      effectiveGasPrice: bigint
      failureCode: string
      failureDetail?: string
    }
  | { status: 'never_landed'; failureCode: string; failureDetail?: string }

/**
 * Settles an action and everything that follows from it, in one transaction:
 *   confirmed     seals every unsealed record of the desk up to and including this one, because the
 *                 on-chain hash commits to the whole chain behind it, and moves the desk's chain_seq forward
 *   reverted or   a trade leg marks its decision `failed` with the named cause. A seal or pause does not
 *   never_landed
 */
export async function resolveAction(
  db: Db,
  actionId: string,
  resolution: ActionResolution,
): Promise<ActionRow> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [row] = await tx
      .update(actions)
      .set(
        resolution.status === 'confirmed'
          ? {
              status: 'confirmed',
              chainSeq: resolution.chainSeq,
              blockNumber: resolution.blockNumber,
              gasUsed: resolution.gasUsed,
              effectiveGasPrice: resolution.effectiveGasPrice,
              actualOut: resolution.actualOut ?? null,
              feedPriceE8: resolution.feedPriceE8 ?? null,
              resolvedAt: now,
            }
          : resolution.status === 'reverted'
            ? {
                status: 'reverted',
                blockNumber: resolution.blockNumber,
                gasUsed: resolution.gasUsed,
                effectiveGasPrice: resolution.effectiveGasPrice,
                failureCode: resolution.failureCode,
                failureDetail: resolution.failureDetail ?? null,
                resolvedAt: now,
              }
            : {
                status: 'never_landed',
                failureCode: resolution.failureCode,
                failureDetail: resolution.failureDetail ?? null,
                resolvedAt: now,
              },
      )
      .where(and(eq(actions.id, actionId), inArray(actions.status, [...UNRESOLVED])))
      .returning()
    if (!row) throw new ActionStateError(`action ${actionId} is already resolved or does not exist`)

    if (resolution.status === 'confirmed') {
      // A pause carries no decision hash and advances nothing on the chain, so it seals no record.
      if (row.kind === 'pause') return row
      if (!row.txHash) throw new ActionStateError(`action ${actionId} confirmed without a transaction hash`)
      const [decision] = await tx
        .select({ seq: decisions.seq })
        .from(decisions)
        .where(eq(decisions.id, row.decisionId))
      if (!decision) throw new ActionStateError(`action ${actionId} has no decision`)
      await tx
        .update(decisions)
        .set({ sealedByTx: row.txHash, sealedAt: now })
        .where(
          and(
            eq(decisions.deskId, row.deskId),
            lte(decisions.seq, decision.seq),
            isNull(decisions.sealedByTx),
          ),
        )
      await tx
        .update(desks)
        .set({ chainSeq: sql`greatest(${desks.chainSeq}, ${resolution.chainSeq})`, updatedAt: now })
        .where(eq(desks.id, row.deskId))
    } else if (TRADE_LEGS.includes(row.kind)) {
      await tx
        .update(decisions)
        .set({ outcome: 'failed', failureCode: resolution.failureCode })
        .where(eq(decisions.id, row.decisionId))
    }
    return row
  })
}

export interface UnresolvedAction {
  action: ActionRow
  deskAddress: string
  recordHash: string
  recordSeq: number
}

/** Everything the resolver must settle before the worker sends anything new. Oldest first. */
export async function unresolvedActions(db: DbOrTx): Promise<UnresolvedAction[]> {
  return db
    .select({
      action: actions,
      deskAddress: desks.address,
      recordHash: decisions.recordHash,
      recordSeq: decisions.seq,
    })
    .from(actions)
    .innerJoin(decisions, eq(actions.decisionId, decisions.id))
    .innerJoin(desks, eq(actions.deskId, desks.id))
    .where(inArray(actions.status, [...UNRESOLVED]))
    .orderBy(asc(actions.plannedAt), asc(actions.leg))
}
