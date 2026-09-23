/**
 * Copy trading (D4, D5): who copies whom, and which of a leader's moves a follower has not yet answered.
 *
 * Starting to copy and stopping each change the follower's mandate in the same transaction as the link, because
 * `mandate.follow` is what turns the follower's own drift rebalancing off and on. A pause leaves the mandate alone:
 * the follower keeps what it holds and does nothing new until it resumes or stops.
 */
import { and, asc, eq, exists, gte, inArray, isNotNull, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db, DbOrTx } from '../client'
import { actions, copyLinks, decisions, desks } from '../schema'
import type { By } from './engine'
import { applyMandateIn, currentMandate, mandateFromRow } from './mandates'

export type CopyLinkRow = typeof copyLinks.$inferSelect

/** The most a creator may charge to be copied: $5 in USDG, 6 decimals (D5). */
export const MAX_COPY_FEE_USDG = 5_000_000n

export class CopyLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CopyLinkError'
  }
}

/** The creator's switch and one-time fee. A fee outside $0 to $5 is refused, never clamped. */
export async function setCopyable(
  db: DbOrTx,
  deskId: string,
  settings: { copyable: boolean; feeUsdg?: bigint },
): Promise<void> {
  const fee = settings.feeUsdg
  if (fee !== undefined && (fee < 0n || fee > MAX_COPY_FEE_USDG))
    throw new CopyLinkError('the copy fee must be between $0 and $5')
  await db
    .update(desks)
    .set({
      copyable: settings.copyable,
      ...(fee === undefined ? {} : { copyFeeUsdg: fee }),
      updatedAt: new Date(),
    })
    .where(eq(desks.id, deskId))
}

/**
 * The follower starts copying the leader. In one transaction: the link, and a new mandate version for the follower
 * that follows the leader and takes the leader's targets for reference. The follower keeps its own limits, loss
 * limit and rules. Refused when the leader does not allow copying, has no mandate, or the follower already copies.
 */
export async function startCopying(
  db: Db,
  input: {
    followerDeskId: string
    leaderDeskId: string
    creatorFeeTx?: string
    platformFeeTx?: string
    by: By
  },
): Promise<CopyLinkRow> {
  if (input.followerDeskId === input.leaderDeskId) throw new CopyLinkError('an agent cannot copy itself')
  return db.transaction(async (tx) => {
    const [leader] = await tx.select().from(desks).where(eq(desks.id, input.leaderDeskId))
    if (!leader) throw new CopyLinkError('that agent does not exist')
    if (!leader.copyable) throw new CopyLinkError('that agent does not allow copying')
    const [already] = await tx
      .select({ id: copyLinks.id })
      .from(copyLinks)
      .where(and(eq(copyLinks.followerDeskId, input.followerDeskId), ne(copyLinks.status, 'stopped')))
    if (already) throw new CopyLinkError('this agent already copies another; stop that first')
    const leaderMandate = await currentMandate(tx, leader.id)
    const followerMandate = await currentMandate(tx, input.followerDeskId)
    if (!leaderMandate) throw new CopyLinkError('that agent has no strategy yet')
    if (!followerMandate) throw new CopyLinkError('this agent has no mandate yet')

    const now = new Date()
    const [link] = await tx
      .insert(copyLinks)
      .values({
        followerDeskId: input.followerDeskId,
        leaderDeskId: leader.id,
        feeUsdg: leader.copyFeeUsdg,
        creatorFeeTx: input.creatorFeeTx?.toLowerCase() ?? null,
        platformFeeTx: input.platformFeeTx?.toLowerCase() ?? null,
        activeSince: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!link) throw new CopyLinkError('the copy link was not saved')
    const own = mandateFromRow(followerMandate)
    await applyMandateIn(
      tx,
      input.followerDeskId,
      {
        ...own,
        preset: leaderMandate.preset,
        targets: leaderMandate.targets,
        follow: { leaderDeskId: leader.id },
      },
      input.by,
    )
    return link
  })
}

/** Stops copying for now. The follower keeps what it holds and makes no new moves of its own. */
export async function pauseCopying(db: DbOrTx, followerDeskId: string): Promise<CopyLinkRow | undefined> {
  const [row] = await db
    .update(copyLinks)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(and(eq(copyLinks.followerDeskId, followerDeskId), eq(copyLinks.status, 'active')))
    .returning()
  return row
}

/** Copies again from now on. Moves the leader made while paused are never copied late. */
export async function resumeCopying(db: DbOrTx, followerDeskId: string): Promise<CopyLinkRow | undefined> {
  const now = new Date()
  const [row] = await db
    .update(copyLinks)
    .set({ status: 'active', activeSince: now, updatedAt: now })
    .where(and(eq(copyLinks.followerDeskId, followerDeskId), eq(copyLinks.status, 'paused')))
    .returning()
  return row
}

/**
 * Stops copying for good. The follower's mandate loses `follow`, so from the next check it runs on its own again,
 * toward the targets it took from the leader. Its money and holdings are untouched.
 */
export async function stopCopying(db: Db, followerDeskId: string, by: By): Promise<CopyLinkRow | undefined> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(copyLinks)
      .set({ status: 'stopped', updatedAt: new Date() })
      .where(and(eq(copyLinks.followerDeskId, followerDeskId), ne(copyLinks.status, 'stopped')))
      .returning()
    if (!row) return undefined
    const mandate = await currentMandate(tx, followerDeskId)
    if (mandate?.follow) {
      const { follow: _, ...own } = mandateFromRow(mandate)
      await applyMandateIn(tx, followerDeskId, own, by)
    }
    return row
  })
}

