/**
 * One candidate, from "arithmetic says this would help" to "this is what the desk decided and why".
 * It reads and thinks. It writes nothing: the orchestrator commits what this returns, so a dry run can call the
 * very same code and simply not commit.
 *
 *   market -> gate -> pre-gate (code says no) -> already asked the owner -> a remembered decision still stands
 *   -> SERV decides when -> size and gate again -> the mode turns "wants to act" into act, ask, or would have
 *
 * The first four can each end it with NO model call.
 */
import { type ApprovedToken, type DeskState, deadlineIn, quotePinned, readTokenConfig } from '@desk/chain'
import type { DeferralRow } from '@desk/db'
import { engineCopy, type Mandate } from '@desk/shared'
import { type Address, keccak256, type PublicClient, toBytes } from 'viem'
import { askTiming, type TimingAnswer } from './decide'
import { type DeferralBaseline, type HeadlineNow, whyDeferralEnds } from './deferral'
import { buildEvidence, type EvidencePack, ownerRules, structuredRules } from './evidence'
import { type GateResult, gate } from './gate'
import { type EventSource, type MarketRead, readMarket } from './market'
import type { Need } from './needs'
import {
  type DeskMode,
  type Override,
  type PlannedOutcome,
  plainHeadline,
  planOutcome,
  sizedAmount,
  wantsToAct,
} from './plan'
import { type Blocker, pregate } from './pregate'
import type { ReferenceSource } from './reference'

export const SLIPPAGE_BPS = 50n
export const DEADLINE_SECONDS = 120

export interface Considered {
  need: Need
  market: MarketRead
  pack: EvidencePack
  gate: GateResult
  blockers: Blocker[]
  answer: TimingAnswer | null
  outcome: PlannedOutcome
  ask: 'ask_first' | 'large_action' | null
  willAct: boolean
  /** Set only when a developer forced this. It is written into the hashed record. */
  override?: Override | null
  summary: string
  /** What would be sent, asked about, or "would have" been sent. null when the desk does not want to act. */
  preview: { amountIn: bigint; expectedOut: bigint; slippageBps: bigint; deadline: number | null } | null
  /** The remembered decision this record continues or ends. */
  deferral: {
    row: DeferralRow
    baseline: DeferralBaseline
    endedBecause: string | null
    status: 'standing' | 'broken' | 'revisited'
  } | null
  /** Set when this decision should be remembered: a fresh wait, or a fresh "would have" in shadow mode. */
  newDeferralBaseline: Omit<DeferralBaseline, 'decisionSeq'> | null
}

export interface ConsiderContext {
  pub: PublicClient
  servApiKey: string
  finnhubKey: string | undefined
  reference: ReferenceSource
  /** The company calendar, when the caller has one. */
  events?: EventSource | undefined
  /** The approved list, to name tokens in the owner's structured rules. */
  approved?: ApprovedToken[] | undefined
  state: DeskState
  mandate: Mandate
  mandateLine: string
  mode: DeskMode
  deskActive: boolean
  deskStateText: string
  standing: DeferralRow | undefined
  /** When the owner was last asked about this token and has not answered yet. */
  askedAt: Date | undefined
  deskAddress: Address
  /** What this holding and the whole desk are worth now, for the largest-holding limit. */
  holdingUsdg: bigint
  totalUsdg: bigint
  /** What the desk has already spent in the last 24 hours, for the owner's own daily limit. */
  spentTodayUsdg: bigint
  /**
   * All the desk's cash, loose and in the savings vault. A remembered wait ends when cash ARRIVES; the desk
   * moving its own cash out of the vault is not cash arriving, so the two are counted together.
   */
  cashUsdg: bigint
  /** The desk did this same thing to this token within the last few minutes. */
  repeatedWithinMinutes: boolean
  /** DEVELOPER ONLY. Act even when the model says wait, recorded in the record as an override. */
  force?: boolean
  now: Date
}

