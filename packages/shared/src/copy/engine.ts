/**
 * Every sentence the ENGINE writes for the owner: record summaries, the reason a candidate exists, why a rule
 * blocked it, why a remembered decision ended, why the limits check said no, why a transaction did not land.
 *
 * They live here, in one place, so the wording can be reviewed and changed without touching logic, and so the
 * banned-word rule can be applied to all of it. Many of these sentences end up inside a hashed record, so a
 * change here only ever affects records made afterwards.
 *
 * Rules: short plain sentences. "Stock Tokens", never "tokenized stocks". "Last official update", never "last
 * close". Names the owner knows (Nvidia), never tickers or addresses. No promises.
 */
const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`

export type DeskStateName = 'active' | 'paused_by_owner' | 'stopped_by_loss_limit' | 'needs_attention'

export const engineCopy = {
  deskState: {
    active: 'active',
    paused_by_owner: 'paused by you',
    stopped_by_loss_limit: 'stopped by your loss limit',
    needs_attention: 'waiting for attention',
  } satisfies Record<DeskStateName, string>,

  nothingToDo: 'Nothing to do. Every holding is within its allowed range.',
  priceUnreadable: (name: string, why: string) => `The price of ${name} could not be read: ${why}`,
  notLooking: (state: string) => `The agent is ${state}, so it did not look for anything to do.`,
  pausedMeanwhile: (state: string) =>
    `The agent was ${state} while this was being decided, so nothing was done.`,
  blockedByLimit: (reasons: string[]) => `Blocked: ${reasons.join('; ')}.`,
  noUsableDecision: (why: string) => `No usable decision: ${why}`,
  lossLimitReached: (worth: string, lossBps: number, baseline: string, limitBps: number) =>
    `The agent is worth ${worth}, which is ${pct(lossBps)} below its baseline of ${baseline}. Your loss limit is ${pct(limitBps)}.`,
  approvalExpired: 'Your approval request expired. Nothing was done.',
  /** The second consecutive check below the loss limit: the desk stops itself on the chain, not only in software. */
  lossLimitPausedOnChain:
    'The agent was still below your loss limit at its next check, so it paused itself on the chain. Nothing was sold. Only you can restart it, with your wallet.',
  lossLimitPauseFailed: (cause: string) =>
    `The agent tried to pause itself on the chain after a second check below your loss limit, and could not: ${cause}. It stays stopped in software.`,

  approved: {
    tooLate:
      'You approved this, but the request had already expired by the time the agent could act on it. Nothing was done.',
    conditionsChanged: (movedBps: number, limitBps: number) =>
      `You approved this, but the price has moved ${(movedBps / 100).toFixed(2)}% since you were shown it, which is more than the ${(limitBps / 100).toFixed(2)}% allowed. Nothing was done.`,
    blockedNow: (reasons: string[]) =>
      `You approved this, but it is no longer allowed: ${reasons.join('; ')}.`,
    refusedNow: (why: string) =>
      `You approved this, but ${why.charAt(0).toLowerCase()}${why.slice(1)} Nothing was done.`,
    carriedOut: (name: string) => `You approved this, so the agent went ahead with ${name}.`,
    overrideReason: 'The owner chose to act now, in the chat, after the agent chose to wait.',
    overrideCarriedOut: (name: string) =>
      `The agent had chosen to wait. You said do it anyway, so it went ahead with ${name} on your call.`,
  },

  need: {
    drifted: (name: string, weightBps: number, targetBps: number, thresholdBps: number) =>
      `${name} is ${pct(weightBps)} of the agent’s value against a target of ${pct(targetBps)}. That is further than the ${pct(thresholdBps)} it may wander.`,
    dropped: (name: string) => `${name} is no longer in the mandate, so the agent would sell it.`,
    /** A standing rule fired. The sale is the owner's own instruction, carried out by arithmetic. */
    rule: (id: string, name: string, cutBps: number, fallBps: number, gapBps: number) =>
      `Your rule ${id}: sell ${pct(cutBps)} of ${name} when its price is ${pct(fallBps)} or more below the reference. It is ${pct(Math.abs(gapBps))} below now.`,
  },

  /** A structured rule in words, for the model and for the owner. */
  ruleText: (name: string, fallBps: number, cutBps: number) =>
    `Sell ${pct(cutBps)} of ${name} if its price is ${pct(fallBps)} or more below the reference.`,

  /** Why a model answer was refused by our own checks, beyond the schema. */
  decide: {
    quotedPrivateText:
      'the answer repeats a headline or one of your notes word for word, which the public record may not carry',
  },

  /** The savings vault. Plain arithmetic; no model is asked. */
  vault: {
    sweepWhy: (idle: string, keep: string, rate: string, interest: string, fee: string) =>
      `${idle} of your cash target was sitting idle, beyond the ${keep} the agent keeps for its own buys. At the vault's ${rate} a year that earns about ${interest} in 30 days, well over the ${fee} a deposit and a later withdrawal cost in network fees.`,
    swept: (amount: string, rate: string, keep: string) =>
      `Moved ${amount} of idle cash into the savings vault, at ${rate} a year. ${keep} stays in cash for the agent's own buys.`,
    redeemWhy: (wanted: string, loose: string) =>
      `The agent's buys want ${wanted}, and it had ${loose} in cash outside the savings vault.`,
    redeemed: (amount: string) =>
      `Took ${amount} back out of the savings vault, so the agent has cash for its buys.`,
    failed: (cause: string) => `The savings-vault move did not go through: ${cause}. Nothing moved.`,
  },

  remembered: {
    stillWaitingForReopen: (at: string) => `Still waiting for the market to reopen (decided ${at} UTC).`,
    stillWaitingForAnswer: (at: string) => `Still waiting for your answer (asked ${at} UTC).`,
    wouldAlreadyHave: (verb: 'bought' | 'sold', name: string, at: string) =>
      `Nothing new. The agent would already have ${verb} ${name} at ${at} UTC, and nothing measurable has changed since.`,
    reopened: 'The market has reopened, so the agent looks again.',
    cashArrived: 'New cash arrived in the agent’s account.',
    gapMoved: (bps: number) => `The price gap moved by ${bps} bps since the agent decided to wait.`,
    driftGrew: (bps: number) => `The holding drifted a further ${bps} bps from its target.`,
    newHeadline: 'There is a new headline naming the company.',
  },

  blocker: {
    deskNotActive: (state: string) => `The agent is ${state}.`,
    tokenNotAllowed: (name: string) => `You have not allowed the agent to buy ${name}.`,
    poolMismatch: (name: string) =>
      `The agent is set to trade ${name} through a different pool than the approved one. Re-pin it in settings.`,
    didThisMinutesAgo: (name: string) => `The agent did the same thing with ${name} a few minutes ago.`,
    haltUnknown: (name: string) => `Could not confirm whether trading in ${name} is paused.`,
    tradingHalted: (name: string) => `Trading in ${name} is paused.`,
    oraclePaused: (name: string) => `The price feed for ${name} is paused.`,
    feedUnavailable: (name: string) => `The price feed for ${name} is unavailable.`,
    beyondPriceBand: (name: string) =>
      `The price of ${name} is more than 8% from the last official update. Only you can sell right now.`,
    movingFast: (name: string, bps: number) =>
      `The price of ${name} is ${pct(bps)} away from its own average of the last half hour. The agent waits for it to settle.`,
    newsUnavailable: (name: string) => `News about ${name} is unavailable, so the agent will not act.`,
    eventWindow: (name: string, date: string) =>
      `${name} reports on ${date}. The agent does not buy in the two days before a report.`,
    lossLimit: (why: string) => `Stopped by your loss limit. ${why}`,
  },

  /** Reasons from the limits check. Lower case, because they are joined into one sentence. */
  gate: {
    nothingToTrade: 'nothing to trade, or no price',
    paused: 'agent is paused',
    haltUnknown: 'halt flag unknown',
    halted: 'trading is halted',
    oraclePaused: 'oracle is paused',
    beyondBand: 'price is more than 8% from the last official update',
    farFromReference: 'price is more than 3% from the reference',
    tooCostly: 'this trade would cost more than 1% against the pool price',
    overPerAction: 'over the per-action limit',
    overDaily: 'over what is left of the daily limit',
    holdingTooLarge: 'it would make this holding larger than you allow',
    notEnoughCash: 'not enough cash in the agent’s account',
    notEnoughTokens: 'the agent does not hold that much',
  },

  /** Why a transaction with no receipt is, or is not yet, given up on. */
  landing: {
    neverSigned: 'Nothing was signed, so nothing could have been sent.',
    needsAPerson: 'A signed action with no nonce or time on record needs a person to look at it.',
    deadlinePassed:
      'The contract refuses this transaction after its deadline, and the deadline has passed with no receipt.',
    nonceUsedElsewhere: 'Another transaction was mined with this nonce, so this one can never be.',
    notSeen:
      'The network has not shown this transaction for five minutes. The next send reuses its nonce, which voids it.',
    canStillLand: 'It can still land.',
  },

  trouble: {
    notOurDesk: 'The code at this address is not an agent contract made by our factory.',
    operatorRemoved: 'The assistant no longer has access to this agent.',
    differentOwner: 'The agent’s contract belongs to a different owner than the one who signed in.',
    chainAhead: (onChain: string, known: number) =>
      `The chain shows ${onChain} sealed actions, the database knows ${known}.`,
    hashMismatch: (txHash: string, seq: number) =>
      `The on-chain decision hash of ${txHash} is not the fingerprint of record ${seq}.`,
  },
} as const
