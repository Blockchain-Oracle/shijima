/**
 * A desk reached from an OpenServ workspace: the link the owner makes on the website and spends in the workspace
 * with "link <code>". Modelled on the Telegram link, with the workspace in the place of the chat.
 */
import { and, desc, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { decisions, desks, openservLinks, owners } from '../schema'
import type { OpenservOrigin } from './chat'

/** A fresh one-time code for this desk. Earlier waiting codes stay valid until they expire or one is used. */
export async function createOpenservLink(db: DbOrTx, deskId: string, code: string, minutes = 30) {
  const [row] = await db
    .insert(openservLinks)
    .values({ deskId, code, codeExpiresAt: new Date(Date.now() + minutes * 60_000) })
    .returning()
  return row
}

export type OpenservLinkClaim = { ok: true; deskId: string } | { ok: false; reason: 'used' | 'another_desk' }

/**
 * Spends a code and ties the workspace to the desk. The row must still be pending and unexpired; a workspace
 * already linked to another desk is refused, so a message there can never act on the wrong desk.
 */
export async function claimOpenservLink(
  db: Db,
  code: string,
  workspaceId: string,
  workspaceName?: string | null,
): Promise<OpenservLinkClaim> {
  const now = new Date()
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select({ deskId: openservLinks.deskId })
      .from(openservLinks)
      .where(
        and(
          eq(openservLinks.code, code),
          eq(openservLinks.status, 'pending'),
          gt(openservLinks.codeExpiresAt, now),
        ),
      )
      .for('update')
    if (!pending) return { ok: false, reason: 'used' }
    const [elsewhere] = await tx
      .select({ deskId: openservLinks.deskId })
      .from(openservLinks)
      .where(and(eq(openservLinks.workspaceId, workspaceId), eq(openservLinks.status, 'linked')))
    if (elsewhere && elsewhere.deskId !== pending.deskId) return { ok: false, reason: 'another_desk' }
    if (elsewhere) return { ok: true, deskId: pending.deskId }
    const [row] = await tx
      .update(openservLinks)
      .set({
        status: 'linked',
        workspaceId,
        workspaceName: workspaceName?.slice(0, 200) || null,
        linkedAt: now,
      })
      .where(and(eq(openservLinks.code, code), eq(openservLinks.status, 'pending')))
      .returning({ deskId: openservLinks.deskId })
    return row ? { ok: true, deskId: row.deskId } : { ok: false, reason: 'used' }
  })
}

/** The desk a workspace was linked to, with what the agent needs to answer for it. Undefined when not linked. */
export async function deskForWorkspace(db: DbOrTx, workspaceId: string) {
  const [row] = await db
    .select({
      deskId: desks.id,
      name: desks.name,
      shareSlug: desks.shareSlug,
      lifecycle: desks.lifecycle,
      address: desks.address,
      mode: desks.mode,
      ownerAddress: owners.address,
      linkId: openservLinks.id,
      allowChecks: openservLinks.allowChecks,
    })
    .from(openservLinks)
    .innerJoin(desks, eq(desks.id, openservLinks.deskId))
    .innerJoin(owners, eq(owners.id, desks.ownerId))
    .where(and(eq(openservLinks.workspaceId, workspaceId), eq(openservLinks.status, 'linked')))
    .limit(1)
  return row
}

/** A desk's OpenServ link for its owner's Connections card: the linked workspace, and any live waiting code. */
export async function openservForDesk(db: DbOrTx, deskId: string) {
  const rows = await db
    .select({
      status: openservLinks.status,
      code: openservLinks.code,
      codeExpiresAt: openservLinks.codeExpiresAt,
      workspaceId: openservLinks.workspaceId,
      linkedAt: openservLinks.linkedAt,
    })
    .from(openservLinks)
    .where(and(eq(openservLinks.deskId, deskId), inArray(openservLinks.status, ['pending', 'linked'])))
    .orderBy(desc(openservLinks.createdAt))
  const now = Date.now()
  return {
    linked: rows.filter((r) => r.status === 'linked'),
    pending: rows.find((r) => r.status === 'pending' && r.codeExpiresAt.getTime() > now) ?? null,
  }
}

/** Unlinks every workspace from this desk. Messages there get the "not linked" reply from then on. */
export async function unlinkOpenserv(db: DbOrTx, deskId: string): Promise<number> {
  const rows = await db
    .update(openservLinks)
    .set({ status: 'revoked', revokedAt: new Date() })
    .where(and(eq(openservLinks.deskId, deskId), inArray(openservLinks.status, ['pending', 'linked'])))
    .returning({ id: openservLinks.id })
  return rows.length
}

/**
 * Every workspace linked to any of this owner's desks, for the Connections card. Scoped by the signed-in owner's
 * address, so an id from the browser can never show or reach another owner's link. The webhook is reported as
 * set or not, never returned.
 */
