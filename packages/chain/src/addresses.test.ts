import { isAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { ETH_USD_FEED, UNISWAP_V3, USDG, VAULT } from './addresses'

/**
 * A wrongly cased address is not a typo that fails quietly. viem rejects it, and inside a multicall one bad
 * address fails every call in the batch. That happened on 2026-09-19 with a hand-typed QuoterV2 address.
 * Addresses are produced with `cast to-check-sum-address`, never typed by hand. This test is the guard.
 */
describe('addresses', () => {
  const all = { USDG, VAULT, ETH_USD_FEED, ...UNISWAP_V3 }
  for (const [name, address] of Object.entries(all)) {
    it(`${name} has a valid EIP-55 checksum`, () => {
      expect(isAddress(address, { strict: true })).toBe(true)
    })
  }
})
