/**
 * What the shell shows on every page: who is signed in, what their desks hold, and the ticker. Read on the
 * server from Postgres, so the header needs no chain call and no key.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { desksOfOwner, latestPricePoints, latestValueSnapshot, telegramForDesk, unreadCount } from '@desk/db'
import { errorText } from '@desk/shared'
import type { HeaderTelegram, TickerCell } from '@/components/shell'
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
    const [ticker, desksTotalUsdg, unread, telegram] = await Promise.all([
      tickerCells(),
      signedInAs ? desksTotal(signedInAs) : Promise.resolve(null),
      signedInAs ? unreadCount(db(), signedInAs) : Promise.resolve(0),
      signedInAs ? deskTelegram(signedInAs) : Promise.resolve(null),
    ])
    return { signedInAs, ticker, desksTotalUsdg, unread, telegram }
  } catch (e) {
    console.error(`[shell] ${errorText(e)}`)
    return { signedInAs, ticker: [], desksTotalUsdg: null, unread: 0, telegram: null }
  }
}

/**
 * The owner's open desks at their last check, summed. Null when none has been valued yet: never a false zero. A
 * closed desk is left out: its last snapshot is money that has since moved on, so counting it counts it twice.
 */
async function desksTotal(address: string): Promise<string | null> {
  const desks = (await desksOfOwner(db(), address)).filter((d) => d.lifecycle !== 'closed')
  const snapshots = await Promise.all(desks.map((d) => latestValueSnapshot(db(), d.id)))
  const valued = snapshots.filter((s) => s !== undefined)
  if (valued.length === 0) return null
  return valued.reduce((sum, s) => sum + s.totalUsdg, 0n).toString()
}

/**
 * Telegram for the account menu. The link is kept per desk (UX-PLAN §6), so the menu speaks for the newest desk
 * that is still open: the one an owner with one desk means by "my Telegram". Null with no open desk.
 */
async function deskTelegram(address: string): Promise<HeaderTelegram | null> {
  // Newest first (desksOfOwner's order), so this is the newest desk still open.
  const open = (await desksOfOwner(db(), address)).find((d) => d.lifecycle !== 'closed')
  if (!open) return null
  const { linked } = await telegramForDesk(db(), open.id)
  return { deskId: open.id, linked: linked ? { username: linked.username } : null }
}
