/**
 * What a stranger may see: a desk the owner chose to share, and its record.
 *
 * Every query here names its columns. `decisions.private` is the owner's alone, because it holds headline TEXT
 * that our news licence forbids us to pass on, and it must never appear in a public projection by accident.
 * The hashed `record` body is public by design: it is the thing whose fingerprint is written on-chain, and a
 * record nobody can read proves nothing.
 */
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { DbOrTx } from '../client'
import {
  actions,
  approvals,
  decisions,
  deferrals,
  deskEvents,
  desks,
  deskValueSnapshots,
  grades,
  mandates,
  multiplierEvents,
  owners,
  wakes,
} from '../schema'

/** The public face of a desk. No owner address, no Telegram, no invite code. */
export const publicDeskColumns = {
  id: desks.id,
  name: desks.name,
  address: desks.address,
  chainId: desks.chainId,
  contractVersion: desks.contractVersion,
  mode: desks.mode,
  state: desks.state,
  stateReason: desks.stateReason,
  lifecycle: desks.lifecycle,
  shareSlug: desks.shareSlug,
  startedAt: desks.startedAt,
  shadowChecks: desks.shadowChecks,
  shadowReportOpenedAt: desks.shadowReportOpenedAt,
  chainSeq: desks.chainSeq,
} as const

export const publicDecisionColumns = {
  id: decisions.id,
  seq: decisions.seq,
  kind: decisions.kind,
  schemaVersion: decisions.schemaVersion,
  outcome: decisions.outcome,
  mode: decisions.mode,
  shadow: decisions.shadow,
  token: decisions.token,
  side: decisions.side,
  amountUsdg: decisions.amountUsdg,
  confidencePercent: decisions.confidencePercent,
  summary: decisions.summary,
  failureCode: decisions.failureCode,
  record: decisions.record,
  recordHash: decisions.recordHash,
  prevHash: decisions.prevHash,
  result: decisions.result,
  sealedByTx: decisions.sealedByTx,
  sealedAt: decisions.sealedAt,
  decidedAt: decisions.decidedAt,
} as const

/** undefined when there is no such desk, or its owner has not shared it. */
export async function deskByShareSlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select(publicDeskColumns)
    .from(desks)
    .where(and(eq(desks.shareSlug, slug), eq(desks.shareEnabled, true)))
  return row
}

/** Every shared desk, for the home page. */
export async function sharedDesks(db: DbOrTx) {
  return db.select(publicDeskColumns).from(desks).where(eq(desks.shareEnabled, true)).orderBy(desks.createdAt)
}

/** The record's filters [8.10]: outcome, token, dates, practice or live. Each one is optional. */
export interface RecordFilter {
  outcome?: (typeof decisions.$inferSelect)['outcome'] | undefined
  /** A token's contract address, lower case. */
  token?: string | undefined
  shadow?: boolean | undefined
  from?: Date | undefined
  to?: Date | undefined
}

/** A page of the record, newest first. `before` is a seq, so paging cannot skip or repeat an entry. */
export async function deskRecord(
  db: DbOrTx,
  deskId: string,
  options: { limit?: number | undefined; before?: number | undefined } & RecordFilter = {},
) {
  const limit = Math.min(options.limit ?? 50, 200)
  const where = [eq(decisions.deskId, deskId)]
  if (options.before !== undefined) where.push(lt(decisions.seq, options.before))
  if (options.outcome !== undefined) where.push(eq(decisions.outcome, options.outcome))
  if (options.token !== undefined) where.push(eq(decisions.token, options.token.toLowerCase()))
  if (options.shadow !== undefined) where.push(eq(decisions.shadow, options.shadow))
  if (options.from !== undefined) where.push(gte(decisions.decidedAt, options.from))
  if (options.to !== undefined) where.push(lt(decisions.decidedAt, options.to))
  return db
    .select(publicDecisionColumns)
    .from(decisions)
    .where(and(...where))
    .orderBy(desc(decisions.seq))
    .limit(limit)
}

/** What a stranger sees of a desk, and of one decision. Derived from the queries, so they can never drift. */
export type PublicDesk = NonNullable<Awaited<ReturnType<typeof deskByShareSlug>>>
export type PublicDecision = Awaited<ReturnType<typeof deskRecord>>[number]

