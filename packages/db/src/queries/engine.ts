/**
 * Small writes and reads the engine makes around a decision. The writers take a transaction handle, because
 * they run `alongside` a record and must commit with it or not at all.
 */
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import {
  actions,
  approvals,
  decisions,
  deferrals,
  deskEvents,
  desks,
  deskValueSnapshots,
  grades,
  notifications,
  owners,
  telegramLinks,
  wakes,
} from '../schema'
import type { SnapshotHolding } from '../schema/money'

export type DeferralRow = typeof deferrals.$inferSelect
export type ApprovalRow = typeof approvals.$inferSelect
export type NotificationInsert = typeof notifications.$inferInsert

/** The remembered "wait for the reopen" for this token, if one still stands. */
export async function standingDeferral(
  db: DbOrTx,
  deskId: string,
  token: string,
): Promise<DeferralRow | undefined> {
  const [row] = await db
    .select()
    .from(deferrals)
    .where(
      and(
        eq(deferrals.deskId, deskId),
        eq(deferrals.token, token.toLowerCase()),
        eq(deferrals.status, 'standing'),
      ),
    )
  return row
}

export async function createDeferral(
  db: DbOrTx,
  input: {
    deskId: string
    decisionId: string
    token: string
    side: DeferralRow['side']
    revisitAt: Date
    baseline: Record<string, unknown>
  },
): Promise<void> {
  await db.insert(deferrals).values({ ...input, token: input.token.toLowerCase() })
}

export async function endDeferral(
  db: DbOrTx,
  id: string,
  status: 'broken' | 'revisited' | 'cancelled',
  reason: string,
): Promise<void> {
  await db
    .update(deferrals)
    .set({ status, endedReason: reason, endedAt: new Date() })
    .where(and(eq(deferrals.id, id), eq(deferrals.status, 'standing')))
}

export async function createApproval(
  db: DbOrTx,
  input: {
    deskId: string
    decisionId: string
    reason: ApprovalRow['reason']
    preview: Record<string, unknown>
    expiresAt: Date
  },
): Promise<void> {
  await db.insert(approvals).values(input)
}

/** Outbox. `dedupeKey` makes "once per token per cause per session" a fact the database enforces. */
export async function enqueueNotification(db: DbOrTx, n: NotificationInsert): Promise<void> {
  await db
    .insert(notifications)
    .values(n)
    .onConflictDoNothing({ target: [notifications.deskId, notifications.dedupeKey] })
}

export async function saveValueSnapshot(
  db: DbOrTx,
  input: {
    deskId: string
    kind: 'hourly' | 'close' | 'open' | 'manual'
    takenAt: Date
    totalUsdg: bigint
    cashUsdg: bigint
    vaultUsdg: bigint
    holdings: SnapshotHolding[]
    priceSource: string
    blockNumber?: number
  },
): Promise<void> {
  await db
    .insert(deskValueSnapshots)
    .values({ ...input, blockNumber: input.blockNumber ?? null })
    .onConflictDoNothing({
      target: [deskValueSnapshots.deskId, deskValueSnapshots.kind, deskValueSnapshots.takenAt],
    })
}

/** The first value ever recorded for a desk becomes its loss-limit baseline. Deposits and withdrawals move it. */
export async function ensureDrawdownBaseline(db: DbOrTx, deskId: string, totalUsdg: bigint): Promise<bigint> {
  const [row] = await db
    .update(desks)
    .set({
      drawdownBaselineUsdg: sql`coalesce(${desks.drawdownBaselineUsdg}, ${totalUsdg.toString()}::numeric)`,
    })
    .where(eq(desks.id, deskId))
    .returning({ baseline: desks.drawdownBaselineUsdg })
  return row?.baseline ?? totalUsdg
}

export async function recordDrawdownBreach(db: DbOrTx, deskId: string, breached: boolean): Promise<number> {
  const [row] = await db
    .update(desks)
    .set({ drawdownBreaches: breached ? sql`${desks.drawdownBreaches} + 1` : 0 })
    .where(eq(desks.id, deskId))
    .returning({ breaches: desks.drawdownBreaches })
  return row?.breaches ?? 0
}

