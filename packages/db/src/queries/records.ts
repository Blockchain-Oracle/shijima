/**
 * Appending to a desk's record, and checking that record.
 *
 * Two rules live here and nowhere else:
 *   1. `seq` is gap free and `prev_hash` links each record to the one before it. Both are decided INSIDE a
 *      transaction holding pg_advisory_xact_lock for that desk, so two writers can never fork the chain.
 *   2. What is stored is what was hashed. The row is read back and re-hashed in the same transaction, before
 *      anything is signed. If Postgres changed a single byte that matters, nothing is committed or sent.
 *   4. A body from version 1 on must match the strict shape of its version (shared/schemas/record.ts), checked
 *      before it is hashed.
 *   3. A record names its desk and its chain INSIDE the hashed body, the way an EIP-712 domain does. Without
 *      that, two desks could produce the same fingerprint, and one desk's record could be passed off as
 *      another's. The unique index on record_hash is the backstop.
 */
import { checkRecord, hashRecord, verifyRecord, ZERO_HASH } from '@desk/shared'
import { asc, desc, eq, sql } from 'drizzle-orm'
import type { Hex } from 'viem'
import type { Db, DbOrTx, Tx } from '../client'
import { actions, decisions, desks } from '../schema'

export type DecisionRow = typeof decisions.$inferSelect
export type ActionRow = typeof actions.$inferSelect

/** The place in the chain a new record is given. The record body must carry both values. */
export interface RecordSlot {
  seq: number
  prevHash: Hex
}

export interface PlannedAction {
  kind: ActionRow['kind']
  operator: string
  token?: string
  amountIn?: bigint
  expectedOut?: bigint
  minOut?: bigint
}

export interface RecordDraft {
  /** The hashed body: strings, safe integers, booleans, null, arrays and plain objects only. */
  record: Record<string, unknown>
  schemaVersion: number
  kind?: DecisionRow['kind']
  wakeId?: string
  outcome: DecisionRow['outcome']
  mode: DecisionRow['mode']
  summary: string
  decidedAt: Date
  token?: string
  side?: NonNullable<DecisionRow['side']>
  amountUsdg?: bigint
  confidencePercent?: number
  failureCode?: string
  /** Copy trading: the leader's decision this record copies, or missed copying. Unique per desk. */
  copiedFromDecisionId?: string
  /** Owner-only material that must not be hashed or made public, such as headline text. */
  private?: Record<string, unknown>
  /** On-chain legs this decision intends to send, in order. Inserted as `planned` with the record. */
  actions?: PlannedAction[]
  /**
   * Rows that must exist if and only if this record does: a deferral, an approval request, an outbox message.
   * Runs inside the same transaction, after the record is stored. Database writes only, nothing slow.
   */
  alongside?: (tx: Tx, decision: DecisionRow) => Promise<void>
}

export interface AppendedRecord {
  decision: DecisionRow
  actions: ActionRow[]
  recordHash: Hex
}

export class RecordChainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordChainError'
  }
}