export async function decisionInFull(db: DbOrTx, deskId: string, seq: number) {
  const [decision] = await db
    .select(publicDecisionColumns)
    .from(decisions)
    .where(and(eq(decisions.deskId, deskId), eq(decisions.seq, seq)))
  if (!decision) return undefined
  // The request this decision made, if it asked [8.11 item 8]: how it was answered, and by which door.
  const executed = alias(decisions, 'executed')
  const [legs, [grade], [approval]] = await Promise.all([
    db
      .select({
        leg: actions.leg,
        kind: actions.kind,
        status: actions.status,
        txHash: actions.txHash,
        amountIn: actions.amountIn,
        expectedOut: actions.expectedOut,
        minOut: actions.minOut,
        actualOut: actions.actualOut,
        gasUsed: actions.gasUsed,
        effectiveGasPrice: actions.effectiveGasPrice,
        blockNumber: actions.blockNumber,
        failureCode: actions.failureCode,
        failureDetail: actions.failureDetail,
      })
      .from(actions)
      .where(eq(actions.decisionId, decision.id))
      .orderBy(actions.leg),
    db
      .select({
        verdict: grades.verdict,
        differenceBps: grades.differenceBps,
        chosen: grades.chosen,
        alternative: grades.alternative,
        gradedAt: grades.gradedAt,
        replay: grades.replay,
      })
      .from(grades)
      .where(eq(grades.decisionId, decision.id)),
    db
      .select({
        status: approvals.status,
        reason: approvals.reason,
        expiresAt: approvals.expiresAt,
        answeredAt: approvals.answeredAt,
        answeredVia: approvals.answeredVia,
        cancelledReason: approvals.cancelledReason,
        executionSeq: executed.seq,
      })
      .from(approvals)
      .leftJoin(executed, eq(executed.id, approvals.executionDecisionId))
      .where(eq(approvals.decisionId, decision.id))
      .limit(1),
  ])
  return { decision, actions: legs, grade, approval }
}

/**
 * The record a sealing transaction carried: the one whose own on-chain action that transaction was. Its
 * fingerprint is the `decisionHash` in the event, and it commits to every record before it.
 */
export async function sealingRecordFor(db: DbOrTx, deskId: string, txHash: string) {
  const [row] = await db
    .select({ seq: decisions.seq, recordHash: decisions.recordHash })
    .from(actions)
    .innerJoin(decisions, eq(decisions.id, actions.decisionId))
    .where(
      and(
        eq(actions.deskId, deskId),
        eq(actions.txHash, txHash.toLowerCase()),
        eq(actions.status, 'confirmed'),
      ),
    )
    .limit(1)
  return row
}

/** The bodies after one record up to and including another, oldest first: the links "Check it" walks. */
export async function recordsBetween(db: DbOrTx, deskId: string, afterSeq: number, toSeq: number) {
  return db
    .select({ seq: decisions.seq, record: decisions.record, recordHash: decisions.recordHash })
    .from(decisions)
    .where(and(eq(decisions.deskId, deskId), gt(decisions.seq, afterSeq), lte(decisions.seq, toSeq)))
    .orderBy(asc(decisions.seq))
}

/** One decision with every on-chain leg it sent and its grade, if the market has reopened since. */
export type DecisionInFull = NonNullable<Awaited<ReturnType<typeof decisionInFull>>>

/** The desk's value as it stood at or just before a moment, for "since the market reopened" [8.9]. */
export async function valueSnapshotAtOrBefore(db: DbOrTx, deskId: string, at: Date) {
  const [row] = await db
    .select({ takenAt: deskValueSnapshots.takenAt, totalUsdg: deskValueSnapshots.totalUsdg })
    .from(deskValueSnapshots)
    .where(and(eq(deskValueSnapshots.deskId, deskId), lte(deskValueSnapshots.takenAt, at)))
    .orderBy(desc(deskValueSnapshots.takenAt))
    .limit(1)
  return row
}

/** The desk's value over time, oldest first, for the chart. */
/**
 * The desk this one replaced, when an owner moved a desk to a newer contract (`scripts/move-desk.sql` records
 * the move on the old desk's `closed` event). Its value history and record are the new desk's past, read-only.
 */
export async function predecessorOf(db: DbOrTx, address: string) {
  const [row] = await db
    .select({ id: desks.id, address: desks.address, contractVersion: desks.contractVersion })
    .from(deskEvents)
    .innerJoin(desks, eq(desks.id, deskEvents.deskId))
    .where(
      and(eq(deskEvents.kind, 'closed'), sql`${deskEvents.detail}->>'movedTo' = ${address.toLowerCase()}`),
    )
    .limit(1)
  return row
}