export async function setDeskState(
  db: DbOrTx,
  deskId: string,
  state: 'active' | 'paused_by_owner' | 'stopped_by_loss_limit' | 'needs_attention',
  reason: string | null,
): Promise<void> {
  await db
    .update(desks)
    .set({ state, stateReason: reason, updatedAt: new Date() })
    .where(eq(desks.id, deskId))
}

/** When this desk was last sealed on-chain. The daily checkpoint runs when this is a day old or missing. */
export async function lastSealAt(db: DbOrTx, deskId: string): Promise<Date | undefined> {
  const [row] = await db
    .select({ sealedAt: decisions.sealedAt })
    .from(decisions)
    .where(and(eq(decisions.deskId, deskId), sql`${decisions.sealedAt} is not null`))
    .orderBy(desc(decisions.sealedAt))
    .limit(1)
  return row?.sealedAt ?? undefined
}

export type DeskWithOwner = typeof desks.$inferSelect & { ownerAddress: string }

export async function deskById(db: DbOrTx, deskId: string): Promise<DeskWithOwner | undefined> {
  const [row] = await db
    .select({ desk: desks, ownerAddress: owners.address })
    .from(desks)
    .innerJoin(owners, eq(desks.ownerId, owners.id))
    .where(eq(desks.id, deskId))
  return row ? { ...row.desk, ownerAddress: row.ownerAddress } : undefined
}

export async function latestValueSnapshot(db: DbOrTx, deskId: string) {
  const [row] = await db
    .select()
    .from(deskValueSnapshots)
    .where(eq(deskValueSnapshots.deskId, deskId))
    .orderBy(desc(deskValueSnapshots.takenAt))
    .limit(1)
  return row
}

/** Our own confirmed buys and sells since a moment. Reconcile subtracts these before blaming the outside world. */
export async function confirmedTradesSince(db: DbOrTx, deskId: string, since: Date) {
  const rows = await db
    .select({
      kind: actions.kind,
      token: actions.token,
      amountIn: actions.amountIn,
      actualOut: actions.actualOut,
    })
    .from(actions)
    .where(
      and(
        eq(actions.deskId, deskId),
        eq(actions.status, 'confirmed'),
        inArray(actions.kind, ['buy', 'sell']),
        gt(actions.resolvedAt, since),
      ),
    )
  return rows.flatMap((r) =>
    (r.kind === 'buy' || r.kind === 'sell') && r.token && r.amountIn !== null && r.actualOut !== null
      ? [{ kind: r.kind, token: r.token, amountIn: r.amountIn, actualOut: r.actualOut }]
      : [],
  )
}

/** Sets the loss-limit baseline. What it should become after money moved is worked out in the engine. */
export async function setDrawdownBaseline(db: DbOrTx, deskId: string, baselineUsdg: bigint): Promise<void> {
  await db.update(desks).set({ drawdownBaselineUsdg: baselineUsdg }).where(eq(desks.id, deskId))
}

export async function addDeskEvent(db: DbOrTx, event: typeof deskEvents.$inferInsert): Promise<void> {
  await db.insert(deskEvents).values(event)
}

/** Shadow starts here: the desk becomes `running` and its hourly checks begin. Idempotent. */
export async function startDesk(db: DbOrTx, deskId: string): Promise<void> {
  const now = new Date()
  await db
    .update(desks)
    .set({ lifecycle: 'running', startedAt: sql`coalesce(${desks.startedAt}, ${now})`, updatedAt: now })
    .where(and(eq(desks.id, deskId), inArray(desks.lifecycle, ['onboarding', 'running'])))
}

/** Who changed something, and from where. `chat` is the chat on the website or in Telegram. */
export type By = { actor: 'owner' | 'desk' | 'system'; via: 'web' | 'telegram' | 'chain' | 'worker' | 'chat' }

/** Going live is earned (design brief section 7): this many checks in practice, and the report opened. */
export const GO_LIVE_CHECKS = 24

export type ModeChange =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'practice_checks'; checksDone: number }
  | { ok: false; reason: 'report_unread'; checksDone: number }

/**
 * A mode change cancels pending approvals and standing deferrals: both were promises made under the old mode.
 * Leaving practice for a live mode is refused until the desk has done GO_LIVE_CHECKS practice checks AND the
 * owner has opened its report. Moving between the live modes, or back to practice, is always allowed.
 */
