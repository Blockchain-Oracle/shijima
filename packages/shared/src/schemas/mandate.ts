/**
 * The mandate: WHAT the owner wants held, and the limits the desk must stay inside. The owner writes it. The
 * desk never invents a position. It decides only when.
 *
 * Weights are basis points of the whole desk and, with cash, total exactly 10000. Money is bigint USDG with
 * 6 decimals. Tokens are named by contract address, never by symbol.
 */
import { z } from 'zod'

const Bps = z.number().int().min(0).max(10_000)
const TokenAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a contract address')

export const MandateTargets = z.object({
  cashBps: Bps,
  tokens: z.array(z.object({ token: TokenAddress, weightBps: Bps.min(1) })),
})
export type MandateTargets = z.infer<typeof MandateTargets>

export const Mandate = z.object({
  preset: z.string().nullable(),
  targets: MandateTargets,
  /** How far a holding's share may wander from its target before the desk considers acting. */
  driftToleranceBps: Bps,
  /** The most any single holding may be, as a share of the desk. */
  maxPositionBps: Bps,
  /** The most the desk may spend in one action, and in one day. The chain enforces its own copies too. */
  perActionCapUsdg: z.bigint().positive(),
  dailyCapUsdg: z.bigint().positive(),
  /** If the desk's value falls this far below its baseline, everything stops. */
  lossStopBps: Bps,
  /** At or above this size the desk asks first, even in "on its own" mode. */
  largeActionUsdg: z.bigint().positive(),
  /** The owner's own words. Compiled into rules by the mandate read-back. */
  notes: z.string().max(2000),
})
export type Mandate = z.infer<typeof Mandate>

/**
 * Everything a schema cannot say on its own. Returns plain sentences, naming tokens the way the owner knows
 * them. Empty means the mandate holds together.
 */
export function checkMandate(m: Mandate, approved: { address: string; displayName: string }[]): string[] {
  const problems: string[] = []
  const names = new Map(approved.map((t) => [t.address.toLowerCase(), t.displayName]))
  const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`
  const seen = new Set<string>()
  let total = m.targets.cashBps
  for (const t of m.targets.tokens) {
    const address = t.token.toLowerCase()
    const name = names.get(address)
    if (!name) {
      problems.push(`${t.token} is not on the approved list`)
    } else {
      if (seen.has(address)) problems.push(`${name} is listed twice`)
      if (t.weightBps > m.maxPositionBps) {
        problems.push(
          `${name} has a target of ${pct(t.weightBps)}, above the largest holding you allow (${pct(m.maxPositionBps)})`,
        )
      }
    }
    seen.add(address)
    total += t.weightBps
  }
  if (total !== 10_000) problems.push(`the targets and cash add up to ${pct(total)}, not 100%`)
  if (m.dailyCapUsdg < m.perActionCapUsdg) problems.push('the daily limit is below the per-action limit')
  if (m.driftToleranceBps === 0)
    problems.push('a tolerance of zero would make the desk trade on every wobble')
  if (m.lossStopBps === 0) problems.push('a loss limit of zero would stop the desk at once')
  return problems
}
