/**
 * Hard blockers, decided by code BEFORE the model is asked anything. Each one names its rule, so the record
 * says exactly why the desk will not touch a token. A blocked candidate costs no model call.
 *
 * The desk does not act on facts it cannot verify: an unknown halt flag blocks, and so does missing news for
 * an ordinary rebalance. A protective sale, one the owner's own rule demanded, is not held up by missing news.
 */

import { engineCopy } from '@desk/shared'
import type { MarketRead } from './market'
import type { Candidate } from './types'

/** The price this instant against its own 30 minute average. Beyond this, someone is pushing the pool. */
export const MOVING_FAST_BPS = 100

/** The contract refuses a feed older than this. Wall clock, because that is what the contract measures. */
const MAX_FEED_AGE_S = 6 * 24 * 60 * 60
/** The desk does not buy this close to a company's report. The owner's own sell is never held up by it. */
export const EVENT_WINDOW_DAYS = 2

export interface Blocker {
  rule:
    | 'DESK_NOT_ACTIVE'
    | 'TRADING_HALTED'
    | 'HALT_UNKNOWN'
    | 'ORACLE_PAUSED'
    | 'FEED_UNAVAILABLE'
    | 'BEYOND_PRICE_BAND'
    | 'NEWS_UNAVAILABLE'
    | 'PRICE_MOVING_FAST'
    | 'TOKEN_NOT_ALLOWED'
    | 'POOL_MISMATCH'
    | 'DID_THIS_MINUTES_AGO'
    | 'EVENT_WINDOW'
    | 'LOSS_LIMIT'
    | 'COPY_MISSED'
    | 'MINIMUM_TRADE'
    | 'CASH_RESERVE'
    | 'ACTION_LIMIT'
    | 'PRICE_UNAVAILABLE'
  text: string
}

export function pregate(input: {
  candidate: Candidate
  market: MarketRead
  deskActive: boolean
  deskStateText: string
  /** The quote is beyond the contract's 8% band, as the gate worked out. */
  beyondBand: boolean
  /** How the owner configured this token on the desk contract. */
  onChain: { fee: number; enabled: boolean }
  /** The desk already did this same thing to this same token a few minutes ago. */
  repeatedWithinMinutes: boolean
  protective: boolean
}): Blocker[] {
  const { market: m, candidate: c } = input
  const name = c.token.displayName
  const blockers: Blocker[] = []
  const block = (rule: Blocker['rule'], text: string) => blockers.push({ rule, text })
  const copy = engineCopy.blocker

  if (!input.deskActive) block('DESK_NOT_ACTIVE', copy.deskNotActive(input.deskStateText))
  if (input.onChain.fee === 0 || (c.side === 'buy' && !input.onChain.enabled)) {
    block('TOKEN_NOT_ALLOWED', copy.tokenNotAllowed(name))
  } else if (input.onChain.fee !== c.token.pinnedFee) {
    // Our quote, floor and price all come from the approved pool. The contract would trade through another.
    block('POOL_MISMATCH', copy.poolMismatch(name))
  }
  if (input.repeatedWithinMinutes) block('DID_THIS_MINUTES_AGO', copy.didThisMinutesAgo(name))
  if (m.halt === undefined) block('HALT_UNKNOWN', copy.haltUnknown(name))
  else if (m.halt.isTradingHalt) block('TRADING_HALTED', copy.tradingHalted(name))
  if (m.oraclePaused) block('ORACLE_PAUSED', copy.oraclePaused(name))
  if (m.feed.price <= 0n || m.at.getTime() / 1000 - m.feed.updatedAt > MAX_FEED_AGE_S) {
    block('FEED_UNAVAILABLE', copy.feedUnavailable(name))
  }
  if (input.beyondBand) block('BEYOND_PRICE_BAND', copy.beyondPriceBand(name))
  if (m.movingBps >= MOVING_FAST_BPS) block('PRICE_MOVING_FAST', copy.movingFast(name, m.movingBps))
  if (m.headlines === undefined && !input.protective) block('NEWS_UNAVAILABLE', copy.newsUnavailable(name))
  const e = m.event
  if (
    c.side === 'buy' &&
    e &&
    e.eventKind === 'earnings' &&
    e.daysAway >= 0 &&
    e.daysAway <= EVENT_WINDOW_DAYS
  )
    block('EVENT_WINDOW', copy.eventWindow(name, e.eventDate))
  return blockers
}
