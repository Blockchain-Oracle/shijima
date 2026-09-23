'use server'

import { APPROVED_TOKENS } from '@desk/chain'
import { confirmSigninProposal } from '@desk/core'
import { answerApproval, ownerIdOf, ownsDesk, pauseDesk, pendingApprovals, resumeDesk } from '@desk/db'
import { errorText } from '@desk/shared'
import { revalidatePath } from 'next/cache'
import {
  abandonChainProposal,
  finishChainProposal,
  type Prepared,
  prepareChainProposal,
} from '@/lib/chain-proposals.server'
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
    revalidatePath('/agents')
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
    revalidatePath('/agents')
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
    revalidatePath('/agents')
    return { ok: outcome.ok, message: outcome.text }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}

/** Takes a chain card and returns the one transaction it describes, for the owner's key or wallet to sign. */
export async function prepareChainProposalAction(proposalId: string): Promise<Prepared> {
  const address = await signedInAddress()
  if (!address) return { ok: false, why: 'Sign in first.' }
  try {
    return await prepareChainProposal(proposalId, address)
  } catch (e) {
    return { ok: false, why: errorText(e) }
  }
}

/** The transaction landed, says the browser. The server checks the chain before it believes it. */
export async function finishChainProposalAction(proposalId: string, txHash: string): Promise<ActionResult> {
  const address = await signedInAddress()
  if (!address) return { ok: false, message: 'Sign in first.' }
  try {
    const done = await finishChainProposal(proposalId, address, txHash)
    revalidatePath('/agents')
    return { ok: done.ok, message: done.text }
  } catch (e) {
    return { ok: false, message: errorText(e) }
  }
}

export async function abandonChainProposalAction(proposalId: string, why: string): Promise<void> {
  const address = await signedInAddress()
  if (address) await abandonChainProposal(proposalId, address, why)
}
