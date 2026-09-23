import { isAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { FEE_TIERS } from './addresses'
import { APPROVED_TOKENS, tokenByAddress } from './tokens'

describe('approved token list', () => {
  it('has about ten names, all with valid checksummed addresses, feeds and pools', () => {
    expect(APPROVED_TOKENS.length).toBeGreaterThanOrEqual(8)
    expect(APPROVED_TOKENS.length).toBeLessThanOrEqual(16) // Desk.sol caps the on-chain list at 16
    for (const t of APPROVED_TOKENS) {
      for (const a of [t.address, t.feed, t.pool]) expect(isAddress(a, { strict: true })).toBe(true)
      expect(FEE_TIERS).toContain(t.pinnedFee)
      expect(t.feedDecimals).toBe(8)
      expect(t.decimals).toBe(18)
    }
  })
  it('never pins a thin pool, and always has room for a 30 minute average', () => {
    for (const t of APPROVED_TOKENS) {
      expect(t.usdgInPool).toBeGreaterThanOrEqual(100_000)
      expect(t.observationCardinality).toBeGreaterThanOrEqual(30)
      expect(t.roundTripBps1000).toBeLessThanOrEqual(75)
    }
  })
  it('contains both index funds, which "The whole US market" preset depends on', () => {
    const symbols = APPROVED_TOKENS.map((t) => t.symbol)
    expect(symbols).toContain('SPY')
    expect(symbols).toContain('QQQ')
  })
  it('has no duplicate addresses and looks up case-insensitively', () => {
    const set = new Set(APPROVED_TOKENS.map((t) => t.address.toLowerCase()))
    expect(set.size).toBe(APPROVED_TOKENS.length)
    const first = APPROVED_TOKENS[0]
    expect(first && tokenByAddress(first.address.toUpperCase().replace('0X', '0x'))?.symbol).toBe(
      first?.symbol,
    )
  })
})