export async function setDeskMode(
  db: DbOrTx,
  deskId: string,
  mode: 'shadow' | 'ask_first' | 'on_its_own',
  by: By,
): Promise<ModeChange> {
  const now = new Date()
  const [before] = await db
    .select({ mode: desks.mode, checks: desks.shadowChecks, reportOpenedAt: desks.shadowReportOpenedAt })
    .from(desks)
    .where(eq(desks.id, deskId))
  if (!before || before.mode === mode) return { ok: true, changed: false }
  if (before.mode === 'shadow' && mode !== 'shadow') {
    if (before.checks < GO_LIVE_CHECKS)
      return { ok: false, reason: 'practice_checks', checksDone: before.checks }
    if (!before.reportOpenedAt) return { ok: false, reason: 'report_unread', checksDone: before.checks }
  }
  await db.update(desks).set({ mode, updatedAt: now }).where(eq(desks.id, deskId))
  await db
    .update(approvals)
    .set({ status: 'cancelled', cancelledReason: 'the mode changed' })
    .where(and(eq(approvals.deskId, deskId), eq(approvals.status, 'pending')))
  await db
    .update(deferrals)
    .set({ status: 'cancelled', endedReason: 'the mode changed', endedAt: now })
    .where(and(eq(deferrals.deskId, deskId), eq(deferrals.status, 'standing')))
  await db.insert(deskEvents).values({
    deskId,
    kind: 'mode_changed',
    actor: by.actor,
    via: by.via,
    detail: { from: before.mode, to: mode },
    at: now,
  })
  return { ok: true, changed: true }
}

/** The owner opened the practice report: half of what going live needs. Only the first opening is kept. */
export async function markShadowReportOpened(db: DbOrTx, deskId: string): Promise<void> {
  await db
    .update(desks)
    .set({ shadowReportOpenedAt: new Date() })
    .where(and(eq(desks.id, deskId), isNull(desks.shadowReportOpenedAt)))
}

/** Requests the owner never answered. Returns them so each can be announced: "Nothing was done." */
export async function expireApprovals(db: DbOrTx, deskId: string, now: Date) {
  return db
    .update(approvals)
    .set({ status: 'expired' })
    .where(and(eq(approvals.deskId, deskId), eq(approvals.status, 'pending'), lte(approvals.expiresAt, now)))
    .returning({ id: approvals.id, decisionId: approvals.decisionId })
}

/** When the owner was asked about this token, if that request is still open. */
export async function pendingApprovalSince(
  db: DbOrTx,
  deskId: string,
  token: string,
): Promise<Date | undefined> {
  const [row] = await db
    .select({ createdAt: approvals.createdAt })
    .from(approvals)
    .innerJoin(decisions, eq(approvals.decisionId, decisions.id))
    .where(
      and(
        eq(approvals.deskId, deskId),
        eq(approvals.status, 'pending'),
        eq(decisions.token, token.toLowerCase()),
      ),
    )
    .orderBy(desc(approvals.createdAt))
    .limit(1)
  return row?.createdAt
}

/** Every desk the clock should check. A paused or stopped desk is still checked: it records that it looked. */
export async function runningDesks(
  db: DbOrTx,
): Promise<{ id: string; address: string; contractVersion: string }[]> {
  return db
    .select({ id: desks.id, address: desks.address, contractVersion: desks.contractVersion })
    .from(desks)
    .where(eq(desks.lifecycle, 'running'))
}

/** True when this desk already has a check for that scheduled time. */
export async function hasWake(db: DbOrTx, deskId: string, scheduledFor: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: wakes.id })
    .from(wakes)
    .where(and(eq(wakes.deskId, deskId), eq(wakes.scheduledFor, scheduledFor)))
  return Boolean(row)
}

/** How long to wait before trying a refused daily seal again. */
const SEAL_RETRY_MS = 60 * 60 * 1000

/**
 * Plans the daily seal. A desk's newest record commits to every record before it, so sealing that ONE hash
 * on-chain seals them all. Returns undefined when there is nothing unsealed, or when the newest record already
 * has an unfinished leg. The checkpoint becomes the next leg of that newest record.
 */
