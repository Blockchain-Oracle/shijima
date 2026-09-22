import { describe, expect, it } from 'vitest'
import { allPriced, findOutsideChanges, netFlowUsdg, scaledBaseline } from './reconcile'

/**
 * A token the mandate dropped and the owner then withdrew has no price this time: nothing values it any more.
 * It must be priced at what it was last valued at, so the withdrawal scales the baseline and the next check
 * does not read the missing value as a loss and stop the desk.
 */
describe('a dropped token withdrawn to zero', () => {
  const X = '0x1111111111111111111111111111111111111111'
  const priceE8 = 500n * 10n ** 8n // $500 a token
  const previous = { cashUsdg: 500_000_000n, tokens: { [X]: 10n ** 18n }, vaultShares: 0n }
  const current = { cashUsdg: 500_000_000n, tokens: {}, vaultShares: 0n }

  it('is priced from the last snapshot and scales the baseline', () => {
    const changes = findOutsideChanges(previous, [], current, {}, 0n, { [X]: priceE8 })
    expect(allPriced(changes)).toBe(true)
    expect(netFlowUsdg(changes)).toBe(-500_000_000n)
    // $1,000 desk, $500 left: the baseline follows the money out, so the loss stays at zero.
    expect(scaledBaseline(1_000_000_000n, 500_000_000n, netFlowUsdg(changes))).toBe(500_000_000n)
  })

  it('with no price at all it is reported unpriced, never as worth nothing', () => {
    const changes = findOutsideChanges(previous, [], current, {}, 0n)
    expect(allPriced(changes)).toBe(false)
  })
})
