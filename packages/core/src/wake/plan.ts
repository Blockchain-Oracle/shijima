/** Combines the model's timing answer, the gate and any developer override into what will actually happen. */
import type { TimingDecision } from '@desk/shared'
import type { GateResult } from './gate'

export type PlannedOutcome =
  | 'ACTED'
  | 'ACTED_IN_PART'
  | 'ACTED_BY_OVERRIDE'
  | 'WOULD_HAVE_ACTED'
  | 'ASKED'
  | 'WAITED'
  | 'DECLINED'
  | 'NOTHING_TO_DO'
  | 'NOT_EXECUTED'
  | 'BLOCKED_BY_LIMIT'
  | 'FAILED_NO_DECISION'

export type DeskMode = 'shadow' | 'ask_first' | 'on_its_own'

export interface Override {
  by: string
  reason: string
}

/** The share of the candidate the model asked for. The full size unless it said ACT_PART. */
export function sizedAmount(
  full: bigint,
  decision: TimingDecision | undefined,
  override: Override | null,
): bigint {
  if (override || decision?.option !== 'ACT_PART' || !decision.partPercent) return full
  return (full * BigInt(decision.partPercent)) / 100n
}

export function wantsToAct(decision: TimingDecision | undefined): boolean {
  return decision?.option === 'ACT_NOW' || decision?.option === 'ACT_PART'
}

/**
 * "Blocked by a limit" means the desk WANTED to act and a limit stopped it. If the model said wait or decline,
 * that is the outcome, whatever the gate would have said. The gate is still last and final: neither the model
 * nor a developer override gets past it.
 *
 * Then the mode decides what wanting to act turns into. Shadow records "would have" and spends nothing. Ask
 * first asks. On its own acts, but still asks when the action is at or above the owner's large-action size.
 */
export function planOutcome(p: {
  decision: TimingDecision | undefined
  gate: GateResult
  override: Override | null
  isPart: boolean
  mode: DeskMode
  largeActionUsdg: bigint
}): { willAct: boolean; outcome: PlannedOutcome; ask: 'ask_first' | 'large_action' | null } {
  const no = (outcome: PlannedOutcome) => ({ willAct: false, outcome, ask: null })
  if (wantsToAct(p.decision) || p.override !== null) {
    if (p.gate.result === 'deny') return no('BLOCKED_BY_LIMIT')
    if (p.mode === 'shadow') return no('WOULD_HAVE_ACTED')
    if (p.mode === 'ask_first') return { willAct: false, outcome: 'ASKED', ask: 'ask_first' }
    if (p.gate.countedUsdg >= p.largeActionUsdg)
      return { willAct: false, outcome: 'ASKED', ask: 'large_action' }
    const outcome = p.override ? 'ACTED_BY_OVERRIDE' : p.isPart ? 'ACTED_IN_PART' : 'ACTED'
    return { willAct: true, outcome, ask: null }
  }
  if (!p.decision) return no('FAILED_NO_DECISION')
  return no(p.decision.option === 'DECLINE' ? 'DECLINED' : 'WAITED')
}

/** The record's outcome words mapped to the database column the record list filters on. */
export const OUTCOME_COLUMN = {
  ACTED: 'acted',
  ACTED_IN_PART: 'acted_in_part',
  ACTED_BY_OVERRIDE: 'acted_by_override',
  WOULD_HAVE_ACTED: 'would_have_acted',
  ASKED: 'asked',
  NOTHING_TO_DO: 'nothing_to_do',
  NOT_EXECUTED: 'not_executed',
  WAITED: 'waited',
  DECLINED: 'declined',
  BLOCKED_BY_LIMIT: 'blocked_by_limit',
  FAILED_NO_DECISION: 'failed',
} as const satisfies Record<PlannedOutcome, string>

const PLAIN_WORDS = {
  ACT_NOW: 'act now',
  ACT_PART: 'act in part',
  WAIT_REOPEN: 'wait for the reopen',
  DECLINE: 'decline',
} as const

/**
 * The one-line summary the owner sees. The model's headline, with any option code name it let slip turned into
 * plain words. Only this display copy is touched: the hashed record keeps the model's answer exactly as given.
 */
export function plainHeadline(decision: TimingDecision | undefined): string | undefined {
  if (!decision) return undefined
  const text = decision.headline
    .replace(
      /\b(ACT_NOW|ACT_PART|WAIT_REOPEN|DECLINE)\b/g,
      (code) => PLAIN_WORDS[code as keyof typeof PLAIN_WORDS],
    )
    .trim()
  if (text === '') return decision.reasons[0]?.text
  return text.charAt(0).toUpperCase() + text.slice(1)
}
