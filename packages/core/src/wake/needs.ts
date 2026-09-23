/**
 * What, if anything, would move the desk back toward its mandate. Plain arithmetic, no AI. The model never
 * proposes a trade and never sets a size: it is only ever asked WHEN, about a candidate that came from here.
 *
 * Two things produce a candidate: a holding that drifted past its tolerance, and a standing RULE the owner
 * wrote in advance ("cut Nvidia by half if it falls 3%"). A rule's sale is protective: the owner asked for it,
 * so it goes first and the gate holds it to fewer refusals.
 *
 * No candidates means "nothing to do", with no model call at all. That is the common case.
 *
 * A desk that copies another (`mandate.follow`) raises no drift of its own: its trades are the leader's moves,
 * made by the copy step. Only the owner's protective rules still produce a candidate here.
 */
import type { Mandate, MandateRule } from '@desk/shared'
import { engineCopy } from '@desk/shared'
import type { Candidate } from './types'
import type { HoldingValue, Valuation } from './valuation'

/**
 * Below this an action is not worth its network fee, which the operator pays: about 5 cents a trade. Lowered from
 * $1 to 20 cents on 23 Sep (D3), so an agent started with the free $1 can really trade. The fee is Shijima's cost.
 */
export const MIN_TRADE_USDG = 200_000n
/** At most this many trades are considered in one check. */
export const MAX_CANDIDATES_PER_WAKE = 3
/**
 * A trade must correct a drift worth several times what it costs. Six of the approved tokens cost about 10 bps
 * for a round trip and four cost about 60, because their liquidity sits in the 0.3% tier. Without this, a tight
 * tolerance on an expensive token would have the desk trading away the owner's money in fees.
 */
export const COST_MULTIPLE = 5
/**
 * How far under the per-action cap a sell is sized. The contract values a sell at the larger of what came
 * back and what the oracle says, and both move between sizing and sending.
 */
export const SELL_HEADROOM_BPS = 200
const PRICE_SCALE = 10n ** 20n
const BPS = 10_000n

export interface Need {
  candidate: Candidate
  driftBps: number
  /** The drift this token must exceed before the desk considers acting: the mandate's, or cost-based if larger. */
  thresholdBps: number
  /** True when the full correction was larger than the per-action limit and was cut down to fit. */
  limitedByPerAction: boolean
  /** Set when a standing rule, not drift, produced this candidate. Goes into the record as `need.rule`. */
  rule?: { id: string; kind: MandateRule['kind'] }
}

/** One way cost is half a round trip. The drift must be worth COST_MULTIPLE times that. */
export function thresholdBps(h: HoldingValue, mandate: Mandate): number {
  const oneWayCostBps = h.token.roundTripBps100 / 2
  return Math.max(mandate.driftToleranceBps, Math.ceil(COST_MULTIPLE * oneWayCostBps))
}

const min = (a: bigint, b: bigint) => (a < b ? a : b)

/**
 * A sell is sized off the 30 minute average, but the CONTRACT counts it at the larger of the USDG received and
 * its oracle value. Whenever the oracle sits above that average, a sell sized to exactly the cap is counted as
 * more than the cap and refused on-chain. So a sell leaves headroom, measured against the highest price the
 * contract might use. Without this the desk could propose a sale it can never make, which matters most in a
 * protective one.
 */
export function sellAmountFor(h: HoldingValue, usdg: bigint): bigint {
  const highest = h.feedE8 > h.twapE8 ? h.feedE8 : h.twapE8
  const amount = (usdg * PRICE_SCALE * (BPS - BigInt(SELL_HEADROOM_BPS))) / (highest * BPS)
  return amount > h.balance ? h.balance : amount
}

/**
 * The owner's standing rules that have fired: the token is held, and the pool's 30 minute average sits at least
 * `fallBps` below the reference. `references` holds the reference price per token, 8 decimals, from the same
 * source every decision uses. A token with no reference cannot be judged, so its rule stays quiet.
 */
