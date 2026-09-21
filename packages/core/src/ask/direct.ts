/**
 * A card made from a button instead of a message. The owner pressed "Withdraw" and typed $20: the same
 * plain-code checks run and the same card is saved, so a button and the chat can never disagree about what is
 * allowed. No model call is made, so the buttons keep working when the chat cannot.
 *
 * The exchange is written into the chat thread already answered, in the owner's words and the desk's, so the
 * thread stays the one history of everything asked for.
 */
import type { ApprovedToken } from '@desk/chain'
import { createAnsweredRequest, type Db, saveProposal } from '@desk/db'
import { deskCopy } from '@desk/shared'
import { PROPOSAL_TTL_MS } from './answer'
import { loadAskContext } from './context'
import { type AskReply, checkProposal, type ProposalKind } from './proposal'

type Fields = Omit<NonNullable<AskReply['proposal']>, 'kind'>

const NONE: Fields = {
  presetId: null,
  targets: null,
  cashBps: null,
  notes: null,
  driftToleranceBps: null,
  maxPositionBps: null,
  lossStopBps: null,
  mode: null,
  approvalId: null,
  answer: null,
  decisionId: null,
  amountUsdg: null,
  withdrawAs: null,
  perActionCapUsdg: null,
  dailyCapUsdg: null,
}

/** What a button may ask for. Anything that needs the model's judgement, like "do it anyway", stays in the chat. */
export const BUTTON_KINDS = [
  'add_money',
  'withdraw',
  'sell_everything',
  'pause',
  'resume',
  'set_mode',
  'set_chain_limits',
  'remove_assistant',
  'unpause',
  'close_desk',
  'check_now',
] as const satisfies readonly ProposalKind[]
export type ButtonKind = (typeof BUTTON_KINDS)[number]

export type DirectOutcome = { ok: true; proposalId: string; requestId: string } | { ok: false; why: string }

export async function proposeDirect(
  db: Db,
  approved: ApprovedToken[],
  input: {
    deskId: string
    ownerAddress: string
    via: 'web' | 'telegram'
    /** The owner's request in words, as the thread shows it: "Withdraw $20". */
    words: string
    kind: ButtonKind
    fields?: Partial<Fields>
    now?: Date
  },
): Promise<DirectOutcome> {
  const now = input.now ?? new Date()
  if (!(BUTTON_KINDS as readonly string[]).includes(input.kind))
    return { ok: false, why: 'That is not something a button can do.' }
  const context = await loadAskContext(db, {
    deskId: input.deskId,
    ownerAddress: input.ownerAddress,
    question: input.words,
    approved,
    now,
  })
  if ('refused' in context) return { ok: false, why: context.refused }
  if (!context.facts) return { ok: false, why: 'Start a desk first.' }

  const check = checkProposal({ ...NONE, ...input.fields, kind: input.kind }, context.facts, approved)
  if (!check.ok) return { ok: false, why: check.why }

  const reply = deskCopy.chat.fromButton
  const requestId = await createAnsweredRequest(db, {
    ownerAddress: input.ownerAddress,
    deskId: input.deskId,
    via: input.via,
    question: input.words,
    reply: { reply, cites: [], chart: null, proposalId: null, refused: null, promptVersion: null },
  })
  const proposalId = await saveProposal(db, {
    requestId,
    deskId: input.deskId,
    ownerAddress: input.ownerAddress,
    kind: check.proposal.kind,
    args: check.proposal.args,
    deskView: { card: check.proposal.card, readBack: reply, quote: null, source: 'button' },
    path: check.proposal.path,
    expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
  })
  return { ok: true, proposalId, requestId }
}
