/**
 * What the shell shows on every page: who is signed in, what their desks hold, and the ticker. Read on the
 * server from Postgres, so the header needs no chain call and no key.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { desksOfOwner, latestPricePoints, latestValueSnapshot } from '@desk/db'
import { errorText } from '@desk/shared'
import type { TickerCell } from '@/components/shell'
import { db } from './db'
import { signedInAddress } from './session'

/** The ten Stock Tokens in the approved list's order, each with its latest logged price. */
export async function tickerCells(): Promise<TickerCell[]> {
  const points = await latestPricePoints(db())
  return APPROVED_TOKENS.flatMap((token) => {
    const p = points.find((row) => row.token.toLowerCase() === token.address.toLowerCase())
    if (!p?.poolMidE8) return []
    return [
      {
        symbol: token.symbol,
        price: `$${(Number(p.poolMidE8) / 1e8).toFixed(2)}`,
        gapBps: p.referenceE8 === null ? null : p.gapBps,
      },
    ]
  })
}

/** Everything the shell needs. A database that does not answer leaves the shell up with nothing in it. */
export async function loadShell() {
  const signedInAs = await signedInAddress().catch(() => undefined)
  try {
    const [ticker, desksTotalUsdg] = await Promise.all([
      tickerCells(),
      signedInAs ? desksTotal(signedInAs) : Promise.resolve(null),
    ])
    return { signedInAs, ticker, desksTotalUsdg }
  } catch (e) {
    console.error(`[shell] ${errorText(e)}`)
    return { signedInAs, ticker: [], desksTotalUsdg: null }
  }
}

/** The owner's desks at their last check, summed. Null when none has been valued yet: never a false zero. */
async function desksTotal(address: string): Promise<string | null> {
  const desks = await desksOfOwner(db(), address)
  const snapshots = await Promise.all(desks.map((d) => latestValueSnapshot(db(), d.id)))
  const valued = snapshots.filter((s) => s !== undefined)
  if (valued.length === 0) return null
  return valued.reduce((sum, s) => sum + s.totalUsdg, 0n).toString()
}
