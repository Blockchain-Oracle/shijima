/**
 * Every sentence the engine writes when a follower copies its leader (D4). Kept apart from engine.ts so the
 * desk-to-agent rename there never collides with it. The same rules: short plain sentences, names the owner knows,
 * no promises. `why` goes inside a hashed record, so a change here only affects records made afterwards.
 *
 * Shares are given in parts per million of a value or a holding, so 12.3% is 123000.
 */
const share = (ppm: bigint) => `${(Number(ppm) / 10_000).toFixed(1)}%`

export const copyTradeCopy = {
  /** The leader as the follower's owner sees it: its name and the record number of the move. */
  leader: (name: string, seq: number) => `${name} #${seq}`,

  /** Why arithmetic proposed this trade. Hashed. */
  why: (leader: string, side: 'buy' | 'sell', token: string, ppm: bigint) =>
    side === 'buy'
      ? `Copied from ${leader}: it bought ${token} with ${share(ppm)} of its value, so this agent does the same with its own.`
      : `Copied from ${leader}: it sold ${share(ppm)} of its ${token}, so this agent sells the same share of its own.`,

  acted: (leader: string, side: 'buy' | 'sell', token: string, usd: string, ppm: bigint) =>
    side === 'buy'
      ? `Copied from ${leader}: bought ${token} with ${usd}, ${share(ppm)} of this agent's value.`
      : `Copied from ${leader}: sold ${share(ppm)} of this agent's ${token}, about ${usd}.`,
  /** The copy was cut down to fit this agent's own limits or cash. */
  inPart: (why: string) => ` Cut down to fit: ${why}.`,
  wouldHave: (leader: string, side: 'buy' | 'sell', token: string, usd: string) =>
    `Copied from ${leader}, in practice: would have ${side === 'buy' ? 'bought' : 'sold'} ${token} for about ${usd}. Nothing was sent.`,
  asked: (leader: string, side: 'buy' | 'sell', token: string, usd: string) =>
    `Copied from ${leader}: asking you first before it ${side === 'buy' ? 'buys' : 'sells'} ${token} for about ${usd}.`,

  /** Could not copy. The record says why, and nothing was traded. */
  missed: (leader: string, why: string) =>
    `Missed copy of ${leader}: ${why.charAt(0).toLowerCase()}${why.slice(1)}`,
  reason: {
    notApproved: (token: string) => `${token} is not on this agent's approved list.`,
    tooSmall: (usd: string, min: string) =>
      `this agent's share would be ${usd}, below the ${min} smallest trade worth its network fee.`,
    noCash: 'this agent has no cash outside the savings vault to buy with.',
    noHolding: (token: string) => `this agent holds no ${token} to sell.`,
    fullPosition: (token: string) =>
      `${token} is already as large a share of this agent as its limits allow.`,
    dailyLimitUsed: "this agent's daily limit is used up.",
    tooLate: (minutes: number) =>
      `the move is ${minutes} minutes old, and a copy that late would trade at a different price.`,
    couldNotCheck: (why: string) => `the agent could not check itself: ${why}`,
    noMandate: 'this agent has no mandate yet.',
  },
  /** What cut a copy down, for `inPart`. */
  cut: {
    perAction: "this agent's per-action limit",
    daily: "what is left of this agent's daily limit",
    cash: "this agent's cash outside the savings vault",
    position: "this agent's largest-holding limit",
  },
}