function ruleNeeds(v: Valuation, mandate: Mandate, cap: bigint, references: Record<string, bigint>): Need[] {
  const needs: Need[] = []
  for (const rule of mandate.rules ?? []) {
    const h = v.holdings.find((x) => x.token.address.toLowerCase() === rule.token.toLowerCase())
    const reference = references[rule.token.toLowerCase()]
    if (!h || h.balance === 0n || h.twapE8 === 0n || !reference || reference <= 0n) continue
    const gapBps = Number(((h.twapE8 - reference) * BPS) / reference)
    if (gapBps > -rule.fallBps) continue
    const fullUsdg = (h.valueUsdg * BigInt(rule.cutBps)) / BPS
    const usdg = min(fullUsdg, cap)
    if (usdg < MIN_TRADE_USDG) continue
    const amountIn = fullUsdg <= cap ? (h.balance * BigInt(rule.cutBps)) / BPS : sellAmountFor(h, usdg)
    if (amountIn === 0n) continue
    needs.push({
      candidate: {
        id: 'c0',
        side: 'sell',
        token: h.token,
        amountIn,
        why: engineCopy.need.rule(rule.id, h.token.displayName, rule.cutBps, rule.fallBps, gapBps),
        protective: true,
        ruleId: rule.id,
      },
      driftBps: h.driftBps,
      thresholdBps: thresholdBps(h, mandate),
      limitedByPerAction: fullUsdg > cap,
      rule: { id: rule.id, kind: rule.kind },
    })
  }
  return needs
}

export function findNeeds(
  v: Valuation,
  mandate: Mandate,
  perActionCapUsdg: bigint,
  references: Record<string, bigint> = {},
): Need[] {
  // The smaller of the owner's mandate and what the chain will actually allow.
  const cap = perActionCapUsdg < mandate.perActionCapUsdg ? perActionCapUsdg : mandate.perActionCapUsdg
  const needs: Need[] = ruleNeeds(v, mandate, cap, references)
  if (mandate.follow) return needs.map((n, i) => ({ ...n, candidate: { ...n.candidate, id: `c${i + 1}` } }))
  const ruled = new Set(needs.map((n) => n.candidate.token.address.toLowerCase()))
  // A buy never takes cash below the mandate's cash target. Cash in the vault counts as cash: a redeem is a
  // later step. What a buy may spend is the cash above that floor, and no more than the loose cash it has.
  const cashFloor = (v.totalUsdg * BigInt(v.cashTargetBps)) / BPS
  const allCash = v.cashUsdg + v.vaultUsdg
  const spendable = allCash > cashFloor ? min(allCash - cashFloor, v.cashUsdg) : 0n

  for (const h of v.holdings) {
    // A rule already decided this token's sale. Drift on the same token would only argue about the size.
    if (ruled.has(h.token.address.toLowerCase())) continue
    const notInMandate = h.targetBps === 0
    const threshold = thresholdBps(h, mandate)
    // A token the mandate no longer names is sold whatever its size. Anything else must be past its threshold.
    if (!notInMandate && Math.abs(h.driftBps) <= threshold) continue
    if (h.driftBps === 0 || h.twapE8 === 0n) continue

    const side = h.driftBps > 0 ? 'sell' : 'buy'
    const fullUsdg = (v.totalUsdg * BigInt(Math.abs(h.driftBps))) / BPS
    let usdg = fullUsdg > cap ? cap : fullUsdg
    if (side === 'buy') usdg = min(usdg, spendable)
    if (usdg < MIN_TRADE_USDG) continue

    // Selling a token the mandate dropped sells the balance itself, so no dust is left behind.
    const sellAll = side === 'sell' && notInMandate && fullUsdg <= cap
    const amountIn = side === 'buy' ? usdg : sellAll ? h.balance : sellAmountFor(h, usdg)
    if (amountIn === 0n) continue

    needs.push({
      candidate: {
        id: 'c0',
        side,
        token: h.token,
        amountIn,
        why: notInMandate
          ? engineCopy.need.dropped(h.token.displayName)
          : engineCopy.need.drifted(h.token.displayName, h.weightBps, h.targetBps, threshold),
      },
      driftBps: h.driftBps,
      thresholdBps: threshold,
      limitedByPerAction: fullUsdg > cap,
    })
  }
  // The owner's own rules first. Then sales, because they free the cash that buys need. Within a side, the
  // largest drift first.
  const rank = (n: Need) => (n.rule ? 0 : n.candidate.side === 'sell' ? 1 : 2)
  return needs
    .sort((a, b) => rank(a) - rank(b) || Math.abs(b.driftBps) - Math.abs(a.driftBps))
    .map((n, i) => ({ ...n, candidate: { ...n.candidate, id: `c${i + 1}` } }))
}