/** Serialises every writer of one desk's record until the surrounding transaction ends. */
export async function lockDeskRecord(tx: Tx, deskId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${deskId}, 0))`)
}

async function nextSlot(tx: Tx, deskId: string): Promise<RecordSlot> {
  const [last] = await tx
    .select({ seq: decisions.seq, recordHash: decisions.recordHash })
    .from(decisions)
    .where(eq(decisions.deskId, deskId))
    .orderBy(desc(decisions.seq))
    .limit(1)
  return { seq: (last?.seq ?? 0) + 1, prevHash: (last?.recordHash ?? ZERO_HASH) as Hex }
}

export interface AppendOptions {
  /**
   * ONLY for importing records that were hashed and sealed on-chain before the database existed. Their body
   * has no `prevHash`, and it cannot be added without changing a fingerprint that is already on-chain.
   */
  legacyBodyWithoutPrevHash?: boolean
}

/**
 * `build` receives the slot and returns the finished draft. It runs while the desk lock is held, so it must
 * be quick and must not do I/O: gather evidence and ask the model BEFORE calling this.
 */
export async function appendRecord(
  db: Db,
  deskId: string,
  build: (slot: RecordSlot) => RecordDraft,
  options: AppendOptions = {},
): Promise<AppendedRecord> {
  return db.transaction(async (tx) => {
    await lockDeskRecord(tx, deskId)
    const [desk] = await tx
      .select({ address: desks.address, chainId: desks.chainId })
      .from(desks)
      .where(eq(desks.id, deskId))
    if (!desk) throw new RecordChainError(`desk ${deskId} is not registered`)
    const slot = await nextSlot(tx, deskId)
    const draft = build(slot)

    const named = draft.record.desk
    if (typeof named !== 'string' || named.toLowerCase() !== desk.address) {
      throw new RecordChainError(`record body names desk ${String(named)}, but it belongs to ${desk.address}`)
    }
    if (draft.record.chainId !== desk.chainId) {
      throw new RecordChainError(
        `record body names chain ${String(draft.record.chainId)}, not ${desk.chainId}`,
      )
    }
    if (draft.record.seq !== slot.seq) {
      throw new RecordChainError(
        `record body has seq ${String(draft.record.seq)}, the chain expects ${slot.seq}`,
      )
    }
    if (options.legacyBodyWithoutPrevHash) {
      if (draft.schemaVersion !== 0 || 'prevHash' in draft.record) {
        throw new RecordChainError('the legacy import is only for schema version 0 bodies with no prevHash')
      }
    } else if (draft.record.prevHash !== slot.prevHash) {
      throw new RecordChainError(
        `record body has prevHash ${String(draft.record.prevHash)}, the chain expects ${slot.prevHash}`,
      )
    }

    // Every version from 1 on has a strict shape. A body that does not match its own version is refused here,
    // before it is hashed. Version 0 is the unfrozen skeleton shape and the legacy import.
    if (draft.schemaVersion >= 1) {
      if (draft.record.schemaVersion !== draft.schemaVersion) {
        throw new RecordChainError('the record body and its row name different schema versions')
      }
      if (draft.record.kind !== (draft.kind ?? 'decision')) {
        throw new RecordChainError('the record body and its row name different kinds')
      }
      const problems = checkRecord(draft.record)
      if (problems.length > 0) {
        throw new RecordChainError(`record body does not match its version's shape: ${problems.join('; ')}`)
      }
    }

    const recordHash = hashRecord(draft.record) // throws on a float, a bigint or an undefined
    const [decision] = await tx
      .insert(decisions)
      .values({
        deskId,
        wakeId: draft.wakeId ?? null,
        seq: slot.seq,
        kind: draft.kind ?? 'decision',
        schemaVersion: draft.schemaVersion,
        outcome: draft.outcome,
        mode: draft.mode,
        shadow: draft.mode === 'shadow',
        token: draft.token?.toLowerCase() ?? null,
        side: draft.side ?? null,
        amountUsdg: draft.amountUsdg ?? null,
        confidencePercent: draft.confidencePercent ?? null,
        summary: draft.summary,
        failureCode: draft.failureCode ?? null,
        record: draft.record,
        recordHash,
        prevHash: slot.prevHash,
        private: draft.private ?? null,
        copiedFromDecisionId: draft.copiedFromDecisionId ?? null,
        decidedAt: draft.decidedAt,
      })
      .returning()
    if (!decision) throw new RecordChainError('the record was not inserted')

    if (!verifyRecord(decision.record, recordHash)) {
      throw new RecordChainError(
        `record ${slot.seq} changed on its way through the database: it no longer hashes to ${recordHash}`,
      )
    }

    const planned = draft.actions ?? []
    const actionRows =
      planned.length === 0
        ? []
        : await tx
            .insert(actions)
            .values(
              planned.map((a, leg) => ({
                decisionId: decision.id,
                deskId,
                leg,
                kind: a.kind,
                operator: a.operator.toLowerCase(),
                token: a.token?.toLowerCase() ?? null,
                amountIn: a.amountIn ?? null,
                expectedOut: a.expectedOut ?? null,
                minOut: a.minOut ?? null,
              })),
            )
            .returning()
    actionRows.sort((a, b) => a.leg - b.leg)
    await draft.alongside?.(tx, decision)
    return { decision, actions: actionRows, recordHash }
  })
}

/** Merges unhashed outcome details into `result`. The hashed `record` is never touched after insert. */
export async function appendResult(
  db: DbOrTx,
  decisionId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .update(decisions)
    .set({ result: sql`coalesce(${decisions.result}, '{}'::jsonb) || ${JSON.stringify(result)}::jsonb` })
    .where(eq(decisions.id, decisionId))
}

export async function recordChain(db: DbOrTx, deskId: string): Promise<DecisionRow[]> {
  return db.select().from(decisions).where(eq(decisions.deskId, deskId)).orderBy(asc(decisions.seq))
}

export interface ChainProblem {
  seq: number
  problem: string
}

/**
 * Checks a desk's whole record from the rows alone: no gaps, every link intact, every body still hashing to
 * its fingerprint, every body agreeing with its row. Pure, so the web's "Check it" can reuse the same rules.
 */
export function verifyChain(rows: DecisionRow[]): ChainProblem[] {
  const problems: ChainProblem[] = []
  let expectedPrev: string = ZERO_HASH
  rows.forEach((row, i) => {
    const bad = (problem: string) => problems.push({ seq: row.seq, problem })
    if (row.seq !== i + 1) bad(`expected seq ${i + 1}: the record has a gap or a duplicate`)
    if (row.prevHash !== expectedPrev) bad('prev_hash does not match the previous record')
    if (!verifyRecord(row.record, row.recordHash as Hex)) bad('the body no longer hashes to record_hash')
    if (row.record.seq !== row.seq) bad('the body names a different seq than its row')
    if ('prevHash' in row.record) {
      if (row.record.prevHash !== row.prevHash) bad('the body names a different prevHash than its row')
    } else if (row.schemaVersion !== 0) {
      bad('the body has no prevHash, which only a legacy version 0 record may omit')
    }
    expectedPrev = row.recordHash
  })
  return problems
}
