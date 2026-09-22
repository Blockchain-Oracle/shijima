/**
 * Carrying out a request the owner approved.
 *
 * The owner saw a price. By the time they answer, minutes or an hour later, that price has moved. So an
 * approval is permission to do THAT action at about THAT price, never a standing order. Everything is read
 * again with a fresh quote, every rule is checked again, and the desk acts only if the price is still within
 * half a percent of what the owner was shown. Otherwise it records "approved, conditions changed, not executed".
 *
 * There is NO model call here. The judgment was made when the request was raised, and the owner has answered
 * it. This step is arithmetic and nothing else.
 */
import { type ApprovedToken, type DeskState, deadlineIn, readTokenConfig } from '@desk/chain'
import { answeredApprovals } from '@desk/db'
import { DecisionRecordV2, engineCopy, type Mandate } from '@desk/shared'
import { type Address, type PublicClient, parseUnits } from 'viem'
import { z } from 'zod'
import { type CommitContext, commit } from './commit'
import { type Considered, DEADLINE_SECONDS, SLIPPAGE_BPS } from './consider'
import { buildEvidence, ownerRules } from './evidence'
import { gate } from './gate'
import { readMarket } from './market'
import type { Need } from './needs'
import type { PlannedOutcome } from './plan'
import { pregate } from './pregate'
import type { ApprovalOf } from './record'
import type { ReferenceSource } from './reference'
import { TOKEN_DECIMALS, USDG_DECIMALS } from './types'
import type { Valuation } from './valuation'
import type { WakeDeps } from './wake'

/** How far the price may move between the owner being shown it and the desk acting. */
export const APPROVAL_DRIFT_BPS = 50

export interface ApprovedRequest {
  /** The record that asked. Its candidate and preview are what the owner agreed to. */
  decisionSeq: number
  askedBecause: 'ask_first' | 'large_action' | 'owner_override'
  answeredAt: Date
  answeredVia: 'telegram' | 'web' | 'chat'
  need: Need
  /** The amount and expected output the owner was shown. */
  shown: { amountIn: bigint; expectedOut: bigint }
}

export interface ApprovedContext {
  pub: PublicClient
  finnhubKey: string | undefined
  reference: ReferenceSource
  state: DeskState
  mandate: Mandate
  mandateLine: string
  deskAddress: Address
  deskActive: boolean
  deskStateText: string
  holdingUsdg: bigint
  totalUsdg: bigint
  /** What the desk has already spent in the last 24 hours, for the owner's own daily limit. */
  spentTodayUsdg: bigint
  now: Date
}

export interface ApprovedResult extends Considered {
  approvalOf: ApprovalOf
}