export async function planCheckpoint(db: DbOrTx, deskId: string, operator: string) {
  const [latest] = await db
    .select({ id: decisions.id, recordHash: decisions.recordHash, sealedByTx: decisions.sealedByTx })
    .from(decisions)
    .where(eq(decisions.deskId, deskId))
    .orderBy(desc(decisions.seq))
    .limit(1)
  if (!latest || latest.sealedByTx) return undefined
  const legs = await db
    .select({ status: actions.status, kind: actions.kind, plannedAt: actions.plannedAt })
    .from(actions)
    .where(eq(actions.decisionId, latest.id))
  if (legs.some((l) => l.status === 'planned' || l.status === 'prepared' || l.status === 'sent'))
    return undefined
  // A seal that was refused, usually for want of gas, must not be retried every tick: that would leave a new
  // row every 15 seconds for as long as the cause lasts. One attempt an hour is enough for a DAILY seal.
  const lastTry = legs
    .filter((l) => l.kind === 'checkpoint')
    .reduce<Date | undefined>((a, l) => (!a || l.plannedAt > a ? l.plannedAt : a), undefined)
  if (lastTry && Date.now() - lastTry.getTime() < SEAL_RETRY_MS) return undefined
  const [action] = await db
    .insert(actions)
    .values({
      decisionId: latest.id,
      deskId,
      leg: legs.length,
      kind: 'checkpoint',
      operator: operator.toLowerCase(),
    })
    .returning()
  return action ? { action, recordHash: latest.recordHash } : undefined
}

/** True when the desk confirmed this same kind of trade on this same token since `since`. */
export async function didSameTradeSince(
  db: DbOrTx,
  deskId: string,
  token: string,
  side: 'buy' | 'sell',
  since: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ id: actions.id })
    .from(actions)
    .where(
      and(
        eq(actions.deskId, deskId),
        eq(actions.token, token.toLowerCase()),
        eq(actions.kind, side),
        inArray(actions.status, ['prepared', 'sent', 'confirmed']),
        gt(actions.plannedAt, since),
      ),
    )
    .limit(1)
  return Boolean(row)
}

/**
 * The owner's pause. Soft: instant, free and reversible. It cancels every pending approval and remembered
 * decision, because both were promises made while the desk was running (architecture 1.4 step 8).
 * Returns false when the desk was not active, so a second press does nothing.
 */
export async function pauseDesk(db: Db, deskId: string, by: By): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [row] = await tx
      .update(desks)
      .set({ state: 'paused_by_owner', stateReason: null, updatedAt: now })
      .where(and(eq(desks.id, deskId), eq(desks.state, 'active')))
      .returning({ id: desks.id })
    if (!row) return false
    await tx
      .update(approvals)
      .set({ status: 'cancelled', cancelledReason: 'the desk was paused' })
      .where(and(eq(approvals.deskId, deskId), eq(approvals.status, 'pending')))
    await tx
      .update(deferrals)
      .set({ status: 'cancelled', endedReason: 'the desk was paused', endedAt: now })
      .where(and(eq(deferrals.deskId, deskId), eq(deferrals.status, 'standing')))
    await tx.insert(deskEvents).values({ deskId, kind: 'paused', actor: by.actor, via: by.via, at: now })
    return true
  })
}

/**
 * The owner's restart, from a pause or from a loss-limit stop. Restarting after the loss limit resets the
 * baseline to what the desk is worth now: the owner has seen the loss and chosen to go on from here.
 */
export async function resumeDesk(
  db: Db,
  deskId: string,
  by: By,
  currentValueUsdg?: bigint,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [before] = await tx.select({ state: desks.state }).from(desks).where(eq(desks.id, deskId))
    if (!before || before.state === 'active' || before.state === 'needs_attention') return false
    // Restarting after the loss limit means counting from what the desk is worth now. Without this the next
    // check would measure the same loss against the old baseline and stop the desk again at once. With no value
    // given, the latest valuation is the one the owner saw.
    const resetTo =
      before.state === 'stopped_by_loss_limit'
        ? (currentValueUsdg ?? (await latestValueSnapshot(tx, deskId))?.totalUsdg)
        : undefined
    await tx
      .update(desks)
      .set({
        state: 'active',
        stateReason: null,
        drawdownBreaches: 0,
        ...(resetTo !== undefined ? { drawdownBaselineUsdg: resetTo } : {}),
        updatedAt: now,
      })
      .where(eq(desks.id, deskId))
    await tx.insert(deskEvents).values({
      deskId,
      kind: 'resumed',
      actor: by.actor,
      via: by.via,
      detail: { from: before.state, baselineReset: resetTo !== undefined },
      at: now,
    })
    return true
  })
}

