/**
 * Assembles the hashed body of a decision record. Pure and quick, because it runs while the desk lock is held:
 * every fact was gathered beforehand. Strings, safe integers, booleans and null only. hashRecord refuses the rest.
 *
 * The shape is versioned in shared/schemas/record.ts, and versions are append only. A record always says which desk and chain it belongs to, where it sits in
 * the desk's chain, which mandate it was made under, what the desk was worth, and why it looked at all. A
 * field that does not apply is null, never missing, so the absence is visible in the record.
 */
import type { DeskState } from '@desk/chain'
import { hashRecord, LATEST_RECORD_VERSION, type Mandate } from '@desk/shared'
import { formatUnits, type Hex } from 'viem'
import type { TimingAnswer } from './decide'
import type { GateResult } from './gate'
import type { Need } from './needs'
import type { DeskMode, Override, PlannedOutcome } from './plan'
import type { Blocker } from './pregate'
import { type Candidate, TOKEN_DECIMALS, USDG_DECIMALS } from './types'
import { PRICE_SOURCE, type Valuation } from './valuation'

export const RECORD_SCHEMA_VERSION = LATEST_RECORD_VERSION

/** A mandate's fingerprint, so a record commits to the exact instructions it was made under. */
export function mandateFingerprint(m: Mandate): Hex {
  return hashRecord({
    ...m,
    perActionCapUsdg: m.perActionCapUsdg.toString(),
    dailyCapUsdg: m.dailyCapUsdg.toString(),
    largeActionUsdg: m.largeActionUsdg.toString(),
  })
}

export interface ApprovalOf {
  decisionSeq: number
  askedBecause: 'ask_first' | 'large_action'
  answeredAt: string
  answeredVia: 'telegram' | 'web'
  movedBps: number
}

export interface DecisionBodyInput {
  chainId: number
  desk: string
  slot: { seq: number; prevHash: Hex }
  state: DeskState
  decidedAt: Date
  wake: { scheduledFor: Date; trigger: string }
  mode: DeskMode
  mandate: { version: number; fingerprint: Hex } | null
  valuation: Valuation | null
  need: Need | null
  candidate: Candidate | null
  /** A remembered wait that this record continues, ends, or that ended just before it. */
  deferral: {
    decisionSeq: number
    decidedAt: string
    stillStanding: boolean
    endedBecause: string | null
  } | null
  blockers: Blocker[]
  evidence: Record<string, unknown>[]
  answer: TimingAnswer | null
  gate: GateResult | null
  override: Override | null
  outcome: PlannedOutcome
  ask: 'ask_first' | 'large_action' | null
  /** Set only on an execution record: the request the owner approved, and how far the price has moved since. */
  approvalOf?: ApprovalOf | null
  /** Present only when the desk acts, would have acted, or asks. */
  preview: { amountIn: bigint; expectedOut: bigint; slippageBps: bigint; deadline: number | null } | null
}

const usdg = (v: bigint) => formatUnits(v, USDG_DECIMALS)

export function buildDecisionBody(i: DecisionBodyInput): Record<string, unknown> {
  const c = i.candidate
  const inUnits = c?.side === 'sell' ? TOKEN_DECIMALS : USDG_DECIMALS
  const outUnits = c?.side === 'sell' ? USDG_DECIMALS : TOKEN_DECIMALS
  const v = i.valuation
  const a = i.answer
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    kind: i.approvalOf ? 'execution' : 'decision',
    // The desk and chain are inside the hash, so a fingerprint belongs to exactly one desk.
    chainId: i.chainId,
    desk: i.desk,
    seq: i.slot.seq,
    prevHash: i.slot.prevHash,
    // The contract's own counter and head as they stood when this was decided.
    chain: { seqBefore: Number(i.state.seq), headBefore: i.state.head },
    decidedAt: i.decidedAt.toISOString(),
    wake: { scheduledFor: i.wake.scheduledFor.toISOString(), trigger: i.wake.trigger },
    mode: i.mode,
    mandate: i.mandate,
    valuation: v
      ? {
          priceSource: PRICE_SOURCE,
          totalUsdg: usdg(v.totalUsdg),
          cashUsdg: usdg(v.cashUsdg),
          vaultUsdg: usdg(v.vaultUsdg),
          holdings: v.holdings.map((h) => ({
            token: h.token.address,
            symbol: h.token.symbol,
            balance: formatUnits(h.balance, TOKEN_DECIMALS),
            priceUsdg: formatUnits(h.twapE8, 8),
            lastOfficialUpdate: formatUnits(h.feedE8, 8),
            valueUsdg: usdg(h.valueUsdg),
            weightBps: h.weightBps,
            targetBps: h.targetBps,
          })),
        }
      : null,
    need: i.need
      ? {
          driftBps: i.need.driftBps,
          thresholdBps: i.need.thresholdBps,
          limitedByPerActionLimit: i.need.limitedByPerAction,
        }
      : null,
    candidate: c
      ? {
          id: c.id,
          side: c.side,
          token: c.token.address,
          symbol: c.token.symbol,
          amountIn: formatUnits(c.amountIn, inUnits),
          amountInUnit: c.side === 'buy' ? 'USDG' : c.token.symbol,
          why: c.why,
        }
      : null,
    deferral: i.deferral,
    approvalOf: i.approvalOf ?? null,
    blockers: i.blockers.map((b) => ({ rule: b.rule, text: b.text })),
    evidence: i.evidence,
    serv: a
      ? {
          promptVersion: a.serv.meta.promptVersion,
          model: a.serv.meta.model,
          mode: a.serv.meta.mode,
          latencyMs: a.serv.meta.latencyMs,
          totalTokens: a.serv.meta.totalTokens,
          finishReason: a.serv.meta.finishReason,
          error: a.serv.ok ? null : a.serv.error,
          rejectedByOurChecks: a.problems,
          styleWordsUsed: a.styleWords,
          decision: a.serv.ok ? a.serv.value : null,
        }
      : null,
    gate: i.gate
      ? {
          result: i.gate.result,
          reasons: i.gate.reasons,
          countedUsdg: usdg(i.gate.countedUsdg),
          oracleFloor: formatUnits(i.gate.oracleFloor, outUnits),
        }
      : null,
    override: i.override,
    outcome: i.outcome,
    ask: i.ask,
    preview:
      i.preview && i.gate
        ? {
            amountIn: formatUnits(i.preview.amountIn, inUnits),
            expectedOut: formatUnits(i.preview.expectedOut, outUnits),
            minOut: formatUnits(i.gate.minOut, outUnits),
            slippageBps: Number(i.preview.slippageBps),
            deadline: i.preview.deadline,
          }
        : null,
  }
}
