/**
 * What the chat asks the worker to do. The web writes these rows and never sends anything itself.
 */
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import {
  approvals,
  askProposals,
  askRequests,
  checkRequests,
  decisions,
  deferrals,
  desks,
  grades,
  servCalls,
} from '../schema'

export type AskRequestRow = typeof askRequests.$inferSelect
export type AskProposalRow = typeof askProposals.$inferSelect
export type AskProposalInsert = typeof askProposals.$inferInsert

/** The channel the worker LISTENs on. The payload is the request id. */
export const ASK_CHANNEL = 'ask_requests'
/** The SERV purposes the chat's own calls are logged under, so its budget never counts the engine's calls. */
export const CHAT_PURPOSES = ['ask', 'readback'] as const

/** One message to the desk. Wakes the worker at once; the worker also sweeps, so a lost NOTIFY only costs a second. */
export async function createAskRequest(
  db: Db,
  input: {
    ownerAddress: string
    deskId: string | null
    kind: 'ask' | 'readback'
    via: 'web' | 'telegram' | 'chat'
    question: string
    payload?: Record<string, unknown>
  },
): Promise<string> {
  const [row] = await db
    .insert(askRequests)
    .values({
      ownerAddress: input.ownerAddress.toLowerCase(),
      deskId: input.deskId,
      kind: input.kind,
      via: input.via,
      question: input.question,
      payload: input.payload ?? {},
    })
    .returning({ id: askRequests.id })
  if (!row) throw new Error('the message was not saved')
  await db.execute(sql`select pg_notify(${ASK_CHANNEL}, ${row.id})`)
  return row.id
}

/** How often one owner may write to their desk. Counted in Postgres, so every web instance and Telegram agree. */
export const ASK_LIMITS = { perMinute: 6, perDay: 150 } as const

