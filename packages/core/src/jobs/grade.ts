/**
 * Marking the desk's own homework, once the US market has reopened.
 *
 * This is the thing that makes a kept record worth keeping. It grades the TIMING CALL, never the profit: a
 * decision is compared against the one alternative it really had, at the price each would have got. A weekend
 * buy that the market then rose past was still a good call if waiting would have cost more.
 *
 * Two rules keep it honest. A difference under 25 basis points is "no real difference", because that is inside
 * the cost of trading and calling it a win would be noise dressed as skill. And a decision the desk did not
 * actually make, or that never had an alternative, is "cannot be graded" rather than quietly counted as a win.
 */
export const NO_REAL_DIFFERENCE_BPS = 25

export type Verdict = 'better' | 'worse' | 'no_real_difference' | 'ungradable'

export interface Gradeable {
  outcome: string
  side: 'buy' | 'sell' | undefined
  /** The price the desk would have paid or received at the moment it decided, 8 decimals. */
  priceThenE8: bigint | undefined
  /** The price at the reopen, from the same pool, 8 decimals. */
  priceAtReopenE8: bigint | undefined
}

export interface Grade {
  verdict: Verdict
  /** Positive means the choice made was better than the alternative, by this much. Null when ungradable. */
  differenceBps: number | null
  chosen: string
  alternative: string
  why: string
}

/** What the desk chose, and the one alternative worth comparing it against. */
const COMPARISONS: Record<string, { chosen: string; alternative: string; acted: boolean } | undefined> = {
  acted: { chosen: 'acted then', alternative: 'waiting for the reopen', acted: true },
  acted_in_part: { chosen: 'acted in part then', alternative: 'waiting for the reopen', acted: true },
  // The owner's own call. Graded so the owner can see how it went, and left out of the desk's Timing sum.
  acted_by_override: {
    chosen: 'acting then, on your call',
    alternative: 'waiting for the reopen',
    acted: true,
  },
  would_have_acted: { chosen: 'would have acted then', alternative: 'waiting for the reopen', acted: true },
  waited: { chosen: 'waiting for the reopen', alternative: 'acting then', acted: false },
  declined: { chosen: 'not acting', alternative: 'acting then', acted: false },
}

export function gradeDecision(d: Gradeable): Grade {
  const comparison = COMPARISONS[d.outcome]
  if (!comparison) {
    return {
      verdict: 'ungradable',
      differenceBps: null,
      chosen: d.outcome,
      alternative: 'none',
      why: 'There was no alternative to compare this against.',
    }
  }
  const { chosen, alternative, acted } = comparison
  if (!d.side || !d.priceThenE8 || !d.priceAtReopenE8 || d.priceThenE8 <= 0n || d.priceAtReopenE8 <= 0n) {
    return {
      verdict: 'ungradable',
      differenceBps: null,
      chosen,
      alternative,
      why: 'One of the two prices could not be read, so there is nothing honest to compare.',
    }
  }

  // What acting then was worth against acting at the reopen. A buy wants the lower price, a sell the higher.
  const then = d.priceThenE8
  const reopen = d.priceAtReopenE8
  const actingBps =
    d.side === 'buy'
      ? Number(((reopen - then) * 10_000n) / reopen)
      : Number(((then - reopen) * 10_000n) / reopen)
  const differenceBps = acted ? actingBps : -actingBps

  if (Math.abs(differenceBps) < NO_REAL_DIFFERENCE_BPS) {
    return {
      verdict: 'no_real_difference',
      differenceBps,
      chosen,
      alternative,
      why: 'The two came out within a quarter of a percent of each other, which is inside the cost of trading.',
    }
  }
  const better = differenceBps > 0
  return {
    verdict: better ? 'better' : 'worse',
    differenceBps,
    chosen,
    alternative,
    why: better
      ? `${capitalise(chosen)} came out better than ${alternative}.`
      : `${capitalise(alternative)} would have come out better.`,
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
