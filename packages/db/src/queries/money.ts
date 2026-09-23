/**
 * Money moves: what the owner started in the app (fund, withdraw, send, bridge, get gas), and the money rows
 * reconcile writes when it finds an agent's balances changed. The two meet here: a change reconcile finds is tied
 * to the move that caused it, so the record can say "You added $5" and the charts can net it out.
 */
import { and, desc, eq, gt, inArray, isNull, lte, notExists, sql } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { cashFlows, desks, deskValueSnapshots, type MoneyMoveStep, moneyMoves, owners } from '../schema'

export type MoneyMoveRow = typeof moneyMoves.$inferSelect
export type MoneyMoveKind = MoneyMoveRow['kind']
export type MoneyMoveStatus = MoneyMoveRow['status']
export type CashFlowRow = typeof cashFlows.$inferSelect

/** A move's ending is final once it is one of these. `on_its_way` and `may_have_been_sent` can still settle. */
export const SETTLED_MOVE: readonly MoneyMoveStatus[] = ['done', 'nothing_sent', 'approved_only']

/** How far a found change may differ from the move's planned dollars and still be that move: Relay's fees, slippage. */
const MATCH_TOLERANCE_BPS = 200n
/** A move older than this is never matched: a change a week later is something else. */
const MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export async function createMoneyMove(
  db: DbOrTx,
  input: {
    ownerId: string
    deskId: string | null
    kind: MoneyMoveKind
    fromChainId: number
    toChainId: number
    tokenIn: string
    amountIn: bigint
    tokenOut: string
    amountOutQuoted: bigint | null
    usdgValue: bigint | null
    feeUsdg: bigint | null
    recipient: string
    steps: MoneyMoveStep[]
    relayRequestId?: string | null
    status?: MoneyMoveStatus
    txHashes?: string[]
  },
): Promise<MoneyMoveRow> {
  const [row] = await db
    .insert(moneyMoves)
    .values({
      ...input,
      tokenIn: input.tokenIn.toLowerCase(),
      tokenOut: input.tokenOut.toLowerCase(),
      recipient: input.recipient.toLowerCase(),
      relayRequestId: input.relayRequestId ?? null,
    })
    .returning()
  if (!row) throw new Error('the money move was not saved')
  return row
}

/** One move, only if it belongs to this wallet. An id from the browser proves nothing on its own. */
export async function moneyMoveForOwner(
  db: DbOrTx,
  id: string,
  ownerAddress: string,
): Promise<MoneyMoveRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  const [row] = await db
    .select({ move: moneyMoves })
    .from(moneyMoves)
    .innerJoin(owners, eq(owners.id, moneyMoves.ownerId))
    .where(and(eq(moneyMoves.id, id), eq(owners.address, ownerAddress.toLowerCase())))
  return row?.move
}

/** The browser sent one step. The hash is kept at once, so a closed tab never loses where the money went. */
export async function addMoneyMoveHash(db: DbOrTx, id: string, hash: string): Promise<void> {
  await db
    .update(moneyMoves)
    .set({
      txHashes: sql`case when ${hash.toLowerCase()} = any(${moneyMoves.txHashes}) then ${moneyMoves.txHashes} else array_append(${moneyMoves.txHashes}, ${hash.toLowerCase()}) end`,
      updatedAt: new Date(),
    })
    .where(eq(moneyMoves.id, id))
}

export async function settleMoneyMove(
  db: DbOrTx,
  id: string,
  input: {
    status: MoneyMoveStatus
    amountOutActual?: bigint | null
    relayRequestId?: string | null
    error?: string | null
  },
): Promise<MoneyMoveRow | undefined> {
  const [row] = await db
    .update(moneyMoves)
    .set({
      status: input.status,
      ...(input.amountOutActual === undefined ? {} : { amountOutActual: input.amountOutActual }),
      ...(input.relayRequestId === undefined ? {} : { relayRequestId: input.relayRequestId }),
      ...(input.error === undefined ? {} : { error: input.error?.slice(0, 500) ?? null }),
      updatedAt: new Date(),
    })
    .where(eq(moneyMoves.id, id))
    .returning()
  return row
}

/** The owner's moves, newest first, for Activity and Evidence. With the agent's name and slug when there is one. */
export async function moneyMovesOfOwner(db: DbOrTx, ownerAddress: string, limit = 50) {
  return db
    .select({
      move: moneyMoves,
      deskName: desks.name,
      deskSlug: desks.shareSlug,
      deskAddress: desks.address,
    })
    .from(moneyMoves)
    .innerJoin(owners, eq(owners.id, moneyMoves.ownerId))
    .leftJoin(desks, eq(desks.id, moneyMoves.deskId))
    .where(eq(owners.address, ownerAddress.toLowerCase()))
    .orderBy(desc(moneyMoves.createdAt))
    .limit(limit)
}

/**
 * The move that explains money reconcile found arriving in or leaving a desk: the newest one for that desk, in the
 * same direction, that went through (or is on its way), is not tied to a change already, and whose planned dollars
 * are within 2% of what arrived. Undefined when none fits: the change is then simply "outside the agent".
 */
