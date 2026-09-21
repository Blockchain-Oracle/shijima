'use server'

import { APPROVED_TOKENS, isCloneOf, makePublicClient, readDeskState } from '@desk/chain'
import { confirmSigninProposal } from '@desk/core'
import {
  answerApproval,
  applyMandate,
  ownerIdOf,
  ownsDesk,
  pauseDesk,
  pendingApprovals,
  registerDesk,
  resumeDesk,
  startDesk,
} from '@desk/db'
import { checkMandate, DEFAULT_LIMITS, errorText, Mandate } from '@desk/shared'
import { revalidatePath } from 'next/cache'
import { parseUnits, zeroHash } from 'viem'
import { currentDeployment, rpcUrl } from '@/lib/chain'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

/**
 * The only things the website writes.
 *
 * None of them moves money. Answering a request records an answer; the worker re-reads the price on its next
 * check and acts only if it is still close to what the owner was shown. Pausing is instant and free.
 *
 * Every one checks ownership against the SIGNED-IN session, server side, before touching a row. A desk id in
 * a form field proves nothing.
 */
export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

async function asOwner(deskId: string): Promise<{ address: string; ownerId: string } | undefined> {
  const address = await signedInAddress()
  if (!address) return undefined
  if (!(await ownsDesk(db(), deskId, address))) return undefined
  const ownerId = await ownerIdOf(db(), address)
  return ownerId ? { address, ownerId } : undefined
}

export async function answerApprovalAction(formData: FormData): Promise<ActionResult> {
  const deskId = String(formData.get('deskId') ?? '')
  const approvalId = String(formData.get('approvalId') ?? '')
  const answer = formData.get('answer') === 'approve' ? 'approved' : 'rejected'
  try {
    const owner = await asOwner(deskId)
    if (!owner) return { ok: false, message: 'That is not your desk.' }
    // The request must still belong to this desk. An id from elsewhere is not enough.
    const waiting = await pendingApprovals(db(), deskId)
    if (!waiting.some((a) => a.id === approvalId)) {
      return {
        ok: false,
        message: 'That request is no longer waiting: it expired, or it was already answered.',
      }
    }
    const row = await answerApproval(db(), { approvalId, answer, ownerId: owner.ownerId, via: 'web' })
    revalidatePath('/desks')
    return row
      ? {
          ok: true,
          message:
            answer === 'approved'
              ? 'Approved. The desk will re-read the price on its next check and act only if it is still close to what you were shown.'
              : 'Rejected. Nothing will be done, and the refusal is recorded.',
        }
      : { ok: false, message: 'That request is no longer waiting: it expired, or it was already answered.' }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}

export async function pauseAction(formData: FormData): Promise<ActionResult> {
  const deskId = String(formData.get('deskId') ?? '')
  const resume = formData.get('resume') === 'true'
  try {
    const owner = await asOwner(deskId)
    if (!owner) return { ok: false, message: 'That is not your desk.' }
    const by = { actor: 'owner', via: 'web' } as const
    const done = resume ? await resumeDesk(db(), deskId, by) : await pauseDesk(db(), deskId, by)
    revalidatePath('/desks')
    if (!done) return { ok: false, message: 'Nothing changed: the desk was already in that state.' }
    return {
      ok: true,
      message: resume
        ? 'The desk is active again.'
        : 'The desk is paused. Nothing will happen until you resume it. Nothing was sold.',
    }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}

/**
 * Records a desk the owner has just created on-chain, so the worker will look after it.
 *
 * Nothing is trusted from the browser. The address is read back from the chain and must be a real clone of
 * our own Desk implementation, owned by the signed-in wallet, with our operator set. A desk that fails any of
 * those is not ours to touch and is refused.
 */
export async function registerDeskAction(formData: FormData): Promise<ActionResult> {
  const address = String(formData.get('address') ?? '').toLowerCase()
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, message: 'Sign in first.' }
    if (!/^0x[0-9a-f]{40}$/.test(address)) return { ok: false, message: 'That is not an address.' }

    const deployment = currentDeployment()
    const pub = makePublicClient([rpcUrl()])
    if (!(await isCloneOf(pub, address as `0x${string}`, deployment.implementation))) {
      return { ok: false, message: 'There is no desk of ours at that address.' }
    }
    const state = await readDeskState(pub, address as `0x${string}`)
    if (state.owner.toLowerCase() !== owner) {
      return { ok: false, message: 'That desk belongs to a different wallet.' }
    }
    if (state.operator.toLowerCase() !== deployment.operator.toLowerCase()) {
      return { ok: false, message: 'That desk does not have our assistant set as its operator.' }
    }

    await registerDesk(db(), {
      ownerAddress: owner,
      deskAddress: address,
      factory: deployment.factory,
      salt: zeroHash,
      contractVersion: deployment.version,
      operator: state.operator,
      name: 'Your desk',
    })
    revalidatePath('/desks')
    return { ok: true, message: 'Your desk is recorded. Set your mandate next.' }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}

/** Applies a mandate the owner has written, after checking it holds together. */
export async function applyMandateAction(formData: FormData): Promise<ActionResult> {
  const deskId = String(formData.get('deskId') ?? '')
  try {
    if (!(await asOwner(deskId))) return { ok: false, message: 'That is not your desk.' }

    const weights = JSON.parse(String(formData.get('weights') ?? '{}')) as Record<string, number>
    const tokens = Object.entries(weights)
      .filter(([, bps]) => bps > 0)
      .map(([symbol, weightBps]) => {
        const token = APPROVED_TOKENS.find((t) => t.symbol === symbol)
        if (!token) throw new Error(`${symbol} is not on the approved list`)
        return { token: token.address, weightBps }
      })
    const mandate = Mandate.parse({
      preset: (formData.get('preset') as string) || null,
      targets: { cashBps: Number(formData.get('cashBps') ?? 0), tokens },
      driftToleranceBps: Number(formData.get('driftToleranceBps') ?? DEFAULT_LIMITS.driftToleranceBps),
      maxPositionBps: Number(formData.get('maxPositionBps') ?? DEFAULT_LIMITS.maxPositionBps),
      lossStopBps: Number(formData.get('lossStopBps') ?? DEFAULT_LIMITS.lossStopBps),
      perActionCapUsdg: parseUnits(String(formData.get('perActionCap') ?? '5'), 6),
      dailyCapUsdg: parseUnits(String(formData.get('dailyCap') ?? '15'), 6),
      largeActionUsdg: parseUnits(String(formData.get('largeAction') ?? '100'), 6),
      notes: String(formData.get('notes') ?? ''),
    })
    const problems = checkMandate(mandate, APPROVED_TOKENS)
    if (problems.length > 0) return { ok: false, message: problems.join('. ') }

    const row = await applyMandate(db(), deskId, mandate, { actor: 'owner', via: 'web' })
    await startDesk(db(), deskId)
    revalidatePath('/desks')
    return {
      ok: true,
      message: `Saved as version ${row.version}. The desk starts in practice mode: it decides for real and spends nothing.`,
    }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}

/**
 * The owner's yes to a chat card the sign-in session may confirm. Only the proposal the worker saved runs, and
 * only if it is this owner's, still open and not expired. The model's words are never re-read here.
 */
export async function confirmProposalAction(proposalId: string): Promise<ActionResult> {
  try {
    const address = await signedInAddress()
    if (!address) return { ok: false, message: 'Sign in first.' }
    const outcome = await confirmSigninProposal(db(), APPROVED_TOKENS, {
      proposalId,
      ownerAddress: address,
      via: 'web',
    })
    revalidatePath('/desks')
    return { ok: outcome.ok, message: outcome.text }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}
