import { keccak256, toBytes } from 'viem'
import { describe, expect, it } from 'vitest'
import { TIMING_PROMPT_VERSION, TIMING_PROMPTS, TIMING_SYSTEM_PROMPT, TIMING_V1 } from './timing'

/**
 * The system prompt is SERV's cache key, and every stored record names the prompt version it was made with.
 * If this test fails you edited the prompt in place. Do not update the hash. Add a new version instead,
 * and keep the old text so old records stay explainable.
 */
describe('timing prompt', () => {
  it('timing.v1 is frozen byte for byte', () => {
    expect(keccak256(toBytes(TIMING_V1))).toBe(
      '0x7f9736d2f49d18066e376afe13efc716a61839fdf6a179d950dd3910b9e77256',
    )
  })
  it('timing.v2 is frozen byte for byte, and is the version in use', () => {
    expect(TIMING_PROMPT_VERSION).toBe('timing.v2')
    expect(TIMING_SYSTEM_PROMPT).toBe(TIMING_PROMPTS['timing.v2'])
    expect(keccak256(toBytes(TIMING_SYSTEM_PROMPT))).toBe(
      '0xa426e979372f1543f7ff64acb08dd8beb3918b61abe3f4715024330c02711300',
    )
  })
  it('contains nothing that varies per owner or per moment', () => {
    expect(TIMING_SYSTEM_PROMPT).not.toMatch(/0x[0-9a-fA-F]{40}/) // no addresses
    expect(TIMING_SYSTEM_PROMPT).not.toMatch(/\b20\d\d-\d\d-\d\d\b/) // no dates
    expect(TIMING_SYSTEM_PROMPT).not.toMatch(/\$\d/) // no dollar amounts
  })
  it('uses the required vocabulary', () => {
    expect(TIMING_SYSTEM_PROMPT).toContain('Stock Tokens')
    expect(TIMING_SYSTEM_PROMPT).toContain('last official update')
  })
})