export async function openservLinksOfOwner(db: DbOrTx, ownerAddress: string) {
  const rows = await db
    .select({
      id: openservLinks.id,
      deskId: desks.id,
      deskName: desks.name,
      workspaceName: openservLinks.workspaceName,
      createdAt: openservLinks.createdAt,
      linkedAt: openservLinks.linkedAt,
      allowChecks: openservLinks.allowChecks,
      webhookUrlEnc: openservLinks.webhookUrlEnc,
    })
    .from(openservLinks)
    .innerJoin(desks, eq(desks.id, openservLinks.deskId))
    .innerJoin(owners, eq(owners.id, desks.ownerId))
    .where(and(eq(owners.address, ownerAddress.toLowerCase()), eq(openservLinks.status, 'linked')))
    .orderBy(desc(openservLinks.linkedAt))
  return rows.map(({ webhookUrlEnc, ...r }) => ({ ...r, hasWebhook: webhookUrlEnc !== null }))
}

/** A linked row of this owner's, by id. Undefined when it is someone else's or no longer linked. */
async function ownedLink(db: DbOrTx, linkId: string, ownerAddress: string) {
  const [row] = await db
    .select({ id: openservLinks.id, deskId: openservLinks.deskId })
    .from(openservLinks)
    .innerJoin(desks, eq(desks.id, openservLinks.deskId))
    .innerJoin(owners, eq(owners.id, desks.ownerId))
    .where(
      and(
        eq(openservLinks.id, linkId),
        eq(owners.address, ownerAddress.toLowerCase()),
        eq(openservLinks.status, 'linked'),
      ),
    )
  return row
}

/** Unlinks ONE workspace, only when the link belongs to this owner. False when nothing of theirs matched. */
export async function unlinkOpenservLink(db: DbOrTx, linkId: string, ownerAddress: string): Promise<boolean> {
  if (!(await ownedLink(db, linkId, ownerAddress))) return false
  const rows = await db
    .update(openservLinks)
    .set({ status: 'revoked', revokedAt: new Date(), webhookUrlEnc: null })
    .where(and(eq(openservLinks.id, linkId), eq(openservLinks.status, 'linked')))
    .returning({ id: openservLinks.id })
  return rows.length > 0
}

/** The owner's switch "Let my workspace trigger checks", on one of their own links. */
export async function setOpenservAllowChecks(
  db: DbOrTx,
  linkId: string,
  ownerAddress: string,
  allow: boolean,
): Promise<boolean> {
  if (!(await ownedLink(db, linkId, ownerAddress))) return false
  await db.update(openservLinks).set({ allowChecks: allow }).where(eq(openservLinks.id, linkId))
  return true
}

/** Saves (already encrypted) or clears the webhook on one of the owner's own links. */
export async function setOpenservWebhook(
  db: DbOrTx,
  linkId: string,
  ownerAddress: string,
  webhookUrlEnc: string | null,
): Promise<boolean> {
  if (!(await ownedLink(db, linkId, ownerAddress))) return false
  await db.update(openservLinks).set({ webhookUrlEnc }).where(eq(openservLinks.id, linkId))
  return true
}

/** The encrypted webhooks of every workspace linked to this desk. The worker decrypts and POSTs to each. */
export async function openservWebhooksForDesk(db: DbOrTx, deskId: string) {
  return db
    .select({ linkId: openservLinks.id, webhookUrlEnc: openservLinks.webhookUrlEnc })
    .from(openservLinks)
    .where(
      and(
        eq(openservLinks.deskId, deskId),
        eq(openservLinks.status, 'linked'),
        isNotNull(openservLinks.webhookUrlEnc),
      ),
    )
}

/** Stamps the OpenServ session that asked onto the decisions a check wrote. Never overwrites an earlier stamp. */
export async function markDecisionsFromOpenserv(
  db: DbOrTx,
  deskId: string,
  seqs: number[],
  origin: OpenservOrigin,
): Promise<number> {
  if (seqs.length === 0) return 0
  const rows = await db
    .update(decisions)
    .set({
      openservWorkspace: origin.workspace,
      openservTaskId: origin.taskId,
      openservExecutionId: origin.executionId,
    })
    .where(
      and(eq(decisions.deskId, deskId), inArray(decisions.seq, seqs), isNull(decisions.openservWorkspace)),
    )
    .returning({ id: decisions.id })
  return rows.length
}

/** The newest decisions of one desk, compact, for a linked workspace and for the webhook. */
export async function recentDecisionsOfDesk(db: DbOrTx, deskId: string, limit = 5, seqs?: number[]) {
  return db
    .select({
      seq: decisions.seq,
      kind: decisions.kind,
      outcome: decisions.outcome,
      summary: decisions.summary,
      token: decisions.token,
      side: decisions.side,
      amountUsdg: decisions.amountUsdg,
      shadow: decisions.shadow,
      result: decisions.result,
      decidedAt: decisions.decidedAt,
      openservWorkspace: decisions.openservWorkspace,
      openservTaskId: decisions.openservTaskId,
    })
    .from(decisions)
    .where(and(eq(decisions.deskId, deskId), seqs ? inArray(decisions.seq, seqs) : undefined))
    .orderBy(desc(decisions.seq))
    .limit(Math.min(Math.max(limit, 1), 20))
}
