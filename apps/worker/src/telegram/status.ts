/**
 * The pinned message's contents, built from the desk's current state.
 *
 * One builder, used by three callers: the check that just finished, a chat that has only just linked, and
 * /status. They must never disagree, and building it at send time rather than at decide time means the pinned
 * message can never be a sentence that was true an hour ago.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { currentMandate, type Db, deskById, deskRecord, latestValueSnapshot, spentSince } from '@desk/db'
import { comparedTo, engineCopy, marketClock, newYorkTime, nextRegularOpen, usd } from '@desk/shared'

const MODES = { shadow: 'Practice', ask_first: 'Ask first', on_its_own: 'On its own' } as const
const DAY_MS = 24 * 60 * 60 * 1000

export type StatusArgs = Parameters<typeof import('@desk/shared').telegramCopy.status>[0]

/** undefined when the desk has never checked, which is the one case worth saying plainly instead. */
export async function buildStatus(db: Db, deskId: string, now = new Date()): Promise<StatusArgs | undefined> {
  const [desk, mandate, recent, snapshot] = await Promise.all([
    deskById(db, deskId),
    currentMandate(db, deskId),
    deskRecord(db, deskId, { limit: 1 }),
    latestValueSnapshot(db, deskId),
  ])
  const last = recent[0]
  if (!desk || !last) return undefined

  const spent = await spentSince(db, deskId, new Date(now.getTime() - DAY_MS))
  const name = (address: string) =>
    APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.displayName ?? address

  // Only what the desk actually holds, said the way the owner reads a price: in line, or how far off.
  const holdings = (snapshot?.holdings ?? [])
    .filter((h) => BigInt(h.amountRaw) > 0n)
    .map((h) =>
      h.gapToFeedBps === undefined
        ? `${name(h.token)} ${usd(BigInt(h.valueUsdg))}`
        : `${name(h.token)} ${comparedTo(h.gapToFeedBps)}`,
    )

  const clock = marketClock(now)
  const nextCheck = new Date(now.getTime() + 60 * 60 * 1000)
  nextCheck.setUTCMinutes(0, 0, 0)

  return {
    mode: MODES[desk.mode],
    state: engineCopy.deskState[desk.state],
    lastCheck: last.decidedAt.toISOString().slice(11, 16),
    lastResult: last.summary,
    holdings,
    value: snapshot ? usd(snapshot.totalUsdg) : '—',
    cash: snapshot ? usd(snapshot.cashUsdg) : '—',
    spentToday: usd(spent),
    dailyCap: mandate ? usd(mandate.dailyCapUsdg) : '—',
    nextCheck: nextCheck.toISOString().slice(11, 16),
    market:
      clock.session === 'regular'
        ? 'The US market is open.'
        : `The US market reopens ${newYorkTime(nextRegularOpen(now))}.`,
  }
}
