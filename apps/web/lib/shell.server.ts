/**
 * What the shell shows on every page: who is signed in, what their desks hold, and the ticker. Read on the
 * server from Postgres, so the header needs no chain call and no key.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import {
  currentMandate,
  desksOfOwner,
  latestPricePoints,
  latestValueSnapshot,
  mandateFromRow,
  pendingApprovals,
  telegramForDesk,
  unreadCount,
  valueSnapshotAtOrBefore,
} from '@desk/db'
import { errorText } from '@desk/shared'
import type { HeaderTelegram, TickerCell } from '@/components/shell'
import type { SidebarAgent } from '@/components/shell/app/types'
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
    const [ticker, desksTotalUsdg, unread, telegram, agents] = await Promise.all([
      tickerCells(),
      signedInAs ? desksTotal(signedInAs) : Promise.resolve(null),
      signedInAs ? unreadCount(db(), signedInAs) : Promise.resolve(0),
      signedInAs ? deskTelegram(signedInAs) : Promise.resolve(null),
      signedInAs ? sidebarAgents(signedInAs) : Promise.resolve([]),
    ])
    return { signedInAs, ticker, desksTotalUsdg, unread, telegram, agents }
  } catch (e) {
    console.error(`[shell] ${errorText(e)}`)
    return { signedInAs, ticker: [], desksTotalUsdg: null, unread: 0, telegram: null, agents: [] }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The owner's agents for the sidebar, like channels: what each holds now, how that moved in a day, what it holds
 * (for its logos), and whether it waits on the owner. Closed agents are left out; their record stays readable
 * from Activity.
 */
async function sidebarAgents(address: string): Promise<SidebarAgent[]> {
  const desks = (await desksOfOwner(db(), address)).filter((d) => d.lifecycle !== 'closed')
  return Promise.all(
    desks.map(async (d) => {
      const [now, dayAgo, mandateRow, waiting] = await Promise.all([
        latestValueSnapshot(db(), d.id),
        valueSnapshotAtOrBefore(db(), d.id, new Date(Date.now() - DAY_MS)),
        currentMandate(db(), d.id),
        pendingApprovals(db(), d.id),
      ])
      const mandate = mandateRow ? mandateFromRow(mandateRow) : null
      const symbols = (mandate?.targets.tokens ?? [])
        .slice()
        .sort((a, b) => b.weightBps - a.weightBps)
        .map(
          (t) =>
            APPROVED_TOKENS.find((a) => a.address.toLowerCase() === t.token.toLowerCase())?.symbol ?? '?',
        )
      const value = now?.totalUsdg ?? null
      const before = dayAgo?.totalUsdg ?? null
      return {
        id: d.id,
        slug: d.shareSlug ?? d.id,
        name: d.name ?? 'Agent',
        mode: d.mode,
        state: d.state,
        lifecycle: d.lifecycle,
        valueUsdg: value === null ? null : value.toString(),
        changeBps:
          value !== null && before !== null && before > 0n
            ? Number(((value - before) * 10_000n) / before)
            : null,
        symbols,
        needsYou: waiting.length,
      }
    }),
  )
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
