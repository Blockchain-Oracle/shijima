/**
 * The rule for an operator transaction that has NO receipt: can it still land, or is it dead?
 *
 * Pure arithmetic, so it is tested without a chain. It errs toward waiting. Declaring a live transaction
 * dead is the dangerous mistake, because the desk would then send a second one.
 */

import { engineCopy } from '@desk/shared'

/** RPC providers balance load across nodes that can be a few blocks apart. Verdicts wait this much longer. */
export const NODE_LAG_MARGIN_S = 60
/** For calls with no contract deadline. This chain has a sequencer and no public mempool: minutes, not hours. */
export const NO_DEADLINE_GRACE_S = 300

export interface MissingReceipt {
  status: 'planned' | 'prepared' | 'sent'
  /** The contract's own deadline. Only buy and sell have one. */
  deadlineUnix: number | null
  nonce: number | null
  preparedAt: Date | null
  /** Timestamp of the latest block, in seconds. */
  chainTimeUnix: number
  /** How many of the operator's transactions are mined: the next unused nonce. */
  minedNonce: number
  now: Date
}

export type LandingVerdict =
  | { verdict: 'wait'; why: string }
  | { verdict: 'never_landed'; code: string; why: string }

export function judgeMissingReceipt(m: MissingReceipt): LandingVerdict {
  if (m.status === 'planned') {
    return {
      verdict: 'never_landed',
      code: 'never_signed',
      why: engineCopy.landing.neverSigned,
    }
  }
  if (m.nonce === null || m.preparedAt === null) {
    return {
      verdict: 'wait',
      why: engineCopy.landing.needsAPerson,
    }
  }
  const ageS = (m.now.getTime() - m.preparedAt.getTime()) / 1000

  if (m.deadlineUnix !== null && m.chainTimeUnix > m.deadlineUnix + NODE_LAG_MARGIN_S) {
    return {
      verdict: 'never_landed',
      code: 'deadline_passed',
      why: engineCopy.landing.deadlinePassed,
    }
  }
  if (m.minedNonce > m.nonce && ageS > NODE_LAG_MARGIN_S) {
    return {
      verdict: 'never_landed',
      code: 'nonce_used_elsewhere',
      why: engineCopy.landing.nonceUsedElsewhere,
    }
  }
  if (m.deadlineUnix === null && ageS > NO_DEADLINE_GRACE_S) {
    return {
      verdict: 'never_landed',
      code: 'not_seen',
      why: engineCopy.landing.notSeen,
    }
  }
  return { verdict: 'wait', why: engineCopy.landing.canStillLand }
}
