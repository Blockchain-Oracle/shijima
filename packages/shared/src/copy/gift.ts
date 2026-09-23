/**
 * The free $1 to try (PLAN-ROUND-3 D3), in dollars: $1 of USDG to trade with and about 30¢ of ETH for the
 * network fees, sent to your own wallet. The first 20 wallets only. Every state the card can be in has its line.
 */
export const giftCopy = {
  title: 'Free $1 to try',
  pitch:
    'Get $1 to trade with and about 30¢ for network fees, sent to your own wallet. For the first 20 people.',
  cta: 'Claim your free $1',
  left: (n: number) => (n === 1 ? '1 left' : `${n} left`),
  states: {
    signedOut: 'Connect your wallet first. The $1 goes to the wallet you sign in with.',
    eligible: 'You can claim it now.',
    queued: 'Claimed. It will arrive in your wallet in about a minute.',
    sending: 'On its way to your wallet.',
    sent: 'Sent: $1 and a little ETH for fees are in your wallet.',
    failed: 'It did not go through. Try again.',
    already: 'This wallet has already claimed its $1.',
    ipToday: 'Someone on this connection claimed one today. Try again tomorrow.',
    allGone: 'All the free dollars are gone.',
  },
  /** Written on a waiting claim by the worker when it has no gift key. */
  senderOff:
    'Waiting: the gift sender is switched off right now. Your claim is kept and goes out when it is on.',
  unavailable: (why: string) => `Nothing was claimed: ${why}`,
  usdgTx: 'The $1',
  ethTx: 'The fee money',
} as const