export async function valueHistory(db: DbOrTx, deskId: string, limit = 400) {
  const rows = await db
    .select({
      takenAt: deskValueSnapshots.takenAt,
      totalUsdg: deskValueSnapshots.totalUsdg,
      cashUsdg: deskValueSnapshots.cashUsdg,
    })
    .from(deskValueSnapshots)
    .where(eq(deskValueSnapshots.deskId, deskId))
    .orderBy(desc(deskValueSnapshots.takenAt))
    .limit(limit)
  return rows.reverse()
}

/**
 * The record's design problem, solved once here: an hourly desk makes about 160 entries a week and most say
 * nothing happened. They must be present, because they are the proof the desk was awake and honest, but they
 * must not bury the few that matter. So a run of consecutive quiet checks becomes one row that can be opened.
 *
 * Quiet means: nothing to do, or a check that only continued a decision already made. Anything the desk did,
 * asked, declined or failed at is never folded away.
 */
export type RecordRow =
  | { kind: 'entry'; decision: PublicDecision }
  | { kind: 'quiet'; count: number; from: Date; to: Date; decisions: PublicDecision[] }

export function isQuiet(d: PublicDecision): boolean {
  if (d.outcome === 'nothing_to_do') return true
  const deferral = (d.record as { deferral?: { stillStanding?: boolean } }).deferral
  return d.outcome === 'waited' && deferral?.stillStanding === true
}

export function groupQuietRuns(newestFirst: PublicDecision[], minRun = 3): RecordRow[] {
  const rows: RecordRow[] = []
  let run: PublicDecision[] = []
  const flush = () => {
    if (run.length === 0) return
    if (run.length < minRun) {
      for (const d of run) rows.push({ kind: 'entry', decision: d })
    } else {
      const first = run[0]
      const last = run.at(-1)
      if (first && last) {
        rows.push({
          kind: 'quiet',
          count: run.length,
          from: last.decidedAt,
          to: first.decidedAt,
          decisions: run,
        })
      }
    }
    run = []
  }
  for (const d of newestFirst) {
    if (isQuiet(d)) run.push(d)
    else {
      flush()
      rows.push({ kind: 'entry', decision: d })
    }
  }
  flush()
  return rows
}

/** Every desk belonging to one signed-in address. The only query keyed on a person. */
/**
 * The owner's desks. A studio draft whose contract does not exist yet is left out: it is not a desk until the
 * chain says so, and the studio shows it on its own as "finish creating it".
 */
export async function desksOfOwner(db: DbOrTx, ownerAddress: string) {
  return db
    .select(publicDeskColumns)
    .from(desks)
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(
      and(
        eq(owners.address, ownerAddress.toLowerCase()),
        sql`not (${desks.lifecycle} = 'onboarding' and ${desks.deployedAt} is null)`,
      ),
    )
    .orderBy(desks.createdAt)
}

/**
 * What each shared desk holds, for "Start from a strategy": the mix only, never its trades, its notes or its
 * limits. Only desks whose owner turned sharing on.
 */
export async function sharedMixes(db: DbOrTx) {
  return db
    .select({
      name: desks.name,
      shareSlug: desks.shareSlug,
      mode: desks.mode,
      preset: mandates.preset,
      targets: mandates.targets,
    })
    .from(desks)
    .innerJoin(mandates, and(eq(mandates.deskId, desks.id), eq(mandates.status, 'applied')))
    .where(and(eq(desks.shareEnabled, true), sql`${desks.lifecycle} <> 'closed'`))
    .orderBy(desks.createdAt)
}

/** True when this address owns this desk. Every owner action checks it first, server side. */
export async function ownsDesk(db: DbOrTx, deskId: string, ownerAddress: string): Promise<boolean> {
  const [row] = await db
    .select({ id: desks.id })
    .from(desks)
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(and(eq(desks.id, deskId), eq(owners.address, ownerAddress.toLowerCase())))
  return Boolean(row)
}

/** The owner's row id for an address, or undefined if they have never signed in. */
export async function ownerIdOf(db: DbOrTx, address: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.address, address.toLowerCase()))
  return row?.id
}

/** One decision with its grade, for the report. Ungraded ones are included: silence would flatter the desk. */
export async function recordWithGrades(db: DbOrTx, deskId: string, from: Date, to: Date) {
  return db
    .select({
      seq: decisions.seq,
      outcome: decisions.outcome,
      summary: decisions.summary,
      token: decisions.token,
      side: decisions.side,
      shadow: decisions.shadow,
      decidedAt: decisions.decidedAt,
      record: decisions.record,
      verdict: grades.verdict,
      differenceBps: grades.differenceBps,
      chosen: grades.chosen,
      alternative: grades.alternative,
    })
    .from(decisions)
    .leftJoin(grades, eq(grades.decisionId, decisions.id))
    .where(and(eq(decisions.deskId, deskId), gte(decisions.decidedAt, from), lt(decisions.decidedAt, to)))
    .orderBy(asc(decisions.seq))
}

