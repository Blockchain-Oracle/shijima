/**
 * Asks SERV Reasoning the desk's one question: WHEN. Then checks the answer ourselves, because SERV's own
 * safety tools can fail open with no signal. Any failure means "no decision", which never becomes a trade.
 */
import { checkTimingDecision, engineCopy, styleWordsUsed, TimingDecision } from '@desk/shared'
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

/** A run of this many characters from a headline or a note, found in the model's prose, is a quotation. */
const QUOTE_WINDOW = 24

/**
 * The public record may not carry headline text (our news licence) or the owner's notes (theirs alone). The
 * model saw both, so its prose is checked for a quotation of either before the answer is accepted.
 */
export function quotesPrivateText(d: TimingDecision, privateTexts: string[]): boolean {
  const prose = [
    d.headline,
    ...d.reasons.map((r) => r.text),
    ...d.rejected.map((r) => r.reason),
    ...d.warnings,
  ]
    .join('\n')
    .toLowerCase()
  for (const raw of privateTexts) {
    const text = raw.toLowerCase().replace(/\s+/g, ' ').trim()
    if (text.length < QUOTE_WINDOW) {
      if (text.length >= 12 && prose.includes(text)) return true
      continue
    }
    for (let i = 0; i + QUOTE_WINDOW <= text.length; i++) {
      if (prose.includes(text.slice(i, i + QUOTE_WINDOW))) return true
    }
  }
  return false
}

export async function askTiming(input: {
  apiKey: string
  userMessage: string
  evidenceIds: string[]
  ruleIds: string[]
  /** Headline titles and the owner's notes: text the answer may cite by id but never repeat. */
  privateTexts?: string[]
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
  if (serv.ok && quotesPrivateText(serv.value, input.privateTexts ?? [])) {
    problems.push(engineCopy.decide.quotedPrivateText)
  }
  return {
    serv,
    problems,
    styleWords: serv.ok ? styleWordsUsed(serv.value) : [],
    decision: serv.ok && problems.length === 0 ? serv.value : undefined,
  }
}
