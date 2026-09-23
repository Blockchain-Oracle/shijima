'use server'

import { randomBytes } from 'node:crypto'
import { APPROVED_TOKENS } from '@desk/chain'
import { BUTTON_KINDS, type ButtonKind, proposeDirect } from '@desk/core'
import {
  acceptDisclosure,
  createOpenservLink,
  createTelegramOwnerLink,
  deskById,
  ensureOwner,
  markInboxRead,
  openservForDesk,
  ownerInbox,
  ownsDesk,
  proposalForOwner,
  setDeskShare,
  telegramForOwner,
  unlinkOpenserv,
  unlinkOwnerTelegram,
} from '@desk/db'
import { DISCLOSURE_VERSION, errorText, settingsCopy } from '@desk/shared'
import { revalidatePath } from 'next/cache'
import { type ChatCard, toChatCard } from '@/features/desk/chat-model'
import { type Preview, previewChainProposal } from '@/lib/chain-proposals.server'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

/**
 * The owner's buttons and settings. Every one checks the SIGNED-IN wallet against the desk on the server before
 * it touches anything; an id from the browser proves nothing. None of them moves money: a button makes a card,
 * and money moves only when the owner's key or wallet signs that card's one transaction.
 */

async function ownerOf(deskId: string): Promise<string | undefined> {
  const address = await signedInAddress()
  if (!address) return undefined
  return (await ownsDesk(db(), deskId, address)) ? address : undefined
}

export type ProposeResult = { ok: true; card: ChatCard } | { ok: false; why: string }

