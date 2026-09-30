/**
 * The free $1 to try (PLAN-ROUND-3 D3), in dollars: $1 of USDG to trade with and about 30¢ of ETH for the
 * network fees, sent to your own wallet, while the gift wallet can pay. Every state the card can be in has its line.
 */
export const giftCopy = {
  title: 'Free $1 to try',
  pitch: 'Get $1 to trade with and about 30¢ for network fees, sent to your own wallet, while they last.',
  cta: 'Claim your free $1',
  slide: 'Slide to claim your $1',
  left: (n: number) => (n === 1 ? '1 left' : `${n} left`),
  states: {
    signedOut: 'Sign in with email or your wallet first. The $1 goes to your account’s wallet.',
    eligible: 'You can claim it now.',
    queued: 'Claimed. It will arrive in your wallet in about a minute.',
    sending: 'On its way to your wallet.',
    sent: 'Sent: $1 and a little ETH for fees are in your wallet.',
    failed: 'It did not go through. Try again.',
    already: 'This wallet has already claimed its $1.',
    ipUsed: 'The free $1 was already claimed from this connection. It is one per person.',
    allGone: 'All the free dollars are gone.',
  },
  /** Written on a waiting claim by the worker when it has no gift key. */
  senderOff:
    'Waiting: the gift sender is switched off right now. Your claim is kept and goes out when it is on.',
  unavailable: (why: string) => `Nothing was claimed: ${why}`,
  usdgTx: 'The $1',
  ethTx: 'The fee money',
  inside: { usdg: '$1 USDG', eth: '≈30¢ ETH', chain: 'Robinhood Chain' },
} as const