/**
 * "Timing": what the desk's timing calls earned or cost, in USDG, against the one alternative each really had,
 * graded at the reopen. Positive means its choices beat the alternatives. It can be negative, and says so.
 *
 * Counted: the desk's own trades, and only the decision that STARTED each wait (a wait's later hourly "still
 * waiting" rows are graded too, and counting them would multiply one call). Left out: replays of past weekends,
 * refusals forced by a hard rule, and the owner's own "do it anyway", which is graded as the owner's call.
 * Practice decisions are summed apart, because no money moved.
 */
export async function timingSummary(
  db: DbOrTx,
  deskId: string,
): Promise<{ live: { usdg: bigint; decisions: number }; practice: { usdg: bigint; decisions: number } }> {
  const result = await db.execute<{ shadow: boolean; usdg: string | null; decisions: string }>(sql`
    select d.shadow,
           sum(d.amount_usdg * g.difference_bps / 10000)::numeric(78, 0) as usdg,
           count(*) as decisions
    from ${grades} g
    join ${decisions} d on d.id = g.decision_id
    where g.desk_id = ${deskId}
      and g.replay = false
      and g.difference_bps is not null
      and d.amount_usdg is not null
      and (
        d.outcome in ('acted', 'acted_in_part', 'would_have_acted')
        or (d.outcome = 'waited' and exists (select 1 from ${deferrals} f where f.decision_id = d.id))
      )
    group by d.shadow
  `)
  const pick = (shadow: boolean) => {
    const row = result.rows.find((r) => r.shadow === shadow)
    return { usdg: BigInt(row?.usdg ?? '0'), decisions: Number(row?.decisions ?? '0') }
  }
  return { live: pick(false), practice: pick(true) }
}

/** The desk a slug names, shared or not. Only the caller's own ownership check decides who may see it. */
export async function deskIdBySlug(db: DbOrTx, slug: string): Promise<string | undefined> {
  const [row] = await db.select({ id: desks.id }).from(desks).where(eq(desks.shareSlug, slug))
  return row?.id
}

/** The desk's most recent check of any kind, for "has not checked in" [8.16]. */
export async function lastCheckOf(db: DbOrTx, deskId: string) {
  const [row] = await db
    .select({ at: wakes.startedAt, status: wakes.status })
    .from(wakes)
    .where(eq(wakes.deskId, deskId))
    .orderBy(desc(wakes.startedAt))
    .limit(1)
  return row
}

/**
 * What changed a desk without a decision of its own, for the record [8.16]: money or tokens that moved outside
 * the desk, the owner's own on-chain calls, and multiplier changes on the tokens its mandate names. Newest first.
 */
export async function deskNotes(db: DbOrTx, deskId: string, since: Date, tokens: string[], limit = 30) {
  const [events, multipliers] = await Promise.all([
    db
      .select({ at: deskEvents.at, kind: deskEvents.kind, detail: deskEvents.detail })
      .from(deskEvents)
      .where(
        and(
          eq(deskEvents.deskId, deskId),
          inArray(deskEvents.kind, ['holdings_changed_outside', 'owner_action']),
        ),
      )
      .orderBy(desc(deskEvents.at))
      .limit(limit),
    tokens.length === 0
      ? Promise.resolve([])
      : db
          .select({
            at: multiplierEvents.at,
            token: multiplierEvents.token,
            oldRaw: multiplierEvents.oldMultiplierRaw,
            newRaw: multiplierEvents.newMultiplierRaw,
          })
          .from(multiplierEvents)
          .where(
            and(
              gte(multiplierEvents.at, since),
              inArray(
                multiplierEvents.token,
                tokens.map((t) => t.toLowerCase()),
              ),
            ),
          )
          .orderBy(desc(multiplierEvents.at))
          .limit(limit),
  ])
  return [
    ...events.map((e) => ({
      at: e.at,
      kind: e.kind as 'holdings_changed_outside' | 'owner_action',
      detail: e.detail,
    })),
    ...multipliers.map((m) => ({
      at: m.at,
      kind: 'multiplier' as const,
      detail: { token: m.token, oldRaw: m.oldRaw.toString(), newRaw: m.newRaw.toString() },
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
}
