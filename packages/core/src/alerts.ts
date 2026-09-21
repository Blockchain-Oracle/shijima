/**
 * Price alerts: "tell me when Nvidia is 2% from its reference".
 *
 * One set of checks for both ways in, the stock page's form and the chat's card, so they can never disagree
 * about what is allowed. The price logger fires them: after it writes a slot, every waiting alert is compared
 * with the newest row for its token, and one that has crossed fires once, with its message, in one transaction.
 */
import type { ApprovedToken } from '@desk/chain'
import {
  activeAlertCount,
  activeAlertsOnTokens,
  createPriceAlert,
  type Db,
  firePriceAlert,
  latestPricePoints,
  MAX_ACTIVE_ALERTS,
  type PriceAlertKind,
} from '@desk/db'
import { alertsCopy, newYorkTime } from '@desk/shared'

export type AlertDirection = 'above' | 'below' | 'either'

export const ALERT_KIND: Record<AlertDirection, PriceAlertKind> = {
  above: 'above_reference',
  below: 'below_reference',
  either: 'either_way',
}
const DIRECTION: Record<PriceAlertKind, AlertDirection> = {
  above_reference: 'above',
  below_reference: 'below',
  either_way: 'either',
}
export const directionOf = (kind: PriceAlertKind): AlertDirection => DIRECTION[kind]

/** A quarter of a percent at least: below half a percent a gap is noise, and an alert there would fire at once. */
export const MIN_ALERT_BPS = 25
export const MAX_ALERT_BPS = 5000

export const pctText = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`

export type AlertCheck =
  | { ok: true; token: ApprovedToken; kind: PriceAlertKind; direction: AlertDirection; thresholdBps: number }
  | { ok: false; why: string }

/** The plain checks, before anything is saved. Counting what the owner already has needs the database. */
export function checkAlertInput(
  input: { symbol: string; direction: string; thresholdBps: number },
  approved: ApprovedToken[],
): AlertCheck {
  const token = approved.find((t) => t.symbol === input.symbol.toUpperCase())
  if (!token) return { ok: false, why: alertsCopy.refused.token }
  const direction = input.direction as AlertDirection
  if (!(direction in ALERT_KIND)) return { ok: false, why: alertsCopy.refused.range }
  const bps = Math.round(input.thresholdBps)
  if (!Number.isFinite(bps) || bps < MIN_ALERT_BPS || bps > MAX_ALERT_BPS)
    return { ok: false, why: alertsCopy.refused.range }
  return { ok: true, token, kind: ALERT_KIND[direction], direction, thresholdBps: bps }
}

/** True when this gap has reached the alert. */
export function alertReached(kind: PriceAlertKind, thresholdBps: number, gapBps: number): boolean {
  if (kind === 'above_reference') return gapBps >= thresholdBps
  if (kind === 'below_reference') return gapBps <= -thresholdBps
  return Math.abs(gapBps) >= thresholdBps
}

/** Saves an alert after the checks, including the owner's limit on how many may wait at once. */
export async function setPriceAlert(
  db: Db,
  approved: ApprovedToken[],
  input: { ownerAddress: string; deskId: string; symbol: string; direction: string; thresholdBps: number },
): Promise<{ ok: true; id: string } | { ok: false; why: string }> {
  const check = checkAlertInput(input, approved)
  if (!check.ok) return check
  if ((await activeAlertCount(db, input.ownerAddress)) >= MAX_ACTIVE_ALERTS)
    return { ok: false, why: alertsCopy.refused.tooMany(MAX_ACTIVE_ALERTS) }
  const id = await createPriceAlert(db, {
    ownerAddress: input.ownerAddress,
    deskId: input.deskId,
    token: check.token.address,
    kind: check.kind,
    thresholdBps: check.thresholdBps,
  })
  return { ok: true, id }
}

/** A price row older than this is not "now", so it never fires an alert. */
const FRESH_MS = 15 * 60 * 1000

const dollars = (e8: bigint) => `$${(Number(e8) / 1e8).toFixed(2)}`

/**
 * Fires every waiting alert whose token's newest price has reached it. Returns how many fired. Safe to run as
 * often as you like: an alert fires once, and the message is queued in the same transaction.
 */
export async function checkPriceAlerts(db: Db, approved: ApprovedToken[], now = new Date()): Promise<number> {
  const latest = await latestPricePoints(db)
  const fresh = latest.filter((r) => now.getTime() - r.at.getTime() <= FRESH_MS && r.referenceE8 !== null)
  const alerts = await activeAlertsOnTokens(
    db,
    fresh.map((r) => r.token),
  )
  let fired = 0
  for (const alert of alerts) {
    const row = fresh.find((r) => r.token === alert.token)
    const token = approved.find((t) => t.address.toLowerCase() === alert.token)
    if (!row || !token || row.gapBps === null || row.poolMidE8 === null || row.referenceE8 === null) continue
    if (!alertReached(alert.kind, alert.thresholdBps, row.gapBps)) continue
    const gap = `${pctText(Math.abs(row.gapBps))} ${row.gapBps >= 0 ? 'above' : 'below'}`
    const reference =
      row.referenceKind === 'last_regular_close' && row.referenceAt
        ? `${dollars(row.referenceE8)} at the last regular close, ${newYorkTime(row.referenceAt)}`
        : `${dollars(row.referenceE8)}, the last official update`
    const text = alertsCopy.message(
      token.displayName,
      gap,
      dollars(row.poolMidE8),
      reference,
      pctText(alert.thresholdBps),
    )
    if (await firePriceAlert(db, alert, row.gapBps, { text, symbol: token.symbol }, now)) fired++
  }
  return fired
}
