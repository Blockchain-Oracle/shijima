/**
 * What SERV Reasoning returns when asked the desk's one question: WHEN, never WHAT.
 *
 * Wire rules for OpenAI-style strict mode, verified live against SERV on 2026-09-20: every field required,
 * nullable instead of optional, no defaults. Numeric bounds are stripped before sending (see toWireSchema)
 * and enforced here after parsing, because nobody has verified that SERV's backend accepts them.
 */

import { z } from 'zod'
import { findHardBannedWords, findStyleWords } from '../banned-words'

export const TimingOption = z.enum(['ACT_NOW', 'ACT_PART', 'WAIT_REOPEN', 'DECLINE'])
export type TimingOption = z.infer<typeof TimingOption>

export const TimingDecision = z.object({
  option: TimingOption,
  /** Only for ACT_PART. A closed set, so the model cannot invent a size. */
  partPercent: z.literal([25, 50, 75]).nullable(),
  /** One plain sentence that stands alone: what was decided and the main reason. Shown as the record's summary. */
  headline: z.string(),
  /** 0 to 100. How sure it is that this is the right timing call. It is not a forecast of price. */
  confidencePercent: z.number().int().min(0).max(100),
  /** Plain-language reasons. Each must point at evidence ids that were actually supplied. */
  reasons: z.array(z.object({ text: z.string(), evidenceIds: z.array(z.string()) })),
  /** Every option it did not choose, and why not. */
  rejected: z.array(z.object({ option: TimingOption, reason: z.string() })),
  newsExplainsGap: z.enum(['yes', 'no', 'unclear', 'not_applicable']),
  warnings: z.array(z.string()),
  /** Ids of the owner's rules that applied. Ids, never rule text, so the content filter does not trip. */
  ruleIds: z.array(z.string()),
})
export type TimingDecision = z.infer<typeof TimingDecision>

const STRIP = new Set([
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'pattern',
  'format',
  'default',
])

/** zod schema to the JSON schema we put on the wire: no $schema, no bounds, no defaults. */
export function toWireSchema(schema: z.ZodType): Record<string, unknown> {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean)
    if (node === null || typeof node !== 'object') return node
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => !STRIP.has(k))
        .map(([k, v]) => [k, clean(v)]),
    )
  }
  return clean(z.toJSONSchema(schema)) as Record<string, unknown>
}

/** Checks a decision against what it was shown. The model may only cite ids it was given. */
/** Words that are only the product's voice, found in the model's prose. Noted in the record, never a veto. */
export function styleWordsUsed(d: TimingDecision): string[] {
  return [...new Set(prose(d).flatMap(findStyleWords))]
}

/** Everything the model wrote in its own words. The banned-word rule applies to all of it. */
function prose(d: TimingDecision): string[] {
  return [d.headline, ...d.reasons.map((r) => r.text), ...d.rejected.map((r) => r.reason), ...d.warnings]
}

export function checkTimingDecision(
  d: TimingDecision,
  knownEvidenceIds: string[],
  knownRuleIds: string[],
): string[] {
  const problems: string[] = []
  const evidence = new Set(knownEvidenceIds)
  const rules = new Set(knownRuleIds)
  if (d.option === 'ACT_PART' && d.partPercent === null) problems.push('ACT_PART without a part size')
  if (d.option !== 'ACT_PART' && d.partPercent !== null) problems.push(`part size given for ${d.option}`)
  if (d.reasons.length === 0) problems.push('no reasons given')
  for (const r of d.reasons) {
    for (const id of r.evidenceIds) if (!evidence.has(id)) problems.push(`cites unknown evidence id "${id}"`)
  }
  for (const id of d.ruleIds) if (!rules.has(id)) problems.push(`cites unknown rule id "${id}"`)
  if (d.rejected.some((r) => r.option === d.option))
    problems.push('the chosen option also appears as rejected')
  // The product never promises gain and never calls a Stock Token a "tokenized stock". A model that writes one
  // of those words gives no usable decision, so the desk does nothing. That is the safe direction to fail.
  // Words that are only the product's voice are reported by styleWordsUsed instead, and cost nothing.
  const banned = [...new Set(prose(d).flatMap(findHardBannedWords))]
  if (banned.length > 0) problems.push(`uses words we never use: ${banned.join(', ')}`)
  return problems
}
