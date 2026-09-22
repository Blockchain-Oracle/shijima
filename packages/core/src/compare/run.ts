/**
 * Runs one saved situation one way: through SERV Reasoning, as the desk does, or raw, straight to the same model
 * with SERV's reasoning layer and tools switched off. Same system prompt, same message, same schema, same model;
 * the only difference is SERV. Both answers then face the desk's own checks, exactly as a live answer would.
 */
import { checkTimingDecision, styleWordsUsed, TimingDecision } from '@desk/shared'
import { servJson } from '../serv/client'
import { TIMING_PROMPT_VERSION, TIMING_SYSTEM_PROMPT } from '../serv/prompts/timing'
import type { Situation, SituationId } from './situations'

export type CompareMode = 'raw' | 'serv'

export interface ComparisonRun {
  situation: SituationId
  mode: CompareMode
  ranAt: string
  model: string
  promptVersion: string
  latencyMs: number
  totalTokens: number | null
  /** SERV or the model failed to give a usable answer at all. */
  error: string | null
  decision: TimingDecision | null
  /** Why the desk's own checks would have thrown the answer away. Empty means it would have been accepted. */
  problems: string[]
  styleWords: string[]
}

export async function runComparison(apiKey: string, s: Situation, mode: CompareMode): Promise<ComparisonRun> {
  const answer = await servJson({
    apiKey,
    purpose: 'compare',
    promptVersion: TIMING_PROMPT_VERSION,
    system: TIMING_SYSTEM_PROMPT,
    user: s.pack.userMessage,
    schema: TimingDecision,
    schemaName: 'timing_decision',
    raw: mode === 'raw',
  })
  const base = {
    situation: s.id,
    mode,
    ranAt: new Date().toISOString(),
    model: answer.meta.model,
    promptVersion: answer.meta.promptVersion,
    latencyMs: answer.meta.latencyMs,
    totalTokens: answer.meta.totalTokens,
  }
  if (!answer.ok) return { ...base, error: answer.error, decision: null, problems: [], styleWords: [] }
  return {
    ...base,
    error: null,
    decision: answer.value,
    problems: checkTimingDecision(answer.value, s.pack.evidenceIds, s.pack.ruleIds),
    styleWords: styleWordsUsed(answer.value),
  }
}