/** A button's card: the same checks as the chat, saved the same way, shown in place and in the thread. */
export async function proposeAction(input: {
  deskId: string
  kind: ButtonKind
  words: string
  fields?: Record<string, string | null>
}): Promise<ProposeResult> {
  try {
    const owner = await ownerOf(input.deskId)
    if (!owner) return { ok: false, why: 'That is not your agent.' }
    if (!(BUTTON_KINDS as readonly string[]).includes(input.kind))
      return { ok: false, why: 'That is not something a button can do.' }
    const fields = Object.fromEntries(
      Object.entries(input.fields ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : null]),
    )
    const made = await proposeDirect(db(), APPROVED_TOKENS, {
      deskId: input.deskId,
      ownerAddress: owner,
      via: 'web',
      words: input.words.slice(0, 200),
      kind: input.kind,
      fields,
    })
    if (!made.ok) return { ok: false, why: made.why }
    const row = await proposalForOwner(db(), made.proposalId, owner)
    if (!row) return { ok: false, why: 'The card was not saved.' }
    return { ok: true, card: toChatCard(row) }
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

/** What a chain card would do and cost, before anything is signed. */
export async function previewChainProposalAction(
  proposalId: string,
): Promise<{ ok: true; preview: Preview } | { ok: false; why: string }> {
  const address = await signedInAddress()
  if (!address) return { ok: false, why: 'Sign in first.' }
  try {
    return await previewChainProposal(proposalId, address)
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

// ---------------------------------------------------------------- settings

export type TelegramState = Awaited<ReturnType<typeof telegramStateAction>>

/** The signed-in wallet's owner row. Made on the spot: Telegram can be connected before any agent exists. */
async function signedInOwner(): Promise<string | undefined> {
  const address = await signedInAddress()
  if (!address) return undefined
  return (await ensureOwner(db(), address)).id
}

/** Telegram belongs to the wallet (DECISIONS F6): one chat for every agent, connected with or without one. */
export async function telegramStateAction() {
  const ownerId = await signedInOwner()
  if (!ownerId) return null
  const t = await telegramForOwner(db(), ownerId)
  return {
    linked: t.linked ? { username: t.linked.username } : null,
    pending: t.pending ? { code: t.pending.code, expiresAt: t.pending.codeExpiresAt.toISOString() } : null,
  }
}

/** A one-time code for the bot: works once, for ten minutes. A code still waiting is handed back, not replaced. */
export async function telegramCodeAction(): Promise<{ ok: true; code: string } | { ok: false; why: string }> {
  try {
    const ownerId = await signedInOwner()
    if (!ownerId) return { ok: false, why: 'Sign in first.' }
    const t = await telegramForOwner(db(), ownerId)
    if (t.linked) return { ok: false, why: 'Telegram is already connected.' }
    if (t.pending) return { ok: true, code: t.pending.code }
    // 48 bits: twelve characters, still typeable, and far past guessing within ten minutes.
    const code = randomBytes(6).toString('hex')
    await createTelegramOwnerLink(db(), ownerId, code)
    return { ok: true, code }
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

/**
 * A code that ties an OpenServ workspace to this desk: the owner sends "link <code>" in the workspace and its chat
 * and tasks reach this desk's agent from then on. Upper-case letters and digits, easy to type from a screen.
 */
export async function openservCodeAction(
  deskId: string,
): Promise<{ ok: true; code: string; expiresAt: string } | { ok: false; why: string }> {
  try {
    if (!(await ownerOf(deskId))) return { ok: false, why: 'That is not your agent.' }
    const o = await openservForDesk(db(), deskId)
    if (o.pending) return { ok: true, code: o.pending.code, expiresAt: o.pending.codeExpiresAt.toISOString() }
    const code = randomBytes(4).toString('hex').toUpperCase()
    const row = await createOpenservLink(db(), deskId, code)
    return { ok: true, code, expiresAt: (row?.codeExpiresAt ?? new Date()).toISOString() }
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

export async function openservUnlinkAction(deskId: string): Promise<{ ok: boolean }> {
  if (!(await ownerOf(deskId))) return { ok: false }
  const n = await unlinkOpenserv(db(), deskId)
  revalidatePath(`/agents/${deskId}/settings`)
  return { ok: n > 0 }
}

export async function telegramUnlinkAction(): Promise<{ ok: boolean }> {
  const ownerId = await signedInOwner()
  if (!ownerId) return { ok: false }
  const done = await unlinkOwnerTelegram(db(), ownerId, { actor: 'owner', via: 'web' })
  revalidatePath('/settings')
  return { ok: done }
}

/**
 * Sharing on or off. The link's name is made once and kept, so turning sharing back on brings the same link
 * back rather than breaking links already given out.
 */
export async function shareAction(deskId: string, enabled: boolean): Promise<{ ok: boolean; slug?: string }> {
  if (!(await ownerOf(deskId))) return { ok: false }
  const desk = await deskById(db(), deskId)
  if (!desk) return { ok: false }
  const slug =
    desk.shareSlug ??
    randomBytes(6)
      .toString('base64url')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, 'x')
  await setDeskShare(db(), deskId, { slug, enabled }, { actor: 'owner', via: 'web' })
  revalidatePath(`/agents/${deskId}/settings`)
  return { ok: true, slug }
}

export async function acceptDisclosureAction(): Promise<{ ok: true } | { ok: false; why: string }> {
  const address = await signedInAddress()
  if (!address) return { ok: false, why: settingsCopy.disclosure.signIn }
  try {
    // A wallet that has never made a desk still has an owner's row: sign-in creates it, and this is the backstop.
    const owner = await ensureOwner(db(), address)
    await acceptDisclosure(db(), owner.id, DISCLOSURE_VERSION)
    return { ok: true }
  } catch (e) {
    return { ok: false, why: `${settingsCopy.disclosure.failed} ${errorText(e)}` }
  }
}

export interface InboxItem {
  id: number
  deskId: string
  deskName: string
  kind: string
  text: string
  decisionSeq: number | null
  /** A price alert names its stock, and opens that stock's page. */
  symbol: string | null
  at: string
  read: boolean
}

/** The owner's messages across their desks, newest first, in the words the engine wrote. */
export async function inboxAction(): Promise<InboxItem[]> {
  const address = await signedInAddress()
  if (!address) return []
  const rows = await ownerInbox(db(), address)
  const words = (p: Record<string, unknown>) =>
    [p.what, p.summary, p.text].find((v): v is string => typeof v === 'string' && v.length > 0) ?? ''
  return rows.map((r) => ({
    id: r.id,
    deskId: r.deskId,
    deskName: r.deskName ?? 'Your agent',
    kind: r.kind,
    text: words(r.payload),
    decisionSeq: r.decisionSeq,
    symbol: r.kind === 'price_alert' && typeof r.payload.symbol === 'string' ? r.payload.symbol : null,
    at: r.createdAt.toISOString(),
    read: r.readAt !== null,
  }))
}

export async function markInboxReadAction(): Promise<void> {
  const address = await signedInAddress()
  if (address) await markInboxRead(db(), address)
}