const clock = (at: Date | string) => new Date(at).toISOString().slice(11, 16)

export async function considerCandidate(ctx: ConsiderContext, need: Need): Promise<Considered> {
  const { candidate: c } = need
  const { state, mandate } = ctx
  const held = state.holdings[c.token.address.toLowerCase()] ?? 0n
  // A sale the owner's own rule demanded is protective: the gate and the pre-gate hold it to fewer refusals.
  const protective = c.protective === true
  const [market, onChain] = await Promise.all([
    readMarket(ctx.pub, c, ctx.now, {
      finnhubKey: ctx.finnhubKey,
      reference: ctx.reference,
      events: ctx.events,
    }),
    readTokenConfig(ctx.pub, ctx.deskAddress, c.token.address),
  ])
  const gateFor = (amountIn: bigint, quoteOut: bigint) =>
    gate({
      side: c.side,
      amountIn,
      quoteOut,
      feedPrice: market.feed.price,
      slippageBps: SLIPPAGE_BPS,
      desk: { ...state, tokenBalance: held },
      mandate: {
        perActionCapUsdg: mandate.perActionCapUsdg,
        dailyCapUsdg: mandate.dailyCapUsdg,
        spentTodayUsdg: ctx.spentTodayUsdg,
      },
      gapBps: market.gapBps,
      costBps: market.costBps,
      protective,
      position: {
        holdingUsdg: ctx.holdingUsdg,
        totalUsdg: ctx.totalUsdg,
        maxPositionBps: mandate.maxPositionBps,
      },
      tradingHalt: market.halt?.isTradingHalt,
      oraclePaused: market.oraclePaused,
    })
  const fullGate = gateFor(c.amountIn, market.quoteOut)
  const targetBps = targetOf(mandate, c.token.address)
  const pack = buildEvidence(c, market, state, fullGate, {
    mandateLine: ctx.mandateLine,
    rules: [...ownerRules(mandate.notes), ...structuredRules(mandate.rules, ctx.approved ?? [])],
    position: {
      weightBps: need.driftBps + targetBps,
      targetBps,
      driftBps: need.driftBps,
      thresholdBps: need.thresholdBps,
    },
  })
  const headlineHashes = (market.headlines ?? []).map((h) => keccak256(toBytes(h.url)))
  const headlinesNow: HeadlineNow[] = (market.headlines ?? []).map((h) => ({
    hash: keccak256(toBytes(h.url)),
    publishedAt: h.publishedAt,
  }))

  /** Ends the matter with no model call. */
  const settle = (
    outcome: PlannedOutcome,
    summary: string,
    blockers: Blocker[],
    deferral: Considered['deferral'],
  ): Considered => ({
    need,
    market,
    pack,
    gate: fullGate,
    blockers,
    answer: null,
    outcome,
    ask: null,
    willAct: false,
    summary,
    preview: null,
    deferral,
    newDeferralBaseline: null,
  })

  // Code says no. The record names the rule.
  const blockers = pregate({
    candidate: c,
    market,
    deskActive: ctx.deskActive,
    deskStateText: ctx.deskStateText,
    beyondBand: fullGate.reasons.includes(engineCopy.gate.beyondBand),
    onChain,
    repeatedWithinMinutes: ctx.repeatedWithinMinutes,
    protective,
  })
  const first = blockers[0]
  if (first) return settle('DECLINED', first.text, blockers, null)

  // The owner has been asked and has not answered. The desk does not ask twice.
  if (ctx.askedAt)
    return settle('WAITED', engineCopy.remembered.stillWaitingForAnswer(clock(ctx.askedAt)), [], null)

  // A remembered decision that still stands.
  let deferral: Considered['deferral'] = null
  if (ctx.standing) {
    const baseline = ctx.standing.baseline as unknown as DeferralBaseline
    const ended = whyDeferralEnds(
      baseline,
      {
        at: ctx.now,
        gapBps: market.gapBps,
        driftBps: need.driftBps,
        cashUsdg: ctx.cashUsdg,
        headlines: headlinesNow,
      },
      ctx.standing.revisitAt,
      need.thresholdBps,
    )
    deferral = {
      row: ctx.standing,
      baseline,
      endedBecause: ended?.reason ?? null,
      status: ended?.status ?? 'standing',
    }
    if (!ended) {
      const at = clock(baseline.decidedAt)
      const verb = c.side === 'buy' ? 'bought' : 'sold'
      return baseline.kind === 'would_have'
        ? settle(
            'NOTHING_TO_DO',
            engineCopy.remembered.wouldAlreadyHave(verb, c.token.displayName, at),
            [],
            deferral,
          )
        : settle('WAITED', engineCopy.remembered.stillWaitingForReopen(at), [], deferral)
    }
  }

  const answer = await askTiming({
    apiKey: ctx.servApiKey,
    userMessage: pack.userMessage,
    evidenceIds: pack.evidenceIds,
    ruleIds: pack.ruleIds,
    // The model may cite these by id. A quotation would put licensed or private text in the public record.
    privateTexts: [
      ...pack.privateNotes.headlineTitles.map((h) => h.title),
      ...ownerRules(mandate.notes).map((r) => r.text),
    ],
  })
  const amountIn = sizedAmount(c.amountIn, answer.decision, null)
  const isPart = amountIn < c.amountIn
  const expectedOut = isPart ? await quotePinned(ctx.pub, c.token, c.side, amountIn) : market.quoteOut
  const finalGate = isPart ? gateFor(amountIn, expectedOut) : fullGate
  // A developer override never gets past the limits check, and it is written into the record by name.
  // Only ever overrides an ANSWER. With no usable decision there is nothing to overrule, and the desk says so.
  const override =
    ctx.force && answer.decision && !wantsToAct(answer.decision)
      ? { by: 'developer', reason: 'forced with --force to exercise the path end to end' }
      : null
  const plan = planOutcome({
    decision: answer.decision,
    gate: finalGate,
    override,
    // A correction cut down to fit the per-action limit is an action in part, and the record says so.
    isPart: isPart || need.limitedByPerAction,
    mode: ctx.mode,
    largeActionUsdg: mandate.largeActionUsdg,
  })

  const wanted = plan.willAct || plan.outcome === 'ASKED' || plan.outcome === 'WOULD_HAVE_ACTED'
  const deadline = plan.willAct ? await deadlineIn(ctx.pub, DEADLINE_SECONDS) : null
  const summary =
    plan.outcome === 'BLOCKED_BY_LIMIT'
      ? engineCopy.blockedByLimit(finalGate.reasons)
      : (plainHeadline(answer.decision) ??
        engineCopy.noUsableDecision(answer.serv.ok ? answer.problems.join('; ') : answer.serv.error))
  const facts = {
    decidedAt: ctx.now.toISOString(),
    gapBps: market.gapBps,
    driftBps: need.driftBps,
    cashUsdg: ctx.cashUsdg.toString(),
    headlineHashes,
  }

  return {
    need,
    market,
    pack,
    gate: finalGate,
    blockers,
    answer,
    outcome: plan.outcome,
    ask: plan.ask,
    willAct: plan.willAct,
    override,
    summary,
    preview: wanted ? { amountIn, expectedOut, slippageBps: SLIPPAGE_BPS, deadline } : null,
    deferral,
    newDeferralBaseline:
      plan.outcome === 'WAITED' && answer.decision?.option === 'WAIT_REOPEN'
        ? { kind: 'wait', ...facts }
        : plan.outcome === 'WOULD_HAVE_ACTED'
          ? { kind: 'would_have', ...facts }
          : null,
  }
}

function targetOf(mandate: Mandate, token: string): number {
  return mandate.targets.tokens.find((t) => t.token.toLowerCase() === token.toLowerCase())?.weightBps ?? 0
}
