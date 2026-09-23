/**
 * A desk reached from an OpenServ workspace: the link the owner makes on the website and spends in the workspace
 * with "link <code>". Modelled on the Telegram link, with the workspace in the place of the chat.
 */
import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { desks, openservLinks } from '../schema'

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
      .set({ status: 'linked', workspaceId, linkedAt: now })
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
    })
    .from(openservLinks)
    .innerJoin(desks, eq(desks.id, openservLinks.deskId))
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
