/**
 * Did the desk's balances change in a way the desk itself did not cause?
 *
 * Expected balance = the last snapshot, plus and minus what our own CONFIRMED actions did since. Anything left
 * over came from outside: the owner adding money, the owner withdrawing, or a token arriving. The loss limit is
 * measured against "start value plus net cash flows", so these must move the baseline. Without that, an owner
 * withdrawing half their money would look like a 50% loss and stop the desk.
 *
 * Pure arithmetic over rows. The vault is not compared yet: no desk holds vault shares until sweeps exist.
 */
const PRICE_SCALE = 10n ** 20n

export interface KnownBalances {
  cashUsdg: bigint
  /** Raw token units by lowercase token address. */
  tokens: Record<string, bigint>
}

export interface ConfirmedTrade {
  kind: 'buy' | 'sell'
  token: string
  amountIn: bigint
  actualOut: bigint
}

export interface OutsideChange {
  /** 'USDG' or a lowercase token address. */
  asset: string
  /** Positive arrived, negative left. Raw units of that asset. */
  delta: bigint
  /** The same change in USDG, at the valuation price. This is what moves the loss-limit baseline. */
  usdgValue: bigint
}

export function findOutsideChanges(
  previous: KnownBalances,
  tradesSince: ConfirmedTrade[],
  current: KnownBalances,
  priceE8: Record<string, bigint>,
): OutsideChange[] {
  const expected: KnownBalances = { cashUsdg: previous.cashUsdg, tokens: { ...previous.tokens } }
  for (const t of tradesSince) {
    const token = t.token.toLowerCase()
    const held = expected.tokens[token] ?? 0n
    if (t.kind === 'buy') {
      expected.cashUsdg -= t.amountIn
      expected.tokens[token] = held + t.actualOut
    } else {
      expected.cashUsdg += t.actualOut
      expected.tokens[token] = held - t.amountIn
    }
  }
  const changes: OutsideChange[] = []
  const cashDelta = current.cashUsdg - expected.cashUsdg
  if (cashDelta !== 0n) changes.push({ asset: 'USDG', delta: cashDelta, usdgValue: cashDelta })
  for (const token of new Set([...Object.keys(expected.tokens), ...Object.keys(current.tokens)])) {
    const delta = (current.tokens[token] ?? 0n) - (expected.tokens[token] ?? 0n)
    if (delta !== 0n)
      changes.push({ asset: token, delta, usdgValue: (delta * (priceE8[token] ?? 0n)) / PRICE_SCALE })
  }
  return changes
}

export const netFlowUsdg = (changes: OutsideChange[]) => changes.reduce((sum, c) => sum + c.usdgValue, 0n)
