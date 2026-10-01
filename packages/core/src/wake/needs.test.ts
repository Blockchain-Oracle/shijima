import type { ApprovedToken } from '@desk/chain'
import type { Mandate } from '@desk/shared'
import { describe, expect, it } from 'vitest'
import { findNeeds, minimumBuyFunding, qualificationOf } from './needs'
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

describe('qualification at the starter-balance boundary', () => {
  const plan: Mandate = {
    ...mandate,
    targets: { cashBps: 2000, tokens: [{ token: NVDA.address, weightBps: 2000 }] },
  }
  const empty = (total: bigint, cash: bigint): Valuation => ({
    at: new Date('2026-10-01T18:00:00Z'),
    totalUsdg: total,
    cashUsdg: cash,
    vaultUsdg: 0n,
    cashWeightBps: Number((cash * 10000n) / total),
    cashTargetBps: 2000,
    holdings: [holding(E8, 0n, total, 2000)],
    unpriced: [],
  })

  it('reports an off-target holding below the minimum instead of claiming it is within range', () => {
    const v = empty(999497n, 399935n)
    expect(findNeeds(v, plan, plan.perActionCapUsdg)).toEqual([])
    const q = qualificationOf(v, plan, plan.perActionCapUsdg)
    expect(q.eligibleSymbols).toEqual([])
    expect(q.excluded[0]?.rule).toBe('MINIMUM_TRADE')
    expect(q.summary).toContain('$0.199899')
    expect(q.summary).not.toContain('within its allowed range')
  })

  it('distinguishes the cash reserve when the target itself meets the minimum', () => {
    const v = empty(1000399n, 399935n)
    const q = qualificationOf(v, plan, plan.perActionCapUsdg)
    expect(findNeeds(v, plan, plan.perActionCapUsdg)).toEqual([])
    expect(q.excluded[0]?.rule).toBe('CASH_RESERVE')
    expect(q.summary).toContain('$0.199856')
  })

  it('keeps the same minimum-sized candidate once both target and cash qualify', () => {
    const v = empty(1000000n, 400000n)
    const [need] = findNeeds(v, plan, plan.perActionCapUsdg)
    expect(need?.candidate.amountIn).toBe(200000n)
    expect(qualificationOf(v, plan, plan.perActionCapUsdg)).toMatchObject({
      eligibleSymbols: ['NVDA'],
      excluded: [],
    })
  })

  it('reports a cap that funding cannot resolve', () => {
    const q = qualificationOf(empty(1000000n, 400000n), plan, 100000n)
    expect(q.excluded[0]?.rule).toBe('ACTION_LIMIT')
    expect(q.summary).toContain('$0.1')
  })

  it('uses the within-range reason only for a holding actually within tolerance', () => {
    const v = {
      ...empty(1000000n, 800000n),
      holdings: [{ ...holding(E8, 0n, 1000000n, 2000), valueUsdg: 200000n, weightBps: 2000, driftBps: 0 }],
    }
    expect(qualificationOf(v, plan, plan.perActionCapUsdg)).toMatchObject({
      excluded: [],
      eligibleSymbols: [],
    })
    expect(qualificationOf(v, plan, plan.perActionCapUsdg).summary).toContain('within its allowed range')
  })
})

describe('actionable funding estimates', () => {
  const input = {
    total: 999497n,
    cash: 399935n,
    vault: 0n,
    held: 0n,
    targetBps: 2000,
    cashBps: 2000,
    cap: USDG,
  }
  it('rounds both observed sub-cent blocks up to one cent', () => {
    expect(minimumBuyFunding(input)).toBe(10000n)
    expect(minimumBuyFunding({ ...input, total: 1000399n })).toBe(10000n)
  })
  it('accounts for an existing holding when calculating the correction', () => {
    // $1 total, $0.10 already held at a 20% target: reaching a $0.20 correction requires $0.50 more.
    expect(minimumBuyFunding({ ...input, total: USDG, cash: 900000n, held: 100000n })).toBe(500000n)
  })
  it('does not ask for new funding when vault cash can cover the buy', () => {
    expect(minimumBuyFunding({ ...input, total: 2000000n, cash: 100000n, vault: 700000n })).toBe(0n)
  })
  it('returns zero for an already executable buy and no funding solution for an undersized cap', () => {
    expect(minimumBuyFunding({ ...input, total: USDG, cash: 400000n })).toBe(0n)
    expect(minimumBuyFunding({ ...input, cap: 199999n })).toBeNull()
  })
})