/** Reads everything again and decides whether the approved action still stands. No model call. */
export async function considerApproved(
  ctx: ApprovedContext,
  request: ApprovedRequest,
): Promise<ApprovedResult> {
  const { need } = request
  const c = need.candidate
  const held = ctx.state.holdings[c.token.address.toLowerCase()] ?? 0n
  const [market, onChain] = await Promise.all([
    readMarket(ctx.pub, { ...c, amountIn: request.shown.amountIn }, ctx.now, {
      finnhubKey: ctx.finnhubKey,
      reference: ctx.reference,
    }),
    readTokenConfig(ctx.pub, ctx.deskAddress, c.token.address),
  ])
  const freshGate = gate({
    side: c.side,
    amountIn: request.shown.amountIn,
    quoteOut: market.quoteOut,
    feedPrice: market.feed.price,
    slippageBps: SLIPPAGE_BPS,
    desk: { ...ctx.state, tokenBalance: held },
    mandate: {
      perActionCapUsdg: ctx.mandate.perActionCapUsdg,
      dailyCapUsdg: ctx.mandate.dailyCapUsdg,
      spentTodayUsdg: ctx.spentTodayUsdg,
    },
    gapBps: market.gapBps,
    costBps: market.costBps,
    protective: false,
    position: {
      holdingUsdg: ctx.holdingUsdg,
      totalUsdg: ctx.totalUsdg,
      maxPositionBps: ctx.mandate.maxPositionBps,
    },
    tradingHalt: market.halt?.isTradingHalt,
    oraclePaused: market.oraclePaused,
  })
  const blockers = pregate({
    candidate: c,
    market,
    deskActive: ctx.deskActive,
    deskStateText: ctx.deskStateText,
    beyondBand: freshGate.reasons.includes(engineCopy.gate.beyondBand),
    onChain,
    // The owner has just answered, so a recent identical trade is exactly what they asked for.
    repeatedWithinMinutes: false,
    protective: false,
  })
  const targetBps =
    ctx.mandate.targets.tokens.find((t) => t.token.toLowerCase() === c.token.address.toLowerCase())
      ?.weightBps ?? 0
  const pack = buildEvidence({ ...c, amountIn: request.shown.amountIn }, market, ctx.state, freshGate, {
    mandateLine: ctx.mandateLine,
    rules: ownerRules(ctx.mandate.notes),
    position: {
      weightBps: need.driftBps + targetBps,
      targetBps,
      driftBps: need.driftBps,
      thresholdBps: need.thresholdBps,
    },
  })

  // How far the price moved against the owner since they were shown it. A move in their favour is not a reason
  // to refuse, so only a worse price counts.
  const shown = request.shown.expectedOut
  const movedBps = shown === 0n ? 0 : Number(((shown - market.quoteOut) * 10_000n) / shown)
  const override = request.askedBecause === 'owner_override'
  const approvalOf: ApprovalOf = {
    decisionSeq: request.decisionSeq,
    askedBecause: request.askedBecause,
    answeredAt: request.answeredAt.toISOString(),
    answeredVia: request.answeredVia,
    movedBps,
  }
  const base = {
    need,
    market,
    pack,
    gate: freshGate,
    blockers,
    answer: null,
    ask: null,
    deferral: null,
    newDeferralBaseline: null,
    approvalOf,
    // "Do it anyway" is the owner's call, not the desk's. It is written into the hashed record as such, and the
    // desk's own Timing sum leaves it out.
    override: override ? { by: 'owner', reason: engineCopy.approved.overrideReason } : null,
  }
  const stop = (summary: string) => ({
    ...base,
    outcome: 'NOT_EXECUTED' as const,
    willAct: false,
    summary,
    preview: null,
  })

  const blocker = blockers[0]
  if (blocker) return stop(engineCopy.approved.refusedNow(blocker.text))
  if (freshGate.result === 'deny') return stop(engineCopy.approved.blockedNow(freshGate.reasons))
  if (movedBps > APPROVAL_DRIFT_BPS) {
    return stop(engineCopy.approved.conditionsChanged(movedBps, APPROVAL_DRIFT_BPS))
  }

  return {
    ...base,
    outcome: override ? 'ACTED_BY_OVERRIDE' : need.limitedByPerAction ? 'ACTED_IN_PART' : 'ACTED',
    willAct: true,
    summary: override
      ? engineCopy.approved.overrideCarriedOut(c.token.displayName)
      : engineCopy.approved.carriedOut(c.token.displayName),
    preview: {
      amountIn: request.shown.amountIn,
      expectedOut: market.quoteOut,
      slippageBps: SLIPPAGE_BPS,
      deadline: await deadlineIn(ctx.pub, DEADLINE_SECONDS),
    },
  }
}

/** The quote the owner was shown for "do it anyway", saved on the approval because a wait has no preview. */
const OverridePreview = z.object({ amountIn: z.string(), expectedOut: z.string() })

/**
 * Rebuilds what the owner approved from the record that asked. Everything comes from the stored body, so an
 * approval can never be carried out as something other than what was shown. A body that no longer makes sense,
 * such as a token that has left the approved list, simply yields nothing and the approval is left alone.
 *
 * "Do it anyway" asks about a record that waited, which has no preview. Its approval carries the fresh quote the
 * owner confirmed instead, and that quote is what the price is held to.
 */
