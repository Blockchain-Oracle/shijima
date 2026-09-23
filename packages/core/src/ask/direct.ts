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
  symbol: null,
  alertDirection: null,
  thresholdBps: null,
  rules: null,
}

/**
 * What a button may ask for. Anything that needs the model's judgement, like "do it anyway", stays in the chat.
 * The mandate kinds are here too, so the settings can be edited with no model call at all (brief 8.9, 8.14).
 */
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
  'switch_strategy',
  'set_weights',
  'set_limits',
  'set_notes',
  'set_rules',
] as const satisfies readonly ProposalKind[]
export type ButtonKind = (typeof BUTTON_KINDS)[number]

export type DirectOutcome = { ok: true; proposalId: string; requestId: string } | { ok: false; why: string }

/**
 * A form's fields are strings. This turns them into what the checks read, with the same shapes the chat's
 * model would give:
 *   presetId            "mag-seven"
 *   targets             "NVDA=4000,SPY=3000" (symbol=basis points, comma separated)
 *   cashBps             "3000"
 *   notes               the whole text
 *   driftToleranceBps, maxPositionBps, lossStopBps   whole numbers, as strings
 *   rules               "NVDA=300/5000,TSLA=500/2500" (symbol=fall basis points/cut basis points)
 * Anything empty or absent is null, which the checks read as "leave as it is" or "missing", kind by kind.
 */
export type DirectFields = Partial<Record<keyof Fields, string | number | null | undefined>>

const int = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) ? n : Number.NaN
}
const str = (v: string | number | null | undefined): string | null =>
  v === null || v === undefined || v === '' ? null : String(v)

export function decodeFields(fields: DirectFields): Fields {
  const targets = str(fields.targets)
  const rules = str(fields.rules)
  return {
    ...NONE,
    presetId: str(fields.presetId),
    targets: targets
      ? targets.split(',').map((pair) => {
          const [symbol = '', bps = ''] = pair.split('=')
          return { symbol: symbol.trim().toUpperCase(), weightBps: int(bps.trim()) ?? Number.NaN }
        })
      : null,
    cashBps: int(fields.cashBps),
    notes: fields.notes === undefined ? null : String(fields.notes ?? ''),
    driftToleranceBps: int(fields.driftToleranceBps),
    maxPositionBps: int(fields.maxPositionBps),
    lossStopBps: int(fields.lossStopBps),
    mode: str(fields.mode) as Fields['mode'],
    amountUsdg: str(fields.amountUsdg),
    withdrawAs: str(fields.withdrawAs) as Fields['withdrawAs'],
    perActionCapUsdg: str(fields.perActionCapUsdg),
    dailyCapUsdg: str(fields.dailyCapUsdg),
    symbol: str(fields.symbol),
    alertDirection: str(fields.alertDirection) as Fields['alertDirection'],
    thresholdBps: int(fields.thresholdBps),
    rules:
      rules === null
        ? null
        : rules.trim() === ''
          ? []
          : rules.split(',').map((item) => {
              const [symbol = '', rest = ''] = item.split('=')
              const [fall = '', cut = ''] = rest.split('/')
              return {
                symbol: symbol.trim().toUpperCase(),
                fallBps: int(fall.trim()) ?? Number.NaN,
                cutBps: int(cut.trim()) ?? Number.NaN,
              }
            }),
  }
}

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
    fields?: DirectFields
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
  if (!context.facts) return { ok: false, why: 'Start an agent first.' }

  const decoded = decodeFields(input.fields ?? {})
  // A number that did not parse must never reach a check as NaN.
  for (const [key, value] of Object.entries(decoded)) {
    if (typeof value === 'number' && Number.isNaN(value))
      return { ok: false, why: `${key} is not a whole number.` }
    if (
      Array.isArray(value) &&
      value.some((v) => Object.values(v).some((x) => typeof x === 'number' && Number.isNaN(x)))
    )
      return { ok: false, why: `${key} has a number that could not be read.` }
  }
  const check = checkProposal({ ...decoded, kind: input.kind }, context.facts, approved)
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
