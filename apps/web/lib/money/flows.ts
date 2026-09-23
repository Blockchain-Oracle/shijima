/**
 * Change in value NET of the owner's own money moving. Each value snapshot carries `flowsUsdg`, the running total of
 * money in minus money out; the part of a change the agent itself made is the change in value minus the change in
 * that total. So taking $2 out of a $5.79 agent reads as $0.00, not -34.6%.
 */

export interface FlowPoint {
  totalUsdg: bigint
  flowsUsdg: bigint
}

/** What the agent itself gained or lost between two snapshots, in USDG raw units. */
export const netChangeUsdg = (now: FlowPoint, then: FlowPoint): bigint =>
  now.totalUsdg - then.totalUsdg - (now.flowsUsdg - then.flowsUsdg)

/**
 * The same as a share, in basis points, of what was at work: the starting value plus any money added since (money
 * taken out is not subtracted, so a withdrawal never inflates the percentage). Null when nothing was at work.
 */
export function netChangeBps(now: FlowPoint, then: FlowPoint): number | null {
  const added = now.flowsUsdg - then.flowsUsdg
  const base = then.totalUsdg + (added > 0n ? added : 0n)
  if (base <= 0n) return null
  return Number((netChangeUsdg(now, then) * 10_000n) / base)
}

/**
 * A value series with the owner's own money moves taken out, in dollars, ending at the latest real value: a
 * sparkline of it shows what the agent did, not a cliff where money was withdrawn.
 */
export function netSeries(rows: FlowPoint[]): number[] {
  const last = rows.at(-1)?.flowsUsdg ?? 0n
  return rows.map((r) => Number(r.totalUsdg - r.flowsUsdg + last) / 1e6)
}