function approvedRequest(
  answered: Awaited<ReturnType<typeof answeredApprovals>>[number],
  approved: ApprovedToken[],
): ApprovedRequest | undefined {
  const body = DecisionRecordV2.safeParse(answered.record)
  if (!body.success || !body.data.candidate || !body.data.need) return undefined
  if (!answered.answeredAt || !answered.answeredVia) return undefined
  const { candidate, need } = body.data
  // Only a trade is ever asked about. A vault move is housekeeping and never waits on the owner.
  if (candidate.side !== 'buy' && candidate.side !== 'sell') return undefined
  const side = candidate.side
  const shownOverride = OverridePreview.safeParse(answered.preview)
  const preview =
    answered.reason === 'owner_override'
      ? shownOverride.success
        ? shownOverride.data
        : undefined
      : body.data.preview
  if (!preview) return undefined
  const token = approved.find((t) => t.address.toLowerCase() === candidate.token.toLowerCase())
  if (!token) return undefined
  const inDecimals = side === 'sell' ? TOKEN_DECIMALS : USDG_DECIMALS
  const outDecimals = side === 'sell' ? USDG_DECIMALS : TOKEN_DECIMALS
  return {
    decisionSeq: answered.decisionSeq,
    askedBecause: answered.reason,
    answeredAt: answered.answeredAt,
    answeredVia: answered.answeredVia,
    need: {
      candidate: {
        id: candidate.id,
        side,
        token,
        amountIn: parseUnits(preview.amountIn, inDecimals),
        why: candidate.why,
      },
      driftBps: need.driftBps,
      thresholdBps: need.thresholdBps,
      limitedByPerAction: need.limitedByPerActionLimit,
    },
    shown: {
      amountIn: parseUnits(preview.amountIn, inDecimals),
      expectedOut: parseUnits(preview.expectedOut, outDecimals),
    },
  }
}

export interface RunApprovedContext {
  mandate: Mandate
  spentTodayUsdg: bigint
  mandateLine: string
  deskState: 'active' | 'paused_by_owner' | 'stopped_by_loss_limit' | 'needs_attention'
  stateText: string
  valuation: Valuation
  now: Date
  reference: ReferenceSource
  say: (line: string) => void
}

/**
 * Carries out every request the owner has approved and the desk has not yet acted on, oldest first.
 * Each one gets a fresh quote and the whole rule set again. None of them asks the model anything.
 */
export async function runApprovedRequests(
  deps: WakeDeps,
  ctx: CommitContext,
  run: RunApprovedContext,
): Promise<{ records: { seq: number; outcome: PlannedOutcome; summary: string }[]; moved: boolean }> {
  const records: { seq: number; outcome: PlannedOutcome; summary: string }[] = []
  let moved = false
  for (const answered of await answeredApprovals(deps.db, ctx.desk.id)) {
    const request = approvedRequest(answered, deps.approved)
    if (!request) continue
    const held = run.valuation.holdings.find((h) => h.token.address === request.need.candidate.token.address)
    const checked = await considerApproved(
      {
        pub: deps.pub,
        finnhubKey: deps.finnhubKey,
        reference: run.reference,
        state: ctx.state,
        mandate: run.mandate,
        mandateLine: run.mandateLine,
        deskAddress: ctx.desk.address as Address,
        deskActive: run.deskState === 'active',
        deskStateText: run.stateText,
        holdingUsdg: held?.valueUsdg ?? 0n,
        totalUsdg: run.valuation.totalUsdg,
        spentTodayUsdg: run.spentTodayUsdg,
        now: run.now,
      },
      request,
    )
    const done = await commit(
      deps,
      { ...ctx, approval: { id: answered.approvalId, of: checked.approvalOf } },
      checked,
    )
    moved ||= done.moved
    records.push({ seq: done.seq, outcome: checked.outcome, summary: checked.summary })
    run.say(`approved request from record ${request.decisionSeq}: ${checked.outcome}. ${checked.summary}`)
  }
  return { records, moved }
}