export async function matchMoneyMove(
  db: DbOrTx,
  input: { deskId: string; netUsdg: bigint; at: Date },
): Promise<MoneyMoveRow | undefined> {
  if (input.netUsdg === 0n) return undefined
  const kinds: MoneyMoveKind[] = input.netUsdg > 0n ? ['fund', 'bridge_in'] : ['withdraw']
  const size = input.netUsdg < 0n ? -input.netUsdg : input.netUsdg
  const candidates = await db
    .select()
    .from(moneyMoves)
    .where(
      and(
        eq(moneyMoves.deskId, input.deskId),
        inArray(moneyMoves.kind, kinds),
        inArray(moneyMoves.status, ['on_its_way', 'done', 'may_have_been_sent']),
        gt(moneyMoves.createdAt, new Date(input.at.getTime() - MATCH_WINDOW_MS)),
        lte(moneyMoves.createdAt, input.at),
        notExists(db.select({ one: sql`1` }).from(cashFlows).where(eq(cashFlows.moneyMoveId, moneyMoves.id))),
      ),
    )
    .orderBy(desc(moneyMoves.createdAt))
    .limit(10)
  return candidates.find((m) => {
    const planned = m.amountOutActual ?? m.usdgValue
    if (planned === null || planned === 0n) return false
    const gap = planned > size ? planned - size : size - planned
    return gap * 10_000n <= planned * MATCH_TOLERANCE_BPS
  })
}

/** One change reconcile found, as it writes it: signed raw units of an asset, and signed dollars when priced. */
export interface FoundFlow {
  /** A lowercase token address: USDG, the vault's shares, or a Stock Token. */
  token: string
  delta: bigint
  usdgValue: bigint | null
}

/** The money rows for one snapshot, written in the same transaction as the snapshot itself. */
export async function insertFoundFlows(
  db: DbOrTx,
  input: { deskId: string; snapshotId: number; moneyMoveId: string | null; at: Date; flows: FoundFlow[] },
): Promise<void> {
  const rows = input.flows
    .filter((f) => f.delta !== 0n)
    .map((f) => ({
      deskId: input.deskId,
      kind: f.delta > 0n ? ('deposit' as const) : ('withdrawal' as const),
      status: 'confirmed' as const,
      token: f.token.toLowerCase(),
      amount: f.delta < 0n ? -f.delta : f.delta,
      usdgValue: f.usdgValue === null ? null : f.usdgValue < 0n ? -f.usdgValue : f.usdgValue,
      snapshotId: input.snapshotId,
      moneyMoveId: input.moneyMoveId,
      detectedAt: input.at,
      confirmedAt: input.at,
    }))
  if (rows.length === 0) return
  await db.insert(cashFlows).values(rows).onConflictDoNothing()
}

/** The running total of money in minus out at the desk's newest snapshot. 0 before the first. */
export async function latestFlowsUsdg(db: DbOrTx, deskId: string): Promise<bigint> {
  const [row] = await db
    .select({ flows: deskValueSnapshots.flowsUsdg })
    .from(deskValueSnapshots)
    .where(eq(deskValueSnapshots.deskId, deskId))
    .orderBy(desc(deskValueSnapshots.takenAt))
    .limit(1)
  return row?.flows ?? 0n
}

/**
 * Money that came into or left a desk, newest first, with the move behind it when one matched. One row per
 * snapshot: the dollars of every asset that moved in that check, added up, signed (positive came in).
 */
export async function deskFlows(db: DbOrTx, deskId: string, limit = 100) {
  const rows = await db
    .select({
      snapshotId: cashFlows.snapshotId,
      at: sql<Date>`min(${cashFlows.detectedAt})`.mapWith((v: string | Date) => new Date(v)),
      usdg: sql<string>`coalesce(sum(case when ${cashFlows.kind} = 'deposit' then ${cashFlows.usdgValue} else -${cashFlows.usdgValue} end), 0)::text`,
      moneyMoveId: sql<string | null>`max(${cashFlows.moneyMoveId}::text)`,
      moveKind: sql<MoneyMoveKind | null>`max(${moneyMoves.kind}::text)`,
      fromChainId: sql<number | null>`max(${moneyMoves.fromChainId})`,
    })
    .from(cashFlows)
    .leftJoin(moneyMoves, eq(moneyMoves.id, cashFlows.moneyMoveId))
    .where(and(eq(cashFlows.deskId, deskId), isNull(cashFlows.txHash)))
    .groupBy(cashFlows.snapshotId)
    .orderBy(desc(sql`min(${cashFlows.detectedAt})`))
    .limit(limit)
  return rows.map((r) => ({
    snapshotId: r.snapshotId,
    at: r.at,
    usdg: BigInt(r.usdg),
    moneyMoveId: r.moneyMoveId,
    moveKind: r.moveKind,
    fromChainId: r.fromChainId === null ? null : Number(r.fromChainId),
  }))
}
