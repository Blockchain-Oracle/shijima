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

/** One desk's page: the chat first, then everything the desk holds and has done. */
export const deskCopy = {
  modes: { shadow: 'Practice', ask_first: 'Ask me first', on_its_own: 'On its own' },
  modeNote: {
    shadow: 'It decides for real and spends nothing.',
    ask_first: 'It asks you before every action.',
    on_its_own: 'It acts inside your limits, and asks for large actions.',
  },
  visitor: 'Someone else’s desk. You are watching it read-only.',
  tabs: { chat: 'Chat', desk: 'Desk', record: 'Record' },

  chat: {
    title: 'Your desk',
    eyebrow: 'Talk to it',
    intro:
      'Ask what it holds and why it waited, or tell it what to change. It shows you a card, and nothing changes until you confirm.',
    placeholder: 'Ask your desk, or tell it what to change…',
    send: 'Send',
    starters: ['How is my desk doing?', 'Why did you wait?', 'Move me into The Mag Seven', 'Check now'],
    thinking: 'Thinking…',
    slow: 'Still thinking. The desk answers in about ten seconds.',
    failed: 'I could not answer just now. Nothing was changed.',
    signedOut: 'Sign in to talk to your desk. Signing costs nothing and moves nothing.',
    notAdvice: 'The desk explains and proposes. Nothing it says is advice, and it never forecasts a price.',
    relies: 'Relies on',
    cite: {
      record: (n: string) => `record ${n}`,
      approval: 'a waiting request',
      wait: 'a standing wait',
      note: (n: string) => `your note ${n}`,
      price: (symbol: string) => `${symbol} price`,
    },
  },

  card: {
    who: { signin: 'You confirm here', session: 'Your session key signs', wallet: 'Your wallet signs' },
    before: 'Now',
    after: 'After',
    confirm: 'Confirm',
    notNow: 'Not now',
    confirming: 'Confirming…',
    left: 'Left alone. Nothing was changed.',
    expires: (when: string) => `This card expires ${when}.`,
    expired: 'This card has expired. Ask again if you still want it.',
    done: 'Done',
    refused: 'Not done',
    needsKey: 'Confirming this needs your session key or your wallet. That arrives with the owner controls.',
    viewTx: 'See the transaction',
  },

  needsYou: {
    title: 'Needs you',
    nothing: 'Nothing needs you.',
    asking: {
      ask_first: 'Asking because you asked to be asked first.',
      large_action: 'Asking because this one is large.',
      owner_override: 'Your own call.',
    },
    trade: (side: string, amountIn: string, expectedOut: string) =>
      `${side === 'sell' ? 'Sell' : 'Buy'} ${amountIn} for about ${expectedOut}`,
    approve: 'Approve',
    reject: 'Reject',
    expires: (when: string) => `expires ${when}`,
  },

  plate: {
    title: 'What it holds',
    total: 'Total value',
    sinceStart: 'Since your money went in',
    cash: 'Cash',
    vault: 'earning in the vault',
    valued: (age: string) =>
      `Valued ${age} on the trading pools’ half-hour average, never on the frozen official price.`,
    notYet: 'Not valued yet. The desk values itself at its first check.',
    timing: 'Timing',
    timingNote:
      'What the desk’s timing calls earned or cost against acting at once, graded after the market reopened. It can be negative.',
    timingNone: 'Nothing graded yet. Grading happens after the US market reopens.',
    practice: (amount: string, n: number) => `In practice: ${amount} over ${n} graded decisions.`,
  },

  holdings: {
    title: 'Holdings',
    target: (pct: string) => `target ${pct}`,
    inLine: 'in line',
    over: (pct: string) => `${pct} over`,
    under: (pct: string) => `${pct} under`,
  },

  nextCheck: {
    title: 'Next check',
    at: (when: string) => `At the top of the hour, ${when} New York.`,
    stopped: 'The desk is not acting until you resume it.',
  },

  practice: {
    title: 'Practice',
    progress: (done: number, needed: number) =>
      `${Math.min(done, needed)} of ${needed} practice checks done.`,
    report: { read: 'Report read.', unread: 'Report not read yet.' },
    ready: 'It can go live when you choose.',
    readReport: 'Read the practice report',
  },

  limits: {
    title: 'Limits in use',
    drift: 'May wander before it acts',
    position: 'Largest share of one stock',
    loss: 'Stops after a fall of',
    perAction: 'Most in one action',
    daily: 'Most in a day',
    large: 'Asks first at',
  },

  mandate: {
    title: 'What you told it',
    strategy: 'Strategy',
    own: 'Your own basket',
    cashTarget: 'Cash kept aside',
    notes: 'Your notes',
    noNotes: 'No notes.',
    version: (n: number) => `version ${n}`,
  },

  fee: (amount: string) => `Fee so far: ${amount}, waived.`,
  feeNote: '0.5% a year of what the desk holds, nothing in practice. Waived during the beta.',

  record: {
    title: 'The record',
    empty: 'The desk has not checked yet.',
    quiet: (n: number) => `${n} quiet checks`,
    whole: 'The whole record',
    report: 'How it did',
  },

  chart: {
    title: 'Value',
    empty: 'The chart starts at the desk’s second check.',
    acted: 'acted',
    waited: 'waited',
  },
} as const