export async function askAllowed(
  db: DbOrTx,
  ownerAddress: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; reason: 'minute' | 'day' }> {
  const [minute, day] = await Promise.all([
    askRequestsSince(db, ownerAddress, new Date(now.getTime() - 60_000)),
    askRequestsSince(db, ownerAddress, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  ])
  if (minute >= ASK_LIMITS.perMinute) return { ok: false, reason: 'minute' }
  if (day >= ASK_LIMITS.perDay) return { ok: false, reason: 'day' }
  return { ok: true }
}

/** How many messages this owner has sent since a moment. The rate limits count these. */
export async function askRequestsSince(db: DbOrTx, ownerAddress: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(askRequests)
    .where(and(eq(askRequests.ownerAddress, ownerAddress.toLowerCase()), gt(askRequests.createdAt, since)))
  return row?.n ?? 0
}

/**
 * Takes up to `limit` waiting messages, oldest first. SKIP LOCKED lets two claimers run at once without ever
 * taking the same row, so a NOTIFY and the sweep racing each other answer each message exactly once.
 */
export async function claimAskRequests(db: DbOrTx, limit: number): Promise<AskRequestRow[]> {
  const result = await db.execute<{ id: string }>(sql`
    update ${askRequests} set status = 'claimed', claimed_at = now()
    where id in (
      select id from ${askRequests} where status = 'pending'
      order by created_at limit ${limit} for update skip locked
    )
    returning id
  `)
  const ids = result.rows.map((r) => r.id)
  if (ids.length === 0) return []
  return db.select().from(askRequests).where(inArray(askRequests.id, ids)).orderBy(asc(askRequests.createdAt))
}

export async function finishAskRequest(
  db: DbOrTx,
  id: string,
  outcome: { reply: Record<string, unknown> } | { error: string },
): Promise<void> {
  await db
    .update(askRequests)
    .set(
      'reply' in outcome
        ? { status: 'answered', reply: outcome.reply, answeredAt: new Date() }
        : { status: 'failed', error: outcome.error, answeredAt: new Date() },
    )
    .where(and(eq(askRequests.id, id), eq(askRequests.status, 'claimed')))
}

/**
 * A worker that stopped mid-answer leaves its rows claimed for ever. On boot, anything claimed this long ago is
 * failed honestly, so the browser stops waiting and says so.
 */
export async function sweepStuckAskRequests(db: DbOrTx, olderThan: Date): Promise<number> {
  const rows = await db
    .update(askRequests)
    .set({ status: 'failed', error: 'The desk stopped before it answered.', answeredAt: new Date() })
    .where(and(eq(askRequests.status, 'claimed'), lt(askRequests.claimedAt, olderThan)))
    .returning({ id: askRequests.id })
  return rows.length
}

/** One message as its sender sees it, with the card it produced. Scoped to the owner: nobody reads another's. */
export async function askRequestForOwner(db: DbOrTx, id: string, ownerAddress: string) {
  const [request] = await db
    .select({
      id: askRequests.id,
      deskId: askRequests.deskId,
      status: askRequests.status,
      question: askRequests.question,
      reply: askRequests.reply,
      error: askRequests.error,
      createdAt: askRequests.createdAt,
      answeredAt: askRequests.answeredAt,
    })
    .from(askRequests)
    .where(and(eq(askRequests.id, id), eq(askRequests.ownerAddress, ownerAddress.toLowerCase())))
  if (!request) return undefined
  const [proposal] = await db
    .select({
      id: askProposals.id,
      kind: askProposals.kind,
      path: askProposals.path,
      status: askProposals.status,
      deskView: askProposals.deskView,
      expiresAt: askProposals.expiresAt,
      txHash: askProposals.txHash,
      result: askProposals.result,
    })
    .from(askProposals)
    .where(eq(askProposals.requestId, id))
  return { ...request, proposal }
}

/** The last few exchanges on this desk, oldest first, so the desk can follow a conversation. */
export async function recentConversation(db: DbOrTx, deskId: string, ownerAddress: string, limit = 4) {
  const rows = await db
    .select({ question: askRequests.question, reply: askRequests.reply, at: askRequests.createdAt })
    .from(askRequests)
    .where(
      and(
        eq(askRequests.deskId, deskId),
        eq(askRequests.ownerAddress, ownerAddress.toLowerCase()),
        eq(askRequests.status, 'answered'),
        eq(askRequests.kind, 'ask'),
      ),
    )
    .orderBy(desc(askRequests.createdAt))
    .limit(limit)
  return rows.reverse()
}

/** SERV calls the chat has made since a moment. The daily budget counts these, never the engine's. */
export async function chatCallsSince(db: DbOrTx, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(servCalls)
    .where(and(inArray(servCalls.purpose, [...CHAT_PURPOSES]), gt(servCalls.at, since)))
  return row?.n ?? 0
}

export async function saveProposal(db: DbOrTx, row: AskProposalInsert): Promise<string> {
  const [saved] = await db
    .insert(askProposals)
    .values({ ...row, ownerAddress: row.ownerAddress.toLowerCase() })
    .returning({ id: askProposals.id })
  if (!saved) throw new Error('the proposal was not saved')
  return saved.id
}

/**
 * The owner's yes. A guarded update: the proposal must be theirs, still open, not expired, and for this path.
 * No row back means it was already used, has expired, or was never theirs, which is the honest answer to a
 * double tap. Only the saved `args` are ever carried out.
 */
export async function takeProposal(
  db: DbOrTx,
  input: { id: string; ownerAddress: string; path: AskProposalRow['path']; now?: Date },
): Promise<AskProposalRow | undefined> {
  const now = input.now ?? new Date()
  const [row] = await db
    .update(askProposals)
    .set({ status: 'confirmed', confirmedAt: now })
    .where(
      and(
        eq(askProposals.id, input.id),
        eq(askProposals.ownerAddress, input.ownerAddress.toLowerCase()),
        eq(askProposals.path, input.path),
        eq(askProposals.status, 'open'),
        gt(askProposals.expiresAt, now),
      ),
    )
    .returning()
  return row
}

export async function finishProposal(
  db: DbOrTx,
  id: string,
  outcome: {
    status: 'done' | 'refused' | 'failed'
    result: Record<string, unknown>
    txHash?: string
  },
): Promise<void> {
  await db
    .update(askProposals)
    .set({
      status: outcome.status,
      result: outcome.result,
      doneAt: new Date(),
      ...(outcome.txHash ? { txHash: outcome.txHash.toLowerCase() } : {}),
    })
    .where(and(eq(askProposals.id, id), eq(askProposals.status, 'confirmed')))
}

/** Open proposals past their time are marked expired, so a card can never be confirmed late. */
export async function expireProposals(db: DbOrTx, now = new Date()): Promise<number> {
  const rows = await db
    .update(askProposals)
    .set({ status: 'expired' })
    .where(and(eq(askProposals.status, 'open'), lt(askProposals.expiresAt, now)))
    .returning({ id: askProposals.id })
  return rows.length
}

/** Every wait the desk is still keeping, with the record that started it. */
export async function standingWaits(db: DbOrTx, deskId: string) {
  return db
    .select({
      deferralId: deferrals.id,
      decisionId: deferrals.decisionId,
      token: deferrals.token,
      side: deferrals.side,
      revisitAt: deferrals.revisitAt,
      decisionSeq: decisions.seq,
      summary: decisions.summary,
      record: decisions.record,
      decidedAt: decisions.decidedAt,
    })
    .from(deferrals)
    .innerJoin(decisions, eq(deferrals.decisionId, decisions.id))
    .where(and(eq(deferrals.deskId, deskId), eq(deferrals.status, 'standing')))
    .orderBy(asc(deferrals.createdAt))
}

/** The newest grades, with the decision each one marks. */
export async function recentGrades(db: DbOrTx, deskId: string, limit = 8) {
  return db
    .select({
      decisionSeq: decisions.seq,
      verdict: grades.verdict,
      differenceBps: grades.differenceBps,
      chosen: grades.chosen,
      alternative: grades.alternative,
    })
    .from(grades)
    .innerJoin(decisions, eq(grades.decisionId, decisions.id))
    .where(and(eq(grades.deskId, deskId), eq(grades.replay, false)))
    .orderBy(desc(decisions.seq))
    .limit(limit)
}

/** A second "check now" inside this window is refused, so a desk cannot be checked into a hurry. */
export const CHECK_COOLDOWN_MS = 10 * 60 * 1000

export type CheckRequestResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'pending' | 'cooldown' | 'not_running' }

