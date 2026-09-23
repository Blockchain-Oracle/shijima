/**
 * The first-run tour: five short steps from "what is this" to "make your agent", in dollars and plain words.
 * Shown once per browser, skippable at every step, and reopened from Settings.
 */
export const firstRunCopy = {
  aria: 'Welcome to Shijima',
  brand: 'Shijima',
  step: (n: number, of: number) => `Step ${n} of ${of}`,
  skip: 'Skip',
  back: 'Back',
  next: 'Continue',
  start: 'Show me',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  welcome: {
    title: 'Give your stocks an AI agent.',
    sub: 'It trades. You own it.',
    tag: 'Stock Tokens on Robinhood Chain',
  },
  how: {
    title: 'How it works',
    sub: 'Three things to know. That is all of it.',
    beats: [
      {
        label: 'Money in',
        tag: 'Any token, from $1',
        note: 'Changed to digital dollars (USDG) on the way in.',
      },
      {
        label: 'Your agent trades',
        tag: 'A stock basket',
        note: 'Only inside the limits you set. It never sends money anywhere.',
      },
      {
        label: 'Only you take it out',
        tag: 'Any time',
        note: 'The agent lives in an account only your wallet can withdraw from.',
      },
    ],
  },
  connect: {
    title: 'Connect your wallet',
    sub: 'Sign one message to prove it is yours. It costs nothing and moves nothing.',
    connected: 'Wallet connected',
    region:
      'People in the US, the UK, Canada, Switzerland and some other places may not hold Stock Tokens. Looking around stays open to everyone.',
  },
  gift: {
    title: 'Get your free $1',
    sub: 'Try it with our money first: $1 to trade with and a little ETH for network fees.',
    connectFirst: 'Connect your wallet first. The $1 goes to the wallet you sign in with.',
    left: (n: number) => (n === 1 ? 'Only 1 left' : `${n} left`),
    none: 'None left right now.',
    claimed: 'Your $1 is claimed. Want more to trade with?',
    allGone: 'The free dollars are all gone. You can still start from $1 of your own.',
    fund: 'Fund from any token',
  },
  create: {
    title: 'Create your agent',
    sub: 'Pick a stock basket, set your limits, and put money in. About two minutes.',
    cta: 'Create your agent',
    later: 'Look around first',
  },
  tour: 'Take the tour',
  tourNote: 'The five-step welcome, again.',
} as const
