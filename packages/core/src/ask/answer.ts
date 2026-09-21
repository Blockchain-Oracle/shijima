/**
 * Answering one message. Runs in the worker, the only process that holds the SERV key.
 *
 *   1. load what the desk knows, from Postgres only, and refuse a desk that is not the sender's
 *   2. one servJson call with a strict schema
 *   3. plain-code checks: cites must name supplied facts, a chart must name a Stock Token, a proposal must pass
 *      checkProposal against the desk as it is now
 *   4. a proposal that passes is saved with an expiry; one that fails becomes a plain "I can't, because"
 *
 * Nothing here changes the desk. The owner's confirmation does that, later, and only from the saved proposal.
 */
import { type ApprovedToken, quotePinned } from '@desk/chain'
import {
  type AskRequestRow,
  type CHAT_PURPOSES,
  chatCallsSince,
  type Db,
  finishAskRequest,
  logServCall,
  saveProposal,
} from '@desk/db'
import { checkMandate, errorText, findHardBannedWords } from '@desk/shared'
import { formatUnits, type PublicClient, parseUnits } from 'viem'
import { z } from 'zod'
import { type ServResult, servJson } from '../serv/client'
import { TOKEN_DECIMALS, USDG_DECIMALS } from '../wake/types'
import { type AskContext, loadAskContext, mandateLines } from './context'
import { ASK_PROMPT_VERSION, ASK_PROMPTS, READBACK_PROMPT_VERSION, READBACK_PROMPTS } from './prompts'
import { AskReply, type CheckedProposal, checkProposal, mandateFromArgs } from './proposal'

/** A card can be confirmed for this long. After that the facts behind it are too old. */
export const PROPOSAL_TTL_MS = 10 * 60 * 1000
/** The chat's own daily allowance of SERV calls. The engine's checks are never counted against it. */
export const CHAT_DAILY_CALLS = 200
const ASK_MAX_TOKENS = 1200

export const ReadBack = z.object({
  /** The desk's restatement of the instructions, in its own words. */
  restatement: z.string(),
  /** Anything unclear, contradictory or likely to surprise. Empty when nothing is. */
  unclear: z.array(z.string()),
})
export type ReadBack = z.infer<typeof ReadBack>

export interface AskDeps {
  db: Db
  pub: PublicClient
  approved: ApprovedToken[]
  servApiKey: string
  dailyCalls?: number
  log?: (event: string, detail?: Record<string, unknown>) => void
}

/** What the browser and Telegram read back. Plain JSON, saved on the request row. */
export interface AskAnswer {
  reply: string
  cites: string[]
  chart: { symbol: string; days: number } | null
  proposalId: string | null
  /** Set when the desk would not offer what was asked, in words. */
  refused: string | null
  promptVersion: string | null
}

const plain = (reply: string, refused: string | null = null): AskAnswer => ({
  reply,
  cites: [],
  chart: null,
  proposalId: null,
  refused,
  promptVersion: null,
})

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function logCall(
  db: Db,
  deskId: string | null,
  result: ServResult<unknown>,
  rejectedByOurChecks: string[] = [],
): Promise<void> {
  await logServCall(db, {
    deskId,
    purpose: result.meta.purpose,
    promptVersion: result.meta.promptVersion,
    model: result.meta.model,
    mode: result.meta.mode,
    ok: result.ok,
    error: result.ok ? null : result.error,
    rejectedByOurChecks,
    latencyMs: result.meta.latencyMs,
    totalTokens: result.meta.totalTokens,
    finishReason: result.meta.finishReason,
  })
}

