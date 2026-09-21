import { describe, expect, it } from 'vitest'
import { checkTimingDecision, TimingDecision, toWireSchema } from './timing'

const good: TimingDecision = {
  option: 'WAIT_REOPEN',
  partPercent: null,
  headline: 'Wait for the reopen, because the weekend price is not anchored.',
  confidencePercent: 80,
  reasons: [{ text: 'The price is not anchored this weekend.', evidenceIds: ['e1'] }],
  rejected: [{ option: 'ACT_NOW', reason: 'nothing is urgent' }],
  newsExplainsGap: 'no',
  warnings: [],
  ruleIds: [],
}

describe('toWireSchema', () => {
  const wire = toWireSchema(TimingDecision)
  const text = JSON.stringify(wire)
  it('is strict-mode shaped: closed object, every field required', () => {
    expect(wire.additionalProperties).toBe(false)
    expect((wire.required as string[]).sort()).toEqual(Object.keys(good).sort())
  })
  it('carries no $schema, bounds or defaults, which SERV has not been verified to accept', () => {
    for (const banned of ['$schema', '"minimum"', '"maximum"', '"default"'])
      expect(text).not.toContain(banned)
  })
  it('keeps the closed sets that stop the model inventing options or sizes', () => {
    expect(text).toContain('WAIT_REOPEN')
    expect(text).toContain('75')
  })
})

describe('TimingDecision', () => {
  it('accepts a well formed decision', () => expect(TimingDecision.parse(good)).toEqual(good))
  it('enforces the bounds that were stripped from the wire', () => {
    expect(() => TimingDecision.parse({ ...good, confidencePercent: 140 })).toThrow()
    expect(() => TimingDecision.parse({ ...good, partPercent: 40 })).toThrow()
  })
  it('rejects a missing field instead of guessing', () => {
    const { warnings, ...missing } = good
    expect(() => TimingDecision.parse(missing)).toThrow()
  })
})

describe('checkTimingDecision', () => {
  it('passes a decision that cites only what it was shown', () => {
    expect(checkTimingDecision(good, ['e1', 'e2'], [])).toEqual([])
  })
  it('catches invented evidence and rule ids', () => {
    const d = { ...good, reasons: [{ text: 'x', evidenceIds: ['e9'] }], ruleIds: ['r7'] }
    expect(checkTimingDecision(d, ['e1'], ['r1'])).toEqual([
      'cites unknown evidence id "e9"',
      'cites unknown rule id "r7"',
    ])
  })
  it('catches a part size on the wrong option, and a missing one', () => {
    expect(checkTimingDecision({ ...good, partPercent: 50 }, ['e1'], [])).toContain(
      'part size given for WAIT_REOPEN',
    )
    expect(checkTimingDecision({ ...good, option: 'ACT_PART' }, ['e1'], [])).toContain(
      'ACT_PART without a part size',
    )
  })
  it('catches a self-contradiction', () => {
    const d = { ...good, rejected: [{ option: 'WAIT_REOPEN' as const, reason: 'x' }] }
    expect(checkTimingDecision(d, ['e1'], [])).toContain('the chosen option also appears as rejected')
  })
})
