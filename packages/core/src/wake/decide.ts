/**
 * Asks SERV Reasoning the desk's one question: WHEN. Then checks the answer ourselves, because SERV's own
 * safety tools can fail open with no signal. Any failure means "no decision", which never becomes a trade.
 */
import { checkTimingDecision, styleWordsUsed, TimingDecision } from '@desk/shared'
import { type ServResult, servJson } from '../serv/client'
import { TIMING_PROMPT_VERSION, TIMING_SYSTEM_PROMPT } from '../serv/prompts/timing'

export interface TimingAnswer {
  serv: ServResult<TimingDecision>
  /** Why our own checks rejected an answer SERV returned as fine. Empty when it passed or when SERV failed. */
  problems: string[]
  /** Words from the product's voice list that the model used anyway. Noted, never a veto. */
  styleWords: string[]
  /** Present only when SERV answered AND our checks passed. */
  decision: TimingDecision | undefined
}

export async function askTiming(input: {
  apiKey: string
  userMessage: string
  evidenceIds: string[]
  ruleIds: string[]
}): Promise<TimingAnswer> {
  const serv = await servJson({
    apiKey: input.apiKey,
    purpose: 'timing',
    promptVersion: TIMING_PROMPT_VERSION,
    system: TIMING_SYSTEM_PROMPT,
    user: input.userMessage,
    schema: TimingDecision,
    schemaName: 'timing_decision',
  })
  const problems = serv.ok ? checkTimingDecision(serv.value, input.evidenceIds, input.ruleIds) : []
  return {
    serv,
    problems,
    styleWords: serv.ok ? styleWordsUsed(serv.value) : [],
    decision: serv.ok && problems.length === 0 ? serv.value : undefined,
  }
}