/** Answers one claimed message and writes the answer back. Never throws: a failure is written as one. */
export async function answerAskRequest(
  deps: AskDeps,
  request: AskRequestRow,
  now = new Date(),
): Promise<void> {
  try {
    const used = await chatCallsSince(deps.db, startOfUtcDay(now))
    if (used >= (deps.dailyCalls ?? CHAT_DAILY_CALLS)) {
      await finishAskRequest(deps.db, request.id, {
        reply: {
          ...plain(
            'I have used up today’s chat allowance, so I can’t answer until midnight UTC. Your desk keeps checking as usual.',
          ),
        },
      })
      return
    }
    const answer =
      request.kind === 'readback' ? await answerReadBack(deps, request) : await answerAsk(deps, request, now)
    await finishAskRequest(deps.db, request.id, { reply: { ...answer } })
  } catch (e) {
    deps.log?.('ask_failed', { request: request.id, error: errorText(e) })
    await finishAskRequest(deps.db, request.id, {
      error: 'I could not answer just now. Nothing was changed. Try again in a moment.',
    })
  }
}

async function answerAsk(deps: AskDeps, request: AskRequestRow, now: Date): Promise<AskAnswer> {
  const context = await loadAskContext(deps.db, {
    deskId: request.deskId,
    ownerAddress: request.ownerAddress,
    question: request.question,
    approved: deps.approved,
    now,
  })
  if ('refused' in context) return plain(context.refused, context.refused)

  const result = await servJson({
    apiKey: deps.servApiKey,
    purpose: 'ask' satisfies (typeof CHAT_PURPOSES)[number],
    promptVersion: ASK_PROMPT_VERSION,
    system: ASK_PROMPTS[ASK_PROMPT_VERSION],
    user: context.message,
    schema: AskReply,
    schemaName: 'desk_reply',
    maxTokens: ASK_MAX_TOKENS,
    shadowAgent: false,
    timeoutMs: 30_000,
  })
  if (!result.ok) {
    await logCall(deps.db, request.deskId, result)
    deps.log?.('ask_model_failed', { request: request.id, error: result.error })
    return plain('I could not think this through just now. Nothing was changed. Try again in a moment.')
  }

  const rejected: string[] = []
  const answer = await checkAnswer(deps, context, result.value, rejected)
  if (answer.proposal) {
    answer.reply.proposalId = await saveProposal(deps.db, {
      requestId: request.id,
      deskId: request.deskId,
      ownerAddress: request.ownerAddress,
      kind: answer.proposal.kind,
      args: answer.proposal.args,
      // What the owner is shown. A mandate change keeps the desk's own restatement: confirming saves it as
      // the mandate's read-back.
      deskView: { card: answer.proposal.card, readBack: result.value.reply, quote: answer.quote ?? null },
      path: answer.proposal.path,
      expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
    })
  }
  await logCall(deps.db, request.deskId, result, rejected)
  return answer.reply
}

