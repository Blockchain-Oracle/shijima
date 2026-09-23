/**
 * The owner's yes to a card that the sign-in session may confirm. Called by the website's server action and by
 * the Telegram bot's button, never by the model.
 *
 * Only the saved proposal runs, and only through the guarded queries the website and Telegram already use.
 * Each of them re-checks the desk as it is at this moment, so a card confirmed after something changed is
 * refused in words, never half carried out.
 */

import type { ApprovedToken } from '@desk/chain'
import {
  answerApproval,
  applyMandate,
  currentMandate,
  type Db,
  deskById,
  finishProposal,
  GO_LIVE_CHECKS,
  overrideWait,
  ownerIdOf,
  pauseDesk,
  requestCheck,
  resumeDesk,
  setDeskMode,
  takeProposal,
} from '@desk/db'
import { alertsCopy, checkMandate, errorText } from '@desk/shared'
import { setPriceAlert } from '../alerts'
import { ASK_PROMPT_VERSION } from './prompts'
import { mandateFromArgs, type ProposalKind } from './proposal'

export type ConfirmOutcome = { ok: true; text: string } | { ok: false; text: string }

const CHECK_REFUSED = {
  pending: 'A check is already on its way.',
  cooldown: 'The agent checked a few minutes ago. Ask again in ten minutes.',
  not_running: 'The agent is not running, so it cannot check now.',
} as const