/**
 * A check that was interrupted by a crash stays `running` for ever, and because a check is keyed on its hour,
 * that hour would then be skipped for ever. On boot, every check still `running` after this long is marked
 * failed, so the clock can move on and the record shows honestly that the check did not finish.
 */
export async function sweepInterruptedWakes(db: DbOrTx, olderThan: Date) {
  return db
    .update(wakes)
    .set({
      status: 'failed',
      error: 'The worker stopped before this check finished.',
      finishedAt: new Date(),
    })
    .where(and(eq(wakes.status, 'running'), lt(wakes.startedAt, olderThan)))
    .returning({ id: wakes.id, deskId: wakes.deskId, scheduledFor: wakes.scheduledFor })
}

/** Requests the owner has approved that the desk has not yet carried out. Oldest first: they are perishable. */
export async function answeredApprovals(db: DbOrTx, deskId: string) {
  return db
    .select({
      approvalId: approvals.id,
      reason: approvals.reason,
      answeredAt: approvals.answeredAt,
      answeredVia: approvals.answeredVia,
      preview: approvals.preview,
      decisionSeq: decisions.seq,
      record: decisions.record,
    })
    .from(approvals)
    .innerJoin(decisions, eq(approvals.decisionId, decisions.id))
    .where(
      and(
        eq(approvals.deskId, deskId),
        eq(approvals.status, 'approved'),
        isNull(approvals.executionDecisionId),
      ),
    )
    .orderBy(asc(approvals.answeredAt))
}

/** Ties the execution record to the request it carried out, so an approval is never acted on twice. */
export async function markApprovalExecuted(
  db: DbOrTx,
  approvalId: string,
  executionDecisionId: string,
): Promise<void> {
  await db.update(approvals).set({ executionDecisionId }).where(eq(approvals.id, approvalId))
}

/**
 * The owner's answer to a request. This is the ONLY way an approval is answered, from the website or from
 * Telegram, and it is a guarded update: the row must still be pending and not yet expired. No row back means
 * someone or something got there first, which is the honest answer to a double tap or a late reply.
 *
 * Nothing here trades. The worker picks the answer up on its next pass and re-checks everything itself.
 */
export async function answerApproval(
  db: DbOrTx,
  input: {
    approvalId: string
    answer: 'approved' | 'rejected'
    ownerId: string
    via: 'telegram' | 'web' | 'chat'
    now?: Date
  },
): Promise<ApprovalRow | undefined> {
  const now = input.now ?? new Date()
  const [row] = await db
    .update(approvals)
    .set({ status: input.answer, answeredBy: input.ownerId, answeredAt: now, answeredVia: input.via })
    .where(
      and(eq(approvals.id, input.approvalId), eq(approvals.status, 'pending'), gt(approvals.expiresAt, now)),
    )
    .returning()
  return row
}

/** Requests waiting for the owner, newest first, with what they are about. */
export async function pendingApprovals(db: DbOrTx, deskId: string) {
  return db
    .select({
      id: approvals.id,
      reason: approvals.reason,
      expiresAt: approvals.expiresAt,
      createdAt: approvals.createdAt,
      decisionSeq: decisions.seq,
      summary: decisions.summary,
      token: decisions.token,
      side: decisions.side,
      preview: approvals.preview,
    })
    .from(approvals)
    .innerJoin(decisions, eq(approvals.decisionId, decisions.id))
    .where(and(eq(approvals.deskId, deskId), eq(approvals.status, 'pending')))
    .orderBy(desc(approvals.createdAt))
}

/**
 * Turns the read-only public link on or off. The slug is the owner's choice and is unique across all desks.
 * Sharing is opt in: a desk with no slug, or with sharing off, is invisible to everyone but its owner.
 */
export async function setDeskShare(
  db: DbOrTx,
  deskId: string,
  share: { slug: string; enabled: boolean },
  by: By,
): Promise<void> {
  const now = new Date()
  await db
    .update(desks)
    .set({ shareSlug: share.slug, shareEnabled: share.enabled, updatedAt: now })
    .where(eq(desks.id, deskId))
  await db.insert(deskEvents).values({
    deskId,
    kind: 'share_changed',
    actor: by.actor,
    via: by.via,
    detail: { slug: share.slug, enabled: share.enabled },
    at: now,
  })
}