/**
 * Ask for one check at once. Refused while one is already waiting, and within ten minutes of the last one,
 * unless it exists to carry out a "do it anyway" the owner already confirmed.
 */
export async function requestCheck(
  db: Db,
  input: { deskId: string; requestedBy: string; via: 'web' | 'telegram' | 'chat'; proposalId?: string },
  now = new Date(),
): Promise<CheckRequestResult> {
  return db.transaction(async (tx) => {
    const [desk] = await tx
      .select({ lifecycle: desks.lifecycle })
      .from(desks)
      .where(eq(desks.id, input.deskId))
    if (desk?.lifecycle !== 'running') return { ok: false, reason: 'not_running' }
    const [waiting] = await tx
      .select({ id: checkRequests.id })
      .from(checkRequests)
      .where(and(eq(checkRequests.deskId, input.deskId), eq(checkRequests.status, 'pending')))
    if (waiting) return { ok: false, reason: 'pending' }
    if (!input.proposalId) {
      const [recent] = await tx
        .select({ id: checkRequests.id })
        .from(checkRequests)
        .where(
          and(
            eq(checkRequests.deskId, input.deskId),
            isNull(checkRequests.proposalId),
            gt(checkRequests.createdAt, new Date(now.getTime() - CHECK_COOLDOWN_MS)),
          ),
        )
        .orderBy(desc(checkRequests.createdAt))
        .limit(1)
      if (recent) return { ok: false, reason: 'cooldown' }
    }
    const [row] = await tx
      .insert(checkRequests)
      .values({
        deskId: input.deskId,
        requestedBy: input.requestedBy.toLowerCase(),
        via: input.via,
        ...(input.proposalId ? { proposalId: input.proposalId } : {}),
        createdAt: now,
      })
      .returning({ id: checkRequests.id })
    if (!row) throw new Error('the check request was not saved')
    return { ok: true, id: row.id }
  })
}

export async function pendingCheckRequests(db: DbOrTx) {
  return db
    .select()
    .from(checkRequests)
    .where(eq(checkRequests.status, 'pending'))
    .orderBy(asc(checkRequests.createdAt))
}

export async function finishCheckRequest(
  db: DbOrTx,
  id: string,
  outcome: { status: 'done' | 'refused'; refusedReason?: string },
): Promise<void> {
  await db
    .update(checkRequests)
    .set({ status: outcome.status, refusedReason: outcome.refusedReason ?? null, doneAt: new Date() })
    .where(and(eq(checkRequests.id, id), eq(checkRequests.status, 'pending')))
}

export type OverrideResult =
  | { ok: true; approvalId: string }
  | { ok: false; reason: 'practice' | 'not_active' | 'wait_ended' }

