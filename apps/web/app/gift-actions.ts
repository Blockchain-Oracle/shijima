'use server'

import { createHash } from 'node:crypto'
import { EXPLORER } from '@desk/chain'
import { GIFT_CAP_DEFAULT, type GiftRow, giftOfWallet, giftsClaimed, queueGift } from '@desk/db'
import { errorText, giftCopy } from '@desk/shared'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

/**
 * The free $1 (PLAN-ROUND-3 D3). The website stays keyless: a claim writes one `queued` row for the signed-in
 * wallet and nothing else. The worker holds the gift key and sends it. The wallet always comes from the session,
 * never from the request, so nobody can claim for an address they did not sign in with.
 */

export type GiftState =
  | { state: 'signed_out' | 'eligible' | 'all_gone'; left: number; line: string }
  | {
      state: 'queued' | 'sending' | 'sent' | 'failed'
      left: number
      line: string
      /** The worker's note on a waiting claim, such as the sender being off. */
      note: string | null
      usdgTx: string | null
      ethTx: string | null
    }

export type GiftClaimResult = { ok: true; gift: GiftState } | { ok: false; why: string; gift: GiftState }

const cap = () => {
  const n = Number(process.env.GIFT_CAP ?? GIFT_CAP_DEFAULT)
  return Number.isInteger(n) && n >= 0 ? n : GIFT_CAP_DEFAULT
}

const txLink = (hash: string | null) => (hash ? `${EXPLORER}/tx/${hash}` : null)

function stateOf(row: GiftRow | undefined, left: number): GiftState {
  if (!row)
    return left > 0
      ? { state: 'eligible', left, line: giftCopy.states.eligible }
      : { state: 'all_gone', left: 0, line: giftCopy.states.allGone }
  return {
    state: row.status,
    left,
    line: giftCopy.states[row.status],
    note: row.status === 'queued' || row.status === 'failed' ? row.error : null,
    usdgTx: txLink(row.usdgTx),
    ethTx: txLink(row.ethTx),
  }
}

/** Salted with the session secret, so the stored hash cannot be matched against a list of addresses. */
async function ipHash(): Promise<string> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown'
  return createHash('sha256')
    .update(`${process.env.SESSION_SECRET ?? ''}:gift:${ip}`)
    .digest('hex')
}

/** What the gift card should show for whoever is looking. */
export async function giftStateAction(): Promise<GiftState> {
  const left = Math.max(0, cap() - (await giftsClaimed(db())))
  const wallet = await signedInAddress()
  if (!wallet) return { state: 'signed_out', left, line: giftCopy.states.signedOut }
  return stateOf(await giftOfWallet(db(), wallet), left)
}

/** Claims the $1 for the signed-in wallet: one per wallet, one per connection a day, and only while any are left. */
export async function claimGiftAction(): Promise<GiftClaimResult> {
  try {
    const wallet = await signedInAddress()
    if (!wallet) {
      return { ok: false, why: giftCopy.states.signedOut, gift: await giftStateAction() }
    }
    const queued = await queueGift(db(), { wallet, ipHash: await ipHash(), cap: cap() })
    const left = Math.max(0, cap() - (await giftsClaimed(db())))
    if (queued.ok) return { ok: true, gift: stateOf(queued.row, left) }
    const why =
      queued.reason === 'already'
        ? giftCopy.states.already
        : queued.reason === 'ip_today'
          ? giftCopy.states.ipToday
          : giftCopy.states.allGone
    return { ok: false, why, gift: stateOf(queued.row ?? (await giftOfWallet(db(), wallet)), left) }
  } catch (e) {
    const gift = await giftStateAction().catch(
      (): GiftState => ({ state: 'eligible', left: 0, line: giftCopy.states.eligible }),
    )
    return { ok: false, why: giftCopy.unavailable(errorText(e)), gift }
  }
}