/** The plain-code half of an answer. Everything the model said is checked; anything that fails is dropped. */
async function checkAnswer(
  deps: AskDeps,
  context: AskContext,
  value: AskReply,
  rejected: string[],
): Promise<{ reply: AskAnswer; proposal?: CheckedProposal; quote?: Record<string, string> }> {
  // The same rule as the engine: a promise of gain, or a name we may not use, makes the words unusable.
  const hard = findHardBannedWords(value.reply)
  if (hard.length > 0) {
    rejected.push(`hard banned words: ${hard.join(', ')}`)
    return { reply: plain('I put that badly, so I will not send it. Ask me again.') }
  }
  const cites = value.cites.filter((id) => context.ids.has(id))
  if (cites.length < value.cites.length) {
    rejected.push(
      `cited ids that were not supplied: ${value.cites.filter((id) => !context.ids.has(id)).join(', ')}`,
    )
  }
  let chart: AskAnswer['chart'] = null
  if (value.chart) {
    const token = deps.approved.find((t) => t.symbol === value.chart?.symbol.toUpperCase())
    if (token) chart = { symbol: token.symbol, days: Math.min(Math.max(value.chart.days, 1), 30) }
    else rejected.push(`a chart for ${value.chart.symbol}, which is not a Stock Token`)
  }
  const reply: AskAnswer = {
    reply: value.reply,
    cites,
    chart,
    proposalId: null,
    refused: null,
    promptVersion: ASK_PROMPT_VERSION,
  }
  if (!value.proposal) return { reply }
  if (!context.facts) {
    reply.refused = 'Start a desk first, and then I can change it for you.'
    rejected.push('a proposal with no desk')
    return { reply }
  }
  const check = checkProposal(value.proposal, context.facts, deps.approved)
  if (!check.ok) {
    reply.refused = check.why
    rejected.push(`proposal ${value.proposal.kind}: ${check.why}`)
    return { reply }
  }
  if (check.proposal.kind !== 'do_it_anyway') return { reply, proposal: check.proposal }

  // "Do it anyway" shows the owner a fresh price, and the desk is later held to within half a percent of it.
  const args = check.proposal.args as { token: string; side: 'buy' | 'sell'; amountIn: string }
  const token = deps.approved.find((t) => t.address.toLowerCase() === args.token.toLowerCase())
  if (!token) {
    reply.refused = 'That Stock Token is no longer one the desk can hold.'
    return { reply }
  }
  const [inDecimals, outDecimals] =
    args.side === 'buy' ? [USDG_DECIMALS, TOKEN_DECIMALS] : [TOKEN_DECIMALS, USDG_DECIMALS]
  const amountIn = parseUnits(args.amountIn, inDecimals)
  const out = await quotePinned(deps.pub, token, args.side, amountIn)
  const quote = { amountIn: args.amountIn, expectedOut: formatUnits(out, outDecimals) }
  const priceNow =
    args.side === 'buy'
      ? `$${Number(args.amountIn).toFixed(2)} buys about ${Number(quote.expectedOut).toFixed(4)} ${token.displayName} now.`
      : `${Number(args.amountIn).toFixed(4)} ${token.displayName} sells for about $${Number(quote.expectedOut).toFixed(2)} now.`
  check.proposal.card.after = [priceNow]
  return { reply, proposal: check.proposal, quote }
}

/**
 * The studio's test read, before a desk exists. The draft is checked in plain code first, so a mandate that
 * does not hold together never costs a model call.
 */
async function answerReadBack(deps: AskDeps, request: AskRequestRow): Promise<AskAnswer> {
  let mandate: ReturnType<typeof mandateFromArgs>
  try {
    mandate = mandateFromArgs(request.payload)
  } catch {
    return plain('Those settings are not complete yet.', 'the draft did not parse')
  }
  const problems = checkMandate(mandate, deps.approved)
  if (problems.length > 0) {
    const why = `That would not hold together: ${problems.join('; ')}.`
    return plain(why, why)
  }
  const user = ['THE DRAFT', ...mandateLines(mandate, deps.approved, new Set())].join('\n')
  const result = await servJson({
    apiKey: deps.servApiKey,
    purpose: 'readback' satisfies (typeof CHAT_PURPOSES)[number],
    promptVersion: READBACK_PROMPT_VERSION,
    system: READBACK_PROMPTS[READBACK_PROMPT_VERSION],
    user,
    schema: ReadBack,
    schemaName: 'read_back',
    maxTokens: ASK_MAX_TOKENS,
    shadowAgent: false,
    timeoutMs: 30_000,
  })
  await logCall(deps.db, null, result)
  if (!result.ok) {
    return plain('I could not read that back just now. Nothing was saved. Try again in a moment.')
  }
  const unclear = result.value.unclear
  if (findHardBannedWords([result.value.restatement, ...unclear].join(' ')).length > 0) {
    return plain('I put that badly, so I will not send it. Try the test read again.')
  }
  return {
    reply:
      unclear.length > 0
        ? `${result.value.restatement}\n\n${unclear.map((u) => `• ${u}`).join('\n')}`
        : result.value.restatement,
    cites: [],
    chart: null,
    proposalId: null,
    refused: null,
    promptVersion: READBACK_PROMPT_VERSION,
  }
}