/** Who copies this leader, newest first, with each follower's name. Stopped links are history and left out. */
export async function followersOf(db: DbOrTx, leaderDeskId: string) {
  return db
    .select({ link: copyLinks, name: desks.name, address: desks.address, mode: desks.mode })
    .from(copyLinks)
    .innerJoin(desks, eq(desks.id, copyLinks.followerDeskId))
    .where(and(eq(copyLinks.leaderDeskId, leaderDeskId), ne(copyLinks.status, 'stopped')))
    .orderBy(sql`${copyLinks.createdAt} desc`)
}

/** The leader this desk copies, active or paused, or undefined when it runs on its own. */
export async function leaderOf(db: DbOrTx, followerDeskId: string) {
  const [row] = await db
    .select({
      link: copyLinks,
      name: desks.name,
      address: desks.address,
      shareSlug: desks.shareSlug,
    })
    .from(copyLinks)
    .innerJoin(desks, eq(desks.id, copyLinks.leaderDeskId))
    .where(and(eq(copyLinks.followerDeskId, followerDeskId), ne(copyLinks.status, 'stopped')))
  return row
}

/** A leader decision that counts as a move made: a trade the chain confirmed. */
const MADE: (typeof decisions.$inferSelect.outcome)[] = ['acted', 'acted_in_part', 'acted_by_override']

/**
 * Leader moves that an active follower has not yet answered, oldest first. A move is a leader trade the chain
 * confirmed, or, for a follower in practice only, a leader's practice "would have". Only moves made since the link
 * became active count. A follower's record naming the move, copied or missed, is what answers it, so a move is
 * never handed out twice, and the unique index on (desk, copied_from) is the backstop.
 */
export async function pendingCopies(db: DbOrTx, limit = 20) {
  const follower = alias(desks, 'follower')
  const leader = alias(desks, 'leader')
  const answered = alias(decisions, 'answered')
  return db
    .select({
      linkId: copyLinks.id,
      followerDeskId: copyLinks.followerDeskId,
      leader: { id: leader.id, name: leader.name, address: leader.address, shareSlug: leader.shareSlug },
      decision: {
        id: decisions.id,
        seq: decisions.seq,
        outcome: decisions.outcome,
        side: decisions.side,
        token: decisions.token,
        record: decisions.record,
        decidedAt: decisions.decidedAt,
      },
      /** What the leader really put in, from its confirmed transaction. Null for a practice "would have". */
      actionAmountIn: actions.amountIn,
    })
    .from(copyLinks)
    .innerJoin(follower, eq(follower.id, copyLinks.followerDeskId))
    .innerJoin(leader, eq(leader.id, copyLinks.leaderDeskId))
    .innerJoin(decisions, eq(decisions.deskId, copyLinks.leaderDeskId))
    .leftJoin(
      actions,
      and(
        eq(actions.decisionId, decisions.id),
        eq(actions.status, 'confirmed'),
        inArray(actions.kind, ['buy', 'sell']),
      ),
    )
    .where(
      and(
        eq(copyLinks.status, 'active'),
        eq(follower.lifecycle, 'running'),
        inArray(decisions.side, ['buy', 'sell']),
        gte(decisions.decidedAt, copyLinks.activeSince),
        or(
          and(inArray(decisions.outcome, MADE), isNotNull(actions.id)),
          and(eq(decisions.outcome, 'would_have_acted'), eq(follower.mode, 'shadow')),
        ),
        sql`not ${exists(
          db
            .select({ one: sql`1` })
            .from(answered)
            .where(
              and(
                eq(answered.deskId, copyLinks.followerDeskId),
                eq(answered.copiedFromDecisionId, decisions.id),
              ),
            ),
        )}`,
      ),
    )
    .orderBy(asc(decisions.decidedAt))
    .limit(limit)
}
export type PendingCopy = Awaited<ReturnType<typeof pendingCopies>>[number]

/** A desk named the way a person would on the command line: its id, its public slug, its address or its name. */
export async function deskByRef(db: DbOrTx, ref: string) {
  const lower = ref.toLowerCase()
  const byId = /^[0-9a-f-]{36}$/.test(lower) ? eq(desks.id, lower) : undefined
  const rows = await db
    .select()
    .from(desks)
    .where(
      or(...(byId ? [byId] : []), eq(desks.shareSlug, lower), eq(desks.address, lower), eq(desks.name, ref)),
    )
  if (rows.length > 1) throw new CopyLinkError(`"${ref}" names ${rows.length} agents; use its id`)
  return rows[0]
}

/** The follower's record that answered a leader's move, if there is one. */
export async function copyAnswer(db: DbOrTx, followerDeskId: string, leaderDecisionId: string) {
  const [row] = await db
    .select({ id: decisions.id, seq: decisions.seq, outcome: decisions.outcome, summary: decisions.summary })
    .from(decisions)
    .where(and(eq(decisions.deskId, followerDeskId), eq(decisions.copiedFromDecisionId, leaderDecisionId)))
  return row
}