/**
 * "Do it anyway", in one transaction. The wait must still stand and the desk must be live and active. Then the
 * wait ends as broken, by the owner, and an approval is written already answered, with the quote the owner saw.
 * The worker carries it out on its next pass exactly like any approval: fresh quote, every rule, no model call.
 */
export async function overrideWait(
  db: Db,
  input: {
    deskId: string
    deferralId: string
    decisionId: string
    ownerId: string
    quote: { amountIn: string; expectedOut: string }
    now?: Date
  },
): Promise<OverrideResult> {
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    const [desk] = await tx
      .select({ mode: desks.mode, state: desks.state })
      .from(desks)
      .where(eq(desks.id, input.deskId))
      .for('update')
    if (!desk || desk.mode === 'shadow') return { ok: false, reason: 'practice' }
    if (desk.state !== 'active') return { ok: false, reason: 'not_active' }
    const [ended] = await tx
      .update(deferrals)
      .set({ status: 'broken', endedReason: 'You said do it anyway.', endedAt: now })
      .where(
        and(
          eq(deferrals.id, input.deferralId),
          eq(deferrals.deskId, input.deskId),
          eq(deferrals.decisionId, input.decisionId),
          eq(deferrals.status, 'standing'),
        ),
      )
      .returning({ id: deferrals.id })
    if (!ended) return { ok: false, reason: 'wait_ended' }
    const [approval] = await tx
      .insert(approvals)
      .values({
        deskId: input.deskId,
        decisionId: input.decisionId,
        status: 'approved',
        reason: 'owner_override',
        preview: input.quote,
        // Carried out within seconds by the check this queues. The fresh quote must still land within half a
        // percent of this one, so an old approval can never trade at a price the owner did not see.
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        answeredBy: input.ownerId,
        answeredAt: now,
        answeredVia: 'chat',
      })
      .returning({ id: approvals.id })
    if (!approval) throw new Error('the approval was not saved')
    return { ok: true, approvalId: approval.id }
  })
}

/** The owner's conversation with one desk, oldest first, each message with the card it produced. */
export async function askHistory(db: DbOrTx, deskId: string, ownerAddress: string, limit = 30) {
  const rows = await db
    .select({
      id: askRequests.id,
      status: askRequests.status,
      question: askRequests.question,
      reply: askRequests.reply,
      error: askRequests.error,
      createdAt: askRequests.createdAt,
      proposalId: askProposals.id,
      proposalKind: askProposals.kind,
      proposalPath: askProposals.path,
      proposalStatus: askProposals.status,
      proposalView: askProposals.deskView,
      proposalExpiresAt: askProposals.expiresAt,
      proposalResult: askProposals.result,
      proposalTxHash: askProposals.txHash,
    })
    .from(askRequests)
    .leftJoin(askProposals, eq(askProposals.requestId, askRequests.id))
    .where(
      and(
        eq(askRequests.deskId, deskId),
        eq(askRequests.ownerAddress, ownerAddress.toLowerCase()),
        eq(askRequests.kind, 'ask'),
      ),
    )
    .orderBy(desc(askRequests.createdAt), desc(askProposals.createdAt))
    .limit(limit)
  // One turn per message, with its newest card, even if a message was ever answered twice.
  const seen = new Set<string>()
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id)).reverse()
}

/** One proposal, only for the owner it was made for. */
export async function proposalForOwner(db: DbOrTx, id: string, ownerAddress: string) {
  const [row] = await db
    .select()
    .from(askProposals)
    .where(and(eq(askProposals.id, id), eq(askProposals.ownerAddress, ownerAddress.toLowerCase())))
  return row
}

/**
 * A studio test read, for the one who asked it: the draft it read and what the desk said. The studio stores the
 * reply as the mandate's `read_back` only if this draft is exactly the one being created.
 */
export async function readBackForOwner(db: DbOrTx, id: string, ownerAddress: string) {
  const [row] = await db
    .select({
      id: askRequests.id,
      payload: askRequests.payload,
      reply: askRequests.reply,
      answeredAt: askRequests.answeredAt,
    })
    .from(askRequests)
    .where(
      and(
        eq(askRequests.id, id),
        eq(askRequests.ownerAddress, ownerAddress.toLowerCase()),
        eq(askRequests.kind, 'readback'),
        eq(askRequests.status, 'answered'),
      ),
    )
  return row
}
