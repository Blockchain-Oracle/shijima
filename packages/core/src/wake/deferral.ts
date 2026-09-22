/**
 * "Wait" is remembered. Once the desk has decided to wait for the reopen, it does not put the same question to
 * the model again every hour. The wait stands until the reopen, or until something MEASURABLE changes. Every
 * test here is arithmetic, so a standing wait costs no model call and reads "still waiting (decided 02:00)".
 */

import { engineCopy } from '@desk/shared'
import { MIN_TRADE_USDG } from './needs'

export const GAP_MOVE_BPS = 100

/**
 * The numbers a remembered decision was made on. Later hours are compared against these.
 *
 * `wait`        the model said wait for the reopen.
 * `would_have`  SHADOW ONLY. The desk would have acted. A live desk would have traded once and then had nothing
 *               to do. A shadow desk changes nothing, so without this memory it would "would have" the same
 *               trade every hour. Remembering it makes shadow read the way live would: once, then quiet.
 */
export interface DeferralBaseline {
  kind: 'wait' | 'would_have'
  decisionSeq: number
  decidedAt: string
  gapBps: number
  driftBps: number
  cashUsdg: string
  headlineHashes: string[]
}

/** A headline as the wait sees it now: its hash, and when it was published. */
export interface HeadlineNow {
  hash: string
  publishedAt: string
}

export interface DeferralNow {
  at: Date
  gapBps: number
  driftBps: number
  cashUsdg: bigint
  headlines: HeadlineNow[]
}

/** null means it still stands. Otherwise how it ended, in words for the record. */
export function whyDeferralEnds(
  baseline: DeferralBaseline,
  now: DeferralNow,
  revisitAt: Date,
  toleranceBps: number,
): { status: 'revisited' | 'broken'; reason: string } | null {
  if (now.at >= revisitAt) {
    return { status: 'revisited', reason: engineCopy.remembered.reopened }
  }
  if (now.cashUsdg >= BigInt(baseline.cashUsdg) + MIN_TRADE_USDG) {
    return { status: 'broken', reason: engineCopy.remembered.cashArrived }
  }
  // A live desk that had already traded would not trade again because the price moved or news came out.
  if (baseline.kind === 'would_have') return null

  const gapMove = Math.abs(now.gapBps - baseline.gapBps)
  if (gapMove >= GAP_MOVE_BPS) {
    return {
      status: 'broken',
      reason: engineCopy.remembered.gapMoved(gapMove),
    }
  }
  const driftGrowth = Math.abs(now.driftBps) - Math.abs(baseline.driftBps)
  if (driftGrowth >= toleranceBps / 2) {
    return { status: 'broken', reason: engineCopy.remembered.driftGrew(driftGrowth) }
  }
  // A headline is new only when the wait had not seen it AND it was published after the wait was decided. A
  // wait made while news was unavailable saw nothing, and older headlines returning with the feed are not news.
  const known = new Set(baseline.headlineHashes)
  const decidedAt = new Date(baseline.decidedAt).getTime()
  if (now.headlines.some((h) => !known.has(h.hash) && new Date(h.publishedAt).getTime() > decidedAt)) {
    return { status: 'broken', reason: engineCopy.remembered.newHeadline }
  }
  return null
}