export async function confirmSigninProposal(
  db: Db,
  approved: ApprovedToken[],
  input: { proposalId: string; ownerAddress: string; via: 'web' | 'telegram'; now?: Date },
): Promise<ConfirmOutcome> {
  const now = input.now ?? new Date()
  const proposal = await takeProposal(db, {
    id: input.proposalId,
    ownerAddress: input.ownerAddress,
    path: 'signin',
    now,
  })
  if (!proposal) return { ok: false, text: 'This card has expired or was already used. Ask me again.' }

  const finish = async (outcome: ConfirmOutcome) => {
    await finishProposal(db, proposal.id, {
      status: outcome.ok ? 'done' : 'refused',
      result: { text: outcome.text },
    })
    return outcome
  }

  try {
    const desk = proposal.deskId ? await deskById(db, proposal.deskId) : undefined
    if (!desk || desk.ownerAddress.toLowerCase() !== input.ownerAddress.toLowerCase()) {
      return finish({ ok: false, text: 'That agent is not yours.' })
    }
    const by = { actor: 'owner', via: 'chat' } as const
    const args = proposal.args
    const kind = proposal.kind as ProposalKind

    switch (kind) {
      case 'switch_strategy':
      case 'set_weights':
      case 'set_notes':
      case 'set_limits':
      case 'set_rules': {
        const current = await currentMandate(db, desk.id)
        if (!current || current.version !== args.baseVersion) {
          return finish({ ok: false, text: 'Your settings changed since I suggested this. Ask me again.' })
        }
        const mandate = mandateFromArgs(args)
        const problems = checkMandate(mandate, approved)
        if (problems.length > 0) return finish({ ok: false, text: problems.join(' ') })
        const readBack = proposal.deskView.readBack
        const row = await applyMandate(db, desk.id, mandate, by, {
          text: typeof readBack === 'string' ? readBack : '',
          promptVersion: ASK_PROMPT_VERSION,
          confirmedAt: now.toISOString(),
          proposalId: proposal.id,
        })
        return finish({
          ok: true,
          text: `Done. Your new settings are in force (version ${row.version}). The agent moves toward them at its next checks, inside your limits.`,
        })
      }
      case 'pause':
        return finish(
          (await pauseDesk(db, desk.id, by))
            ? {
                ok: true,
                text: 'Paused. Nothing was sold. Waiting requests and remembered waits were cancelled.',
              }
            : { ok: false, text: 'The agent was not active, so nothing changed.' },
        )
      case 'resume':
        return finish(
          (await resumeDesk(db, desk.id, by))
            ? { ok: true, text: 'Resumed. The agent carries on from its next check.' }
            : { ok: false, text: 'The agent was not paused by you, so nothing changed.' },
        )
      case 'set_mode': {
        const mode = args.mode as 'shadow' | 'ask_first' | 'on_its_own'
        const change = await setDeskMode(db, desk.id, mode, by)
        if (!change.ok) {
          return finish({
            ok: false,
            text:
              change.reason === 'practice_checks'
                ? `Not yet. Going live needs ${GO_LIVE_CHECKS} practice checks, and this agent has done ${change.checksDone}.`
                : 'Not yet. Going live needs you to read the practice report first.',
          })
        }
        return finish({
          ok: true,
          text: change.changed ? 'Done. The mode has changed.' : 'The agent was already in that mode.',
        })
      }
      case 'answer_approval': {
        const ownerId = await ownerIdOf(db, input.ownerAddress)
        if (!ownerId) return finish({ ok: false, text: 'I could not find you as an owner.' })
        const answer = args.answer === 'approve' ? 'approved' : 'rejected'
        const row = await answerApproval(db, {
          approvalId: String(args.approvalId),
          answer,
          ownerId,
          via: 'chat',
          now,
        })
        if (!row) return finish({ ok: false, text: 'That request was already answered or has lapsed.' })
        if (answer === 'rejected') return finish({ ok: true, text: 'Rejected. Nothing will be done.' })
        // An approval is perishable, so the desk carries it out now rather than at the next hourly check.
        await requestCheck(
          db,
          { deskId: desk.id, requestedBy: input.ownerAddress, via: 'chat', proposalId: proposal.id },
          now,
        )
        return finish({
          ok: true,
          text: 'Approved. The agent checks the price again and acts within a minute if it still holds.',
        })
      }
      case 'check_now': {
        const request = await requestCheck(
          db,
          { deskId: desk.id, requestedBy: input.ownerAddress, via: 'chat' },
          now,
        )
        return finish(
          request.ok
            ? {
                ok: true,
                text: 'The agent is checking now. Its answer appears in the record in a minute or so.',
              }
            : { ok: false, text: CHECK_REFUSED[request.reason] },
        )
      }
      case 'do_it_anyway': {
        const ownerId = await ownerIdOf(db, input.ownerAddress)
        const quote = proposal.deskView.quote as { amountIn: string; expectedOut: string } | null
        if (!ownerId || !quote)
          return finish({ ok: false, text: 'I could not find what you were shown. Ask me again.' })
        const done = await overrideWait(db, {
          deskId: desk.id,
          deferralId: String(args.deferralId),
          decisionId: String(args.decisionId),
          ownerId,
          quote,
          now,
        })
        if (!done.ok) {
          return finish({
            ok: false,
            text:
              done.reason === 'practice'
                ? 'In practice mode the agent spends nothing, even on your word.'
                : done.reason === 'not_active'
                  ? 'The agent is not active, so it cannot act now.'
                  : 'That wait has already ended. Ask me what the agent is doing now.',
          })
        }
        await requestCheck(
          db,
          { deskId: desk.id, requestedBy: input.ownerAddress, via: 'chat', proposalId: proposal.id },
          now,
        )
        return finish({
          ok: true,
          text: 'Done. The agent acts on your call within a minute, if the price is still within half a percent of what you saw and every limit holds.',
        })
      }
      case 'price_alert': {
        const set = await setPriceAlert(db, approved, {
          ownerAddress: input.ownerAddress,
          deskId: desk.id,
          symbol: String(args.symbol),
          direction: String(args.direction),
          thresholdBps: Number(args.thresholdBps),
        })
        return finish(set.ok ? { ok: true, text: alertsCopy.saved } : { ok: false, text: set.why })
      }
      default:
        return finish({ ok: false, text: 'That one needs your wallet or your session key, not a tap here.' })
    }
  } catch (e) {
    await finishProposal(db, proposal.id, { status: 'failed', result: { error: errorText(e) } })
    return { ok: false, text: 'Something went wrong, and nothing was changed.' }
  }
}