/** Decisions made before `before` that still have no grade. Only ones with a token can be compared. */
export async function ungradedDecisions(db: DbOrTx, deskId: string, before: Date, limit = 50) {
  return db
    .select({
      id: decisions.id,
      seq: decisions.seq,
      outcome: decisions.outcome,
      side: decisions.side,
      token: decisions.token,
      decidedAt: decisions.decidedAt,
      record: decisions.record,
    })
    .from(decisions)
    .leftJoin(grades, eq(grades.decisionId, decisions.id))
    .where(
      and(
        eq(decisions.deskId, deskId),
        lt(decisions.decidedAt, before),
        isNull(grades.id),
        isNotNull(decisions.token),
        inArray(decisions.outcome, [
          'acted',
          'acted_in_part',
          'acted_by_override',
          'would_have_acted',
          'waited',
          'declined',
        ]),
      ),
    )
    .orderBy(asc(decisions.seq))
    .limit(limit)
}

export async function saveGrade(db: DbOrTx, row: typeof grades.$inferInsert): Promise<void> {
  await db.insert(grades).values(row).onConflictDoNothing({ target: grades.decisionId })
}

/**
 * What the desk has spent in the last 24 hours, counted the way the CONTRACT counts it.
 *
 * The chain keeps its own window and its own total, which is what it enforces. This is for the owner's own
 * daily limit, which a mandate may set tighter than the one the desk was created with. A rolling 24 hours is
 * used rather than the chain's fixed window, because it is the stricter of the two and never lets a spend
 * slip through the boundary between windows.
 */
