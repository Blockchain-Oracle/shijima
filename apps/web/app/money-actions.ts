'use server'

import { ensureOwner, ownsDesk } from '@desk/db'
import { errorText, moneyCopy } from '@desk/shared'
import { isAddress } from 'viem'
import { db } from '@/lib/db'
import { finishMove, recordStep } from '@/lib/money/finish.server'
import { planMove } from '@/lib/money/plan.server'
import type { MoveInput, MoveOutcome, MoveSource, PlanResult } from '@/lib/money/types'
import { signedInAddress } from '@/lib/session'

/**
 * Money moves from the screens: plan, report each signed step, finish. None of them signs or sends; the owner's
 * wallet does, in the browser. Every one checks the SIGNED-IN wallet on the server: a move id or an agent id from
 * the browser proves nothing, and a move belongs to the wallet that planned it.
 */

const raw = (v: unknown): v is string => typeof v === 'string' && /^\d{1,78}$/.test(v)
const chainId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0
const address = (v: unknown): v is `0x${string}` => typeof v === 'string' && isAddress(v, { strict: false })
const source = (v: unknown): v is MoveSource => {
  const s = v as MoveSource | null
  return !!s && chainId(s.chainId) && address(s.token) && raw(s.amountRaw)
}

/** The input exactly as the planner reads it, or null. Nothing from the browser reaches the planner unchecked. */
function checked(input: MoveInput): MoveInput | null {
  switch (input?.kind) {
    case 'fund':
      return typeof input.deskId === 'string' && source(input.source)
        ? { kind: 'fund', deskId: input.deskId, source: input.source }
        : null
    case 'send':
      return source(input.source) && address(input.recipient)
        ? { kind: 'send', source: input.source, recipient: input.recipient }
        : null
    case 'bridge_out':
      return raw(input.amountRaw) && chainId(input.to?.chainId) && address(input.to?.token)
        ? {
            kind: 'bridge_out',
            amountRaw: input.amountRaw,
            to: { chainId: input.to.chainId, token: input.to.token },
          }
        : null
    case 'get_gas':
      if (input.amountUsdg !== undefined && !raw(input.amountUsdg)) return null
      if (input.origin !== undefined && !source(input.origin)) return null
      return {
        kind: 'get_gas',
        ...(input.amountUsdg ? { amountUsdg: input.amountUsdg } : {}),
        ...(input.origin ? { origin: input.origin } : {}),
      }
    default:
      return null
  }
}

/**
 * Plans a move and saves it as waiting for the wallet. `replaces` is the plan whose 60 seconds ran out: a fresh
 * price is fetched and the old plan is closed as nothing sent.
 */
export async function planMoveAction(input: MoveInput, replaces?: string): Promise<PlanResult> {
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, why: moneyCopy.refusals.signIn }
    const clean = checked(input)
    if (!clean) return { ok: false, why: moneyCopy.refusals.amount }
    if (clean.kind === 'fund' && !(await ownsDesk(db(), clean.deskId, owner)))
      return { ok: false, why: moneyCopy.refusals.notYourAgent }
    const { id: ownerId } = await ensureOwner(db(), owner)
    return await planMove({ address: owner, ownerId }, clean, replaces)
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

/** The browser sent one step: its hash is kept at once, before the receipt, so the money can always be traced. */
export async function stepSentAction(moveId: string, hash: string): Promise<{ ok: boolean }> {
  const owner = await signedInAddress()
  if (!owner) return { ok: false }
  return { ok: await recordStep(owner, moveId, hash).catch(() => false) }
}

/**
 * The chain's verdict on a move: one of the five endings, in dollars, with explorer links. Call it again while
 * the outcome is `open` (on its way through Relay, or not yet readable): it checks again each time.
 */
export async function finishMoveAction(moveId: string, note?: string): Promise<MoveOutcome | null> {
  const owner = await signedInAddress()
  if (!owner) return null
  try {
    return await finishMove(owner, moveId, note?.slice(0, 300))
  } catch {
    return null
  }
}
