/**
 * Did the desk's balances change in a way the desk itself did not cause?
 *
 * Expected balance = the last snapshot, plus and minus what our own CONFIRMED actions did since. Anything left
 * over came from outside: the owner adding money, the owner withdrawing, or a token arriving. The loss limit is
 * measured against "start value plus net cash flows", so these must move the baseline. Without that, an owner
 * withdrawing half their money would look like a 50% loss and stop the desk.
 *
 * The savings vault is compared in SHARES, never dollars: shares only move when something moves them, while
 * their dollar value grows with interest, and interest is not money arriving from outside.
 *
 * Pure arithmetic over rows.
 */
const PRICE_SCALE = 10n ** 20n

export interface KnownBalances {
  cashUsdg: bigint
  /** Raw token units by lowercase token address. */
  tokens: Record<string, bigint>
  vaultShares: bigint
}

/** One of our own confirmed actions. A sweep's `actualOut` is shares; a redeem's `amountIn` is shares. */
export interface ConfirmedTrade {
  kind: 'buy' | 'sell' | 'sweep' | 'redeem'
  token: string
  amountIn: bigint
  actualOut: bigint
}

/** The name an outside change of vault shares is reported under. */
export const VAULT_ASSET = 'VAULT'

export interface OutsideChange {
  /** 'USDG', 'VAULT' for savings-vault shares, or a lowercase token address. */
  asset: string
  /** Positive arrived, negative left. Raw units of that asset. */
  delta: bigint
  /** The same change in USDG, at the valuation price. This is what moves the loss-limit baseline. */
  usdgValue: bigint
  /**
   * False when this asset had no price this time, so `usdgValue` is not a real number. It happens when a
   * token the mandate no longer names is withdrawn to zero: nothing values it any more. A change we cannot
   * price must never be treated as worth nothing, because that reads as a loss the owner did not take.
   */
  priced: boolean
}

export function findOutsideChanges(
  previous: KnownBalances,
  tradesSince: ConfirmedTrade[],
  current: KnownBalances,
  priceE8: Record<string, bigint>,
  /** What 10^18 vault shares redeem for now, in USDG. Values an outside move of shares. */
  vaultUsdgPerShareE18: bigint,
): OutsideChange[] {
  const expected: KnownBalances = {
    cashUsdg: previous.cashUsdg,
    tokens: { ...previous.tokens },
    vaultShares: previous.vaultShares,
  }
  for (const t of tradesSince) {
    const token = t.token.toLowerCase()
    const held = expected.tokens[token] ?? 0n
    if (t.kind === 'sweep') {
      expected.cashUsdg -= t.amountIn
      expected.vaultShares += t.actualOut
    } else if (t.kind === 'redeem') {
      expected.vaultShares -= t.amountIn
      expected.cashUsdg += t.actualOut
    } else if (t.kind === 'buy') {
      expected.cashUsdg -= t.amountIn
      expected.tokens[token] = held + t.actualOut
    } else {
      expected.cashUsdg += t.actualOut
      expected.tokens[token] = held - t.amountIn
    }
  }
  const changes: OutsideChange[] = []
  const cashDelta = current.cashUsdg - expected.cashUsdg
  // USDG is the unit of account, so its own value never needs a price.
  if (cashDelta !== 0n) changes.push({ asset: 'USDG', delta: cashDelta, usdgValue: cashDelta, priced: true })
  const sharesDelta = current.vaultShares - expected.vaultShares
  if (sharesDelta !== 0n) {
    changes.push({
      asset: VAULT_ASSET,
      delta: sharesDelta,
      usdgValue: (sharesDelta * vaultUsdgPerShareE18) / 10n ** 18n,
      priced: vaultUsdgPerShareE18 > 0n,
    })
  }
  for (const token of new Set([...Object.keys(expected.tokens), ...Object.keys(current.tokens)])) {
    const delta = (current.tokens[token] ?? 0n) - (expected.tokens[token] ?? 0n)
    if (delta === 0n) continue
    const price = priceE8[token]
    changes.push({
      asset: token,
      delta,
      usdgValue: price ? (delta * price) / PRICE_SCALE : 0n,
      priced: Boolean(price),
    })
  }
  return changes
}

export const netFlowUsdg = (changes: OutsideChange[]) => changes.reduce((sum, c) => sum + c.usdgValue, 0n)

/** True when every change could be valued. If not, the desk's worth is not fully known this check. */
export const allPriced = (changes: OutsideChange[]) => changes.every((c) => c.priced)

/**
 * Where the loss-limit baseline moves to after money has come in or gone out.
 *
 * It SCALES, it does not add. Adding was wrong in both directions: withdrawing while the desk was down made
 * the remaining loss look bigger and could stop the desk over the owner's own withdrawal, and withdrawing
 * after gains could push the baseline to zero and switch the limit off entirely. Scaling keeps the loss
 * exactly where it was, which is the only thing a deposit or a withdrawal should do to it.
 */
export function scaledBaseline(baseline: bigint, totalNow: bigint, netFlow: bigint): bigint {
  if (netFlow === 0n) return baseline
  const before = totalNow - netFlow
  // A first deposit: there is no ratio to keep, so the baseline is what the desk is worth now.
  // Withdrawing everything leaves a baseline of nothing, which is right: an empty desk has nothing left to
  // lose and must not be stopped by a loss limit. A later deposit sets a fresh baseline here.
  if (before <= 0n || baseline <= 0n) return totalNow
  return (baseline * totalNow) / before
}
