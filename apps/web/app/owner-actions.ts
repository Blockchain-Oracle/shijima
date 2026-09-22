'use server'

import { randomBytes } from 'node:crypto'
import { APPROVED_TOKENS } from '@desk/chain'
import { BUTTON_KINDS, type ButtonKind, proposeDirect } from '@desk/core'
import {
  acceptDisclosure,
  createTelegramLink,
  deskById,
  ensureOwner,
  markInboxRead,
  ownerInbox,
  ownsDesk,
  proposalForOwner,
  setDeskShare,
  telegramForDesk,
  unlinkTelegram,
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
    if (!owner) return { ok: false, why: 'That is not your desk.' }
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

export async function telegramStateAction(deskId: string) {
  if (!(await ownerOf(deskId))) return null
  const t = await telegramForDesk(db(), deskId)
  return {
    linked: t.linked ? { username: t.linked.username } : null,
    pending: t.pending ? { code: t.pending.code, expiresAt: t.pending.codeExpiresAt.toISOString() } : null,
  }
}

/** A one-time code for the bot: works once, for ten minutes. A code still waiting is handed back, not replaced. */
export async function telegramCodeAction(
  deskId: string,
): Promise<{ ok: true; code: string } | { ok: false; why: string }> {
  try {
    if (!(await ownerOf(deskId))) return { ok: false, why: 'That is not your desk.' }
    const t = await telegramForDesk(db(), deskId)
    if (t.linked) return { ok: false, why: 'This desk is already connected.' }
    if (t.pending) return { ok: true, code: t.pending.code }
    const code = randomBytes(4).toString('hex')
    await createTelegramLink(db(), deskId, code)
    return { ok: true, code }
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

export async function telegramUnlinkAction(deskId: string): Promise<{ ok: boolean }> {
  if (!(await ownerOf(deskId))) return { ok: false }
  const done = await unlinkTelegram(db(), deskId, { actor: 'owner', via: 'web' })
  revalidatePath(`/desk/${deskId}/settings`)
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
  revalidatePath(`/desk/${deskId}/settings`)
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
    deskName: r.deskName ?? 'Your desk',
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
