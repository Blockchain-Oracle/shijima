import type { ApprovedToken } from '@desk/chain'
import type { Mandate } from '@desk/shared'
import { describe, expect, it } from 'vitest'
import { findNeeds } from './needs'
import type { HoldingValue, Valuation } from './valuation'

/**
 * The protective rule is the demo: "cut Nvidia by half if it falls 3%". A 3% fall with a 3% drift tolerance
 * is not a drift, so without the rule the desk does nothing; with it, arithmetic proposes the sale.
 */
const NVDA: ApprovedToken = {
  address: '0x1111111111111111111111111111111111111111',
  symbol: 'NVDA',
  displayName: 'Nvidia',
  feed: '0x2222222222222222222222222222222222222222',
  pinnedFee: 500,
  roundTripBps100: 10,
} as unknown as ApprovedToken

const E8 = 10n ** 8n
const USDG = 1_000_000n

function holding(twapE8: bigint, balanceTokens: bigint, totalUsdg: bigint, targetBps: number): HoldingValue {
  const balance = balanceTokens * 10n ** 18n
  const valueUsdg = (balance * twapE8) / 10n ** 20n
  const weightBps = Number((valueUsdg * 10_000n) / totalUsdg)
  return {
    token: NVDA,
    balance,
    twapE8,
    spotE8: twapE8,
    feedE8: twapE8,
    feedUpdatedAt: 0,
    valueUsdg,
    weightBps,
    targetBps,
    driftBps: weightBps - targetBps,
    gapToFeedBps: 0,
  }
}

const mandate: Mandate = {
  preset: null,
  targets: { cashBps: 6000, tokens: [{ token: NVDA.address, weightBps: 4000 }] },
  driftToleranceBps: 300,
  maxPositionBps: 5000,
  perActionCapUsdg: 10_000n * USDG,
  dailyCapUsdg: 50_000n * USDG,
  lossStopBps: 1500,
  largeActionUsdg: 100_000n * USDG,
  notes: '',
}

describe('the owner’s standing rule', () => {
  // $10,000 desk: 4 NVDA at $970 (down 3% from a $1,000 reference) is $3,880, 38.8% of $10,000 against 40%.
  const reference = 1000n * E8
  const twap = 970n * E8
  const total = 10_000n * USDG
  const v: Valuation = {
    at: new Date('2026-09-20T12:00:00Z'),
    totalUsdg: total,
    cashUsdg: total - (4n * 10n ** 18n * twap) / 10n ** 20n,
    vaultUsdg: 0n,
    cashWeightBps: 6120,
    cashTargetBps: 6000,
    holdings: [holding(twap, 4n, total, 4000)],
    unpriced: [],
  }
  const references = { [NVDA.address.toLowerCase()]: reference }

  it('a 3% fall inside a 3% tolerance is no candidate without a rule', () => {
    expect(findNeeds(v, mandate, 10_000n * USDG, references)).toEqual([])
  })

  it('with the rule, arithmetic proposes a protective sale of half', () => {
    const withRule: Mandate = {
      ...mandate,
      rules: [{ id: 'rule1', kind: 'price_move_sell', token: NVDA.address, fallBps: 300, cutBps: 5000 }],
    }
    const [need, ...rest] = findNeeds(v, withRule, 10_000n * USDG, references)
    expect(rest).toEqual([])
    expect(need?.candidate.side).toBe('sell')
    expect(need?.candidate.protective).toBe(true)
    expect(need?.candidate.ruleId).toBe('rule1')
    expect(need?.rule).toEqual({ id: 'rule1', kind: 'price_move_sell' })
    expect(need?.candidate.amountIn).toBe(2n * 10n ** 18n)
    // Without a reference the rule cannot be judged, so it stays quiet rather than firing on a guess.
    expect(findNeeds(v, withRule, 10_000n * USDG, {})).toEqual([])
  })

  it('a buy never takes cash below the mandate’s cash target', () => {
    // Nvidia at 30% against a 40% target wants $1,000, but cash is $7,000 against a $6,000 target: $1,000 is
    // spendable. With a $6,500 target only $500 is.
    const price = 750n * E8
    const desk: Valuation = {
      ...v,
      cashUsdg: total - (4n * 10n ** 18n * price) / 10n ** 20n,
      cashWeightBps: 7000,
      holdings: [holding(price, 4n, total, 4000)],
    }
    const [buy] = findNeeds(desk, mandate, 10_000n * USDG)
    expect(buy?.candidate.side).toBe('buy')
    expect(buy?.candidate.amountIn).toBe(1_000n * USDG)
    const tighter: Mandate = { ...mandate, targets: { ...mandate.targets, cashBps: 6500 } }
    const [capped] = findNeeds({ ...desk, cashTargetBps: 6500 }, tighter, 10_000n * USDG)
    expect(capped?.candidate.amountIn).toBe(500n * USDG)
  })
})