export async function spentSince(db: DbOrTx, deskId: string, since: Date): Promise<bigint> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${decisions.amountUsdg}), 0)::text` })
    .from(decisions)
    .where(
      and(
        eq(decisions.deskId, deskId),
        gt(decisions.decidedAt, since),
        // "Do it anyway" spends the same money, so it counts against the same limit.
        inArray(decisions.outcome, ['acted', 'acted_in_part', 'acted_by_override']),
      ),
    )
  return BigInt(row?.total ?? '0')
}

/**
 * Everything that follows from money moving in or out of a desk, in ONE transaction.
 *
 * The snapshot is what stops the NEXT check seeing the same movement again. If the baseline moved but the
 * snapshot was never written, a crash in between would have the desk scale its baseline twice for one
 * deposit. So the three writes commit together or not at all.
 */
export async function recordOutsideChanges(
  db: Db,
  input: {
    deskId: string
    baselineUsdg: bigint
    event: Record<string, unknown>
    snapshot: Parameters<typeof saveValueSnapshot>[1]
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    await setDrawdownBaseline(tx, input.deskId, input.baselineUsdg)
    await tx.insert(deskEvents).values({
      deskId: input.deskId,
      kind: 'holdings_changed_outside',
      actor: 'system',
      via: 'chain',
      detail: input.event,
    })
    await saveValueSnapshot(tx, input.snapshot)
  })
}

// ---------------------------------------------------------------- Telegram

/** A single-use code that ties a Telegram chat to one desk. It dies after ten minutes. */
export async function createTelegramLink(db: DbOrTx, deskId: string, code: string, minutes = 10) {
  const [row] = await db
    .insert(telegramLinks)
    .values({ deskId, code, codeExpiresAt: new Date(Date.now() + minutes * 60_000) })
    .returning()
  return row
}

/**
 * Spends a link code and ties the chat to the desk. Guarded: the row must still be pending and unexpired, so
 * a code that leaks after it has been used, or after ten minutes, is worth nothing.
 */
export async function claimTelegramLink(
  db: DbOrTx,
  code: string,
  chat: { userId: number; chatId: number; username?: string | undefined },
) {
  const now = new Date()
  const [row] = await db
    .update(telegramLinks)
    .set({
      status: 'linked',
      telegramUserId: chat.userId,
      telegramChatId: chat.chatId,
      telegramUsername: chat.username ?? null,
      linkedAt: now,
    })
    .where(
      and(
        eq(telegramLinks.code, code),
        eq(telegramLinks.status, 'pending'),
        gt(telegramLinks.codeExpiresAt, now),
      ),
    )
    .returning()
  return row
}

/** The desk this Telegram user is allowed to hear about. Nobody else's desk is ever answered for. */
export async function deskForTelegramUser(db: DbOrTx, telegramUserId: number) {
  const [row] = await db
    .select({ link: telegramLinks, desk: desks })
    .from(telegramLinks)
    .innerJoin(desks, eq(telegramLinks.deskId, desks.id))
    .where(and(eq(telegramLinks.telegramUserId, telegramUserId), eq(telegramLinks.status, 'linked')))
  return row
}

export async function linkForDesk(db: DbOrTx, deskId: string) {
  const [row] = await db
    .select()
    .from(telegramLinks)
    .where(and(eq(telegramLinks.deskId, deskId), eq(telegramLinks.status, 'linked')))
  return row
}

export async function setStatusMessageId(db: DbOrTx, linkId: string, messageId: number): Promise<void> {
  await db.update(telegramLinks).set({ statusMessageId: messageId }).where(eq(telegramLinks.id, linkId))
}

/** Messages the engine queued that have not gone out. Oldest first, so a story arrives in order. */
export async function pendingNotifications(db: DbOrTx, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.status, 'pending'), lte(notifications.sendAfter, new Date())))
    .orderBy(asc(notifications.id))
    .limit(limit)
}

export async function markNotificationSent(
  db: DbOrTx,
  id: number,
  outcome: { status: 'sent' | 'failed' | 'skipped'; messageId?: number; error?: string },
): Promise<void> {
  await db
    .update(notifications)
    .set({
      status: outcome.status,
      telegramMessageId: outcome.messageId ?? null,
      lastError: outcome.error ?? null,
      attempts: sql`${notifications.attempts} + 1`,
      sentAt: outcome.status === 'sent' ? new Date() : null,
    })
    .where(eq(notifications.id, id))
}

/** The Telegram message that carried a request, so answering anywhere can update it. */
export async function approvalMessageId(db: DbOrTx, decisionId: string): Promise<number | undefined> {
  const [row] = await db
    .select({ id: notifications.telegramMessageId })
    .from(notifications)
    .where(
      and(
        eq(notifications.decisionId, decisionId),
        inArray(notifications.kind, ['approval_request', 'large_action_request']),
      ),
    )
  return row?.id ?? undefined
}

export async function approvalById(db: DbOrTx, approvalId: string) {
  const [row] = await db
    .select({ approval: approvals, decision: decisions })
    .from(approvals)
    .innerJoin(decisions, eq(approvals.decisionId, decisions.id))
    .where(eq(approvals.id, approvalId))
  return row
}

/** The block of this desk's newest confirmed action: a safe place to start looking for calls made after it. */
export async function lastConfirmedActionBlock(db: DbOrTx, deskId: string): Promise<number | undefined> {
  const [row] = await db
    .select({ blockNumber: actions.blockNumber })
    .from(actions)
    .where(and(eq(actions.deskId, deskId), eq(actions.status, 'confirmed'), isNotNull(actions.blockNumber)))
    .orderBy(desc(actions.blockNumber))
    .limit(1)
  return row?.blockNumber ?? undefined
}

/** One recorded on-chain call the owner (or the owner's session key) made, not our worker. */
export interface OwnerCall {
  seq: number
  event: string
  txHash: string
  blockNumber: number
  by: 'owner' | 'session'
  from: string
  decisionHash: string
  detail: Record<string, string>
}

/**
 * The owner's own recorded calls, noted as desk events, and the desk's `chain_seq` moved past them, in one
 * transaction. Guarded on the old `chain_seq`, so two workers can never both advance it. False when the desk
 * had already moved on.
 */
export async function recordOwnerCalls(
  db: Db,
  deskId: string,
  fromSeq: number,
  toSeq: number,
  calls: OwnerCall[],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(desks)
      .set({ chainSeq: toSeq, updatedAt: new Date() })
      .where(and(eq(desks.id, deskId), eq(desks.chainSeq, fromSeq)))
      .returning({ id: desks.id })
    if (moved.length === 0) return false
    if (calls.length > 0) {
      await tx.insert(deskEvents).values(
        calls.map((c) => ({
          deskId,
          kind: 'owner_action' as const,
          actor: 'owner' as const,
          via: 'chain' as const,
          detail: { ...c },
        })),
      )
    }
    return true
  })
}
