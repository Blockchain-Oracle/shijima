/**
 * Every word the website shows, outside the engine's own record text. The shell, the states and the chat
 * surface read from here, so a banned word is caught in one place and the voice stays one voice.
 *
 * Rules that hold across all of it (design brief section 4): "Stock Tokens", never "tokenized stocks"; a price
 * always carries its source and age; "reference" or "last official update", never "last close"; nothing reads
 * as a promise of gain.
 */
import type { Session } from '../calendar'

export const webCopy = {
  brand: {
    name: 'Shijima',
    ja: 'しじま',
    tagline:
      'An AI desk for your Stock Tokens. You tell it what to hold; it decides when, inside hard limits.',
    description:
      'Talk to your desk and it gets things done: it holds the basket you chose, decides only when to move, and writes down every decision.',
  },

  nav: {
    desk: { name: 'Your desk', description: 'Talk to your desk, and see what it did and why.' },
    markets: {
      name: 'Markets',
      description: 'The ten Stock Tokens, with each price, its source and its age.',
    },
    strategies: { name: 'Strategies', description: 'Start a desk from a basket of stocks.' },
    howItWorks: { name: 'How it works', description: 'What the desk decides, and what it never can.' },
    more: 'More',
    openAll: 'Open all navigation',
    drawerKicker: 'Navigate',
    drawerTitle: 'Everything in Shijima',
    drawerDescription: 'Your desk, the markets, and how it all works.',
    sections: {
      yours: { name: 'Yours', description: 'Your money and your desk' },
      explore: { name: 'Explore', description: 'Prices and baskets' },
      learn: { name: 'Learn', description: 'How the desk decides' },
    },
    primaryAria: 'Primary navigation',
    mobileAria: 'Mobile navigation',
    homeAria: 'Shijima, home',
  },

  session: {
    words: {
      regular: 'Open',
      extended: 'Extended hours',
      overnight: 'Overnight',
      weekend: 'Weekend',
      holiday: 'Holiday',
    } satisfies Record<Session, string>,
    closes: (time: string) => `closes ${time} ET`,
    reopens: (when: string) => `reopens ${when} ET`,
    aria: (word: string, tail: string) => `US market: ${word}, ${tail}`,
  },

  marquee: {
    reference: 'vs reference',
    inLine: 'in line',
    noPrices: 'Prices are logged every five minutes. None yet.',
    market: 'US MARKET',
  },

  account: {
    connect: 'Connect a wallet',
    connecting: 'Check your wallet…',
    noWallet: 'No wallet found',
    installWallet: 'Install a browser wallet such as MetaMask or Rabby to use a desk.',
    signIn: (address: string) => `Sign in as ${address}`,
    signInNote: 'Signing proves the wallet is yours. It costs nothing and moves nothing.',
    signInFailed: 'Sign-in failed.',
    signOut: 'Sign out',
    yourDesks: 'Your desks',
    menu: 'Account menu',
    signedInAs: 'Signed in as',
  },

  moneyPill: {
    title: 'What your desks hold in total, at their last check',
    aria: (amount: string) => `Your desks hold ${amount} in total`,
    unit: 'USDG',
  },

  theme: {
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
    light: 'Light mode',
    dark: 'Dark mode',
  },

  wrongNetwork: {
    label: 'Wrong network.',
    body: 'Your wallet is on another network. Shijima runs on Robinhood Chain.',
    switchTo: 'Switch to Robinhood Chain',
    switching: 'Switching…',
  },

  footer: {
    disclosure:
      'Stock Tokens are not shares. Holding one gives you no ownership of the company and no shareholder rights. Nothing here is advice.',
    howItWorks: 'How it works',
    source: 'Source',
  },

  states: {
    loading: 'Loading',
    stale: (age: string) => `Last known ${age}. Refreshing did not work.`,
    retry: 'Try again',
    back: 'Back to the markets',
    technical: 'Technical details',
    boundary: {
      headline: 'Something went wrong on this page.',
      body: 'Nothing was sent and nothing moved. Try again, or go back to the markets.',
    },
    diagnosis: {
      'signer-required': {
        headline: 'Sign in first',
        body: 'Reading works without a wallet. Changing anything needs you to sign in.',
      },
      'wrong-chain': {
        headline: 'Wrong network',
        body: 'Shijima runs on Robinhood Chain. Switch your wallet and try again.',
      },
      'user-rejected': {
        headline: 'You cancelled in your wallet',
        body: 'Nothing was sent. Try again when you are ready.',
      },
      'out-of-gas': {
        headline: 'Not enough ETH for fees',
        body: 'Your wallet needs a little ETH on Robinhood Chain to pay for this.',
      },
      'chain-unreachable': {
        headline: 'The chain did not answer',
        body: 'Robinhood Chain could not be reached just now. Nothing was sent.',
      },
      'desk-unreachable': {
        headline: 'The desk did not answer',
        body: 'The desk’s records could not be read just now. Your money is untouched.',
      },
      'not-found': {
        headline: 'Nothing here',
        body: 'This page does not exist, or it is not shared.',
      },
      unknown: {
        headline: 'Something unexpected happened',
        body: 'Nothing was sent and nothing moved.',
      },
    },
  },
} as const

export type DiagnosisKind = keyof typeof webCopy.states.diagnosis

/** The Markets page. */
export const marketsCopy = {
  kicker: 'Markets',
  title: 'The ten Stock Tokens',
  intro:
    'Every price here is the trading pool’s own, logged every five minutes, with how far it sits from its reference and what trading $1,000 would cost now.',
  empty: 'No prices have been logged yet. The logger writes one row per Stock Token every five minutes.',
  stale: (age: string) => `The newest price is from ${age}. The price logger may have stopped.`,
  columns: {
    token: 'Stock Token',
    price: 'Pool price',
    gap: 'From reference',
    reference: 'Reference',
    cost: 'Cost of $1,000',
  },
  priceSource: (age: string) => `pool, ${age}`,
  inLine: 'in line',
  gap: (bps: number) => `${bps > 0 ? '+' : '−'}${(Math.abs(bps) / 100).toFixed(2)}%`,
  referenceClose: (when: string) => `The pool at the last regular close, ${when}`,
  referenceOfficial: (age: string) => `Last official update, ${age}`,
  halted: 'trading halted',
  footnote:
    'The reference is what this same pool traded at when the US market last closed; while the market is open, it is the last official update. A gap under half a percent is noise.',
} as const
