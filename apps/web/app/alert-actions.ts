'use server'

import { APPROVED_TOKENS } from '@desk/chain'
import { setPriceAlert } from '@desk/core'
import { cancelPriceAlert, desksOfOwner } from '@desk/db'
import { alertsCopy, errorText } from '@desk/shared'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export type AlertResult = { ok: true } | { ok: false; why: string }

/**
 * Sets a price alert from a stock's page. The signed-in wallet is read on the server, and the alert goes to that
 * owner's own desk, whose Telegram and bell deliver it. The checks are the chat card's own (`setPriceAlert`).
 */
export async function setAlertAction(input: {
  symbol: string
  direction: string
  percent: string
}): Promise<AlertResult> {
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, why: alertsCopy.signedOut }
    const [desk] = await desksOfOwner(db(), owner)
    if (!desk) return { ok: false, why: alertsCopy.noDesk }
    const percent = Number(input.percent.replace('%', '').trim())
    if (!Number.isFinite(percent)) return { ok: false, why: alertsCopy.refused.range }
    const set = await setPriceAlert(db(), APPROVED_TOKENS, {
      ownerAddress: owner,
      deskId: desk.id,
      symbol: input.symbol,
      direction: input.direction,
      thresholdBps: Math.round(percent * 100),
    })
    if (!set.ok) return set
    revalidatePath(`/stock/${input.symbol.toUpperCase()}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, why: `Nothing was saved: ${errorText(e)}` }
  }
}

/** Cancels one of the signed-in owner's own waiting alerts. */
export async function cancelAlertAction(input: { id: string; symbol: string }): Promise<AlertResult> {
  const owner = await signedInAddress()
  if (!owner) return { ok: false, why: alertsCopy.signedOut }
  if (!(await cancelPriceAlert(db(), owner, input.id))) return { ok: false, why: alertsCopy.refused.notYours }
  revalidatePath(`/stock/${input.symbol.toUpperCase()}`)
  return { ok: true }
}
