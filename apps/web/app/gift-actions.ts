'use server'

import { createHash } from 'node:crypto'
import { EXPLORER, USDG } from '@desk/chain'
import {
  GIFT_ETH_WEI,
  GIFT_USDG,
  type GiftRow,
  giftOfWallet,
  giftsClaimed,
  giftsOwed,
  queueGift,
} from '@desk/db'
import { errorText, giftCopy } from '@desk/shared'
import { headers } from 'next/headers'
import { type Address, erc20Abi } from 'viem'
import { pub } from '@/lib/chain-build.server'
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

/** Gas the gift wallet spends sending one gift (two transfers), on top of the ETH it gives away. */
const SEND_GAS_WEI = 20_000_000_000_000n

/**
 * How many more gifts the gift wallet can pay right now: its USDG and its ETH, read from the chain, less what the
 * claims still waiting will take. No fixed number: top the wallet up and the offer carries on (25 Sep, Abu).
 */
async function giftsLeft(): Promise<number> {
  const wallet = process.env.GIFT_ADDRESS as Address | undefined
  if (!wallet) return 0
  const [usdg, eth, owed] = await Promise.all([
    pub().readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    pub().getBalance({ address: wallet }),
    giftsOwed(db()),
  ])
  const byUsdg = Number(usdg / GIFT_USDG)
  const byEth = Number(eth / (GIFT_ETH_WEI + SEND_GAS_WEI))
  return Math.max(0, Math.min(byUsdg, byEth) - owed)
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
  const left = await giftsLeft().catch(() => 0)
  const wallet = await signedInAddress()
  if (!wallet) return { state: 'signed_out', left, line: giftCopy.states.signedOut }
  return stateOf(await giftOfWallet(db(), wallet), left)
}

/** Claims the $1 for the signed-in wallet: one per wallet, one per connection ever, and only while the wallet can pay. */
export async function claimGiftAction(): Promise<GiftClaimResult> {
  try {
    const wallet = await signedInAddress()
    if (!wallet) {
      return { ok: false, why: giftCopy.states.signedOut, gift: await giftStateAction() }
    }
    const before = await giftsLeft()
    // queueGift counts every claim on file against its cap, so the cap is those plus what the wallet can still pay.
    const queued = await queueGift(db(), {
      wallet,
      ipHash: await ipHash(),
      cap: (await giftsClaimed(db())) + before,
    })
    const left = await giftsLeft().catch(() => 0)
    if (queued.ok) return { ok: true, gift: stateOf(queued.row, left) }
    const why =
      queued.reason === 'already'
        ? giftCopy.states.already
        : queued.reason === 'ip_used'
          ? giftCopy.states.ipUsed
          : giftCopy.states.allGone
    return { ok: false, why, gift: stateOf(queued.row ?? (await giftOfWallet(db(), wallet)), left) }
  } catch (e) {
    const gift = await giftStateAction().catch(
      (): GiftState => ({ state: 'eligible', left: 0, line: giftCopy.states.eligible }),
    )
    return { ok: false, why: giftCopy.unavailable(errorText(e)), gift }
  }
}
