import { describe, expect, it } from 'vitest'
import { gapBps } from './desk'

describe('gapBps', () => {
  // 100 USDG (6 decimals) buys 0.452491 NVDA (18 decimals) while the feed says 222.447 (8 decimals).
  // That is the real reading from Sunday 20 Sep 2026: the pool sat 65 bps under the frozen feed.
  it('reproduces the live reading from 20 Sep', () => {
    expect(gapBps(100_000_000n, 452_491_000_000_000_000n, 22_244_729_849n)).toBe(-65)
  })
  it('is zero when the pool pays exactly the feed price', () => {
    expect(gapBps(222_000_000n, 1_000_000_000_000_000_000n, 22_200_000_000n)).toBe(0)
  })
  it('is positive when the pool is dearer than the feed', () => {
    expect(gapBps(224_220_000n, 1_000_000_000_000_000_000n, 22_200_000_000n)).toBe(100)
  })
  it('refuses nonsense inputs instead of returning a misleading number', () => {
    expect(() => gapBps(1n, 0n, 1n)).toThrow()
    expect(() => gapBps(1n, 1n, 0n)).toThrow()
  })
})
