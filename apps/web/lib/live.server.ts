/**
 * The public proof behind "live on mainnet" (PLAN-ROUND-3 D9, D10). Small numbers are shown as they are: the point
 * of the page is that every one of them can be checked on the explorer.
 */
import { tokenByAddress } from '@desk/chain'
import { latestConfirmedActions, liveCounts } from '@desk/db'
import { currentDeployment } from './chain'
import { db } from './db'

/** Shijima's share of each copy fee (D10). */
const PLATFORM_BPS = 2_000n

export async function liveStats() {
  const [counts, latest] = await Promise.all([liveCounts(db()), latestConfirmedActions(db(), 10)])
  const platform = (counts.feesRaw * PLATFORM_BPS) / 10_000n
  const d = currentDeployment()
  return {
    ...counts,
    movedUsdg: counts.movedRaw.toString(),
    fees: {
      creatorUsdg: (counts.feesRaw - platform).toString(),
      platformUsdg: platform.toString(),
      copies: counts.paidCopies,
    },
    latest: latest.map((a) => ({
      ...a,
      symbol: a.token ? (tokenByAddress(a.token)?.symbol ?? null) : null,
    })),
    contracts: { factory: d.factory, implementation: d.implementation, operator: d.operator },
  }
}

export type LiveStats = Awaited<ReturnType<typeof liveStats>>
