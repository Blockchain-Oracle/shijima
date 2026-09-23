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
    reels: {
      name: 'Reels',
      description: 'The Stock Tokens, what shared desks decided, and takes, one card at a time.',
    },
    strategies: { name: 'Strategies', description: 'Start a desk from a basket of stocks.' },
    howItWorks: { name: 'How it works', description: 'What the desk decides, and what it never can.' },
    docs: { name: 'Docs', description: 'The manual: using Shijima, and how it is built.' },
    more: 'More',
    openAll: 'Open all navigation',
    drawerKicker: 'Navigate',
    drawerTitle: 'Everything in Shijima',
    drawerDescription: 'Your desk, the markets, and how it all works.',
    sections: {
      yours: { name: 'Yours', description: 'Your money and your desk' },
      explore: { name: 'Explore', description: 'Prices, takes and baskets' },
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
    /** The time carries its own zone words: "16:00 ET", or "Mon 14:30 (09:30 ET)" for a reader elsewhere. */
    closes: (time: string) => `closes ${time}`,
    reopens: (when: string) => `reopens ${when}`,
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
    settings: 'Settings',
    telegram: 'Telegram',
    telegramOn: 'Connected',
    telegramOff: 'Get approvals and alerts in Telegram',
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
    withdraw: 'Withdraw without this website',
    status: 'Status',
    source: 'Source',
    /** The chart library's licence asks for a visible link to TradingView; this is it, so the charts carry no logo. */
    charts: 'Charts by TradingView',
    docs: 'Docs',
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
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

export const marketsCopy = {
  kicker: 'Markets',
  title: 'Strategies and the ten Stock Tokens',
  empty: 'No prices have been logged yet. The logger writes one row per Stock Token every five minutes.',
  stale: (age: string) => `The newest price is from ${age}. The price logger may have stopped.`,
  priceSource: (age: string) => `pool, ${age}`,
  inLine: 'in line',
  gap: (bps: number) => `${bps > 0 ? '+' : bps < 0 ? '−' : ''}${(Math.abs(bps) / 100).toFixed(2)}%`,
  /** "0.84% above reference", or "in line" under half a percent, which is noise. */
  fromReference: (bps: number) =>
    Math.abs(bps) < 50
      ? 'in line with reference'
      : `${(Math.abs(bps) / 100).toFixed(2)}% ${bps > 0 ? 'above' : 'below'} reference`,
  referenceClose: (when: string) => `The pool at the last regular close, ${when}`,
  referenceOfficial: (age: string) => `Last official update, ${age}`,
  halted: 'trading halted',
  running: (age: string) => `running since ${age}`,
  footnote:
    'The reference is what the same pool traded at when the US market last closed; while the market is open, it is the last official update. A gap under half a percent is noise.',

  hero: {
    ranges: { '1D': '1D', '1W': '1W', '1M': '1M' },
    strategiesLabel: 'Strategies',
    rangeLabel: 'Period',
    stocks: (n: number) => `${n} stocks`,
    /** The question slot: what $1,000 put in at the start of the period is worth now. */
    worth: (start: string) => `$1,000 put in ${start}, at the pools’ prices`,
    asOf: (age: string) => `as of ${age}`,
    since: (dollars: string) => `${dollars} over the period`,
    opensIn: 'Reopens in',
    closesIn: 'Closes in',
    noClock: '—',
    legendValue: 'Value',
    legendReference: 'Reference',
    askAbout: 'Ask about this',
    askQuestion: (name: string) => `How is ${name} doing against its reference right now?`,
    noHistory: 'Not enough prices logged for this period yet.',
    chartAria: (name: string) => `${name}: value of $1,000 against its reference`,
  },

  /** The caption under the chart, built from facts, in the desk's voice. Never a forecast. */
  caption: {
    gap: (name: string, bps: number, reference: string) =>
      Math.abs(bps) < 50
        ? `${name} is in line with its reference, ${reference}.`
        : `${name} is ${(Math.abs(bps) / 100).toFixed(1)}% ${bps > 0 ? 'above' : 'below'} its reference, ${reference}.`,
    referenceClose: (when: string) => `the pools at the last regular close, ${when}`,
    referenceOfficial: (age: string) => `the last official update, ${age}`,
    mover: (name: string, bps: number) =>
      `${name} has moved most, ${(Math.abs(bps) / 100).toFixed(1)}% ${bps > 0 ? 'above' : 'below'}.`,
    noise: 'Inside half a percent, I treat it as noise.',
    desks: (acted: number, waited: number) => {
      const parts = [
        acted > 0 ? `acted ${times(acted)}` : '',
        waited > 0 ? `waited ${times(waited)}` : '',
      ].filter(Boolean)
      return parts.length === 0 ? '' : `Shared desks ${parts.join(' and ')} on these stocks in this period.`
    },
    halted: (names: string) =>
      `${names} ${names.includes(' and ') ? 'are' : 'is'} halted, so no desk can trade it now.`,
  },

  rail: {
    label: 'In this strategy',
    cash: 'Cash',
    cashNote: 'kept aside',
    cost: (dollars: string, pct: string) =>
      `Putting $500 in now would cost about ${dollars} (${pct}) to trade.`,
    costUnknown: 'The cost to trade is not known right now.',
    nothingHalted: 'Nothing in it is halted.',
    report: (name: string, when: string) => `${name} reports ${when}.`,
    start: 'Start a desk with this',
    notAdvice: 'This shows what the pools did. It is not advice, and I never forecast a price.',
  },

  sections: {
    tokens: {
      index: '01',
      title: 'The ten Stock Tokens',
      desc: 'Each pool’s price against its reference, since the reference was set.',
    },
    desks: {
      index: '02',
      title: 'What desks did',
      desc: 'Decisions from desks whose owners share them. Each opens its reason.',
      none: 'No shared desk has acted or waited in this period.',
    },
    watch: { index: '03', title: 'Desks you can watch', none: 'No desk has been shared yet.' },
  },

  card: {
    against: (reference: string) => `against ${reference}`,
    refTick: 'ref',
    cost: (pct: string) => `$1,000 costs ${pct}`,
    open: (name: string) => `Open ${name}`,
  },

  outcomes: {
    acted: 'Acted',
    acted_in_part: 'Acted in part',
    acted_by_override: 'Acted on the owner’s word',
    waited: 'Waited',
    declined: 'Declined',
    would_have_acted: 'Would have acted',
    nothing_to_do: 'Nothing to do',
  } as Record<string, string>,
  practice: 'practice',
  decisionLine: (desk: string, outcome: string, side: string | null, name: string) =>
    `${desk}: ${outcome.toLowerCase()}${side ? ` on a ${side} of ${name}` : ` on ${name}`}`,

  signInToAsk: 'Sign in to ask your desk about this.',
} as const

/** One Stock Token's page: Agari's ticker hub on our facts. */
export const stockCopy = {
  eyebrow: (fund: boolean) => (fund ? 'Stock Token · fund' : 'Stock Token'),
  headingJp: '銘柄。',
  intro: (name: string) =>
    `Everything Shijima knows about ${name}: the pool’s price and how far it sits from its reference, what trading it costs, how its multiplier has changed, its next report, and what desks decided about it.`,
  stats: {
    price: 'Pool price',
    reference: 'Reference',
    gap: 'From reference',
    cost: 'Cost of $1,000',
    report: 'Next report',
  },
  priceAge: (age: string) => `pool · ${age}`,
  referenceWhen: (when: string) => `pool at close · ${when}`,
  referenceOfficial: (age: string) => `official · ${age}`,
  costSmall: (pct: string) => `$100 costs ${pct}`,
  noReport: 'none scheduled',
  fundReport: 'funds do not report',
  dash: '—',
  chartTitle: 'Price against reference',
  caption: {
    gap: (name: string, bps: number, reference: string) =>
      Math.abs(bps) < 50
        ? `${name} is in line with its reference, ${reference}.`
        : `${name} is ${(Math.abs(bps) / 100).toFixed(1)}% ${bps > 0 ? 'above' : 'below'} its reference, ${reference}.`,
    referenceClose: (when: string) => `the pool at the last regular close, ${when}`,
    cost: (pct: string) => `Trading $1,000 of it now would cost about ${pct}.`,
    halted: 'Trading in it is halted, so no desk can trade it now.',
  },
  askQuestion: (name: string) => `What is ${name} doing right now, and does it matter for my desk?`,
  startWith: 'Start a desk with it',
  back: 'All markets',
  /** The hero's chip, in words a person reads at a glance. */
  chip: (bps: number | null) =>
    bps === null
      ? 'No reference yet'
      : Math.abs(bps) < 50
        ? 'In line with its reference'
        : `${(Math.abs(bps) / 100).toFixed(2)}% ${bps > 0 ? 'above' : 'below'} its reference`,
  heldIn: 'In these strategies',
  heldInNone: 'In no preset strategy. Add it to your own mix.',
  heldInCta: 'Let an agent hold it',
  onePerShare: (m: string) => `1 token = ${m} shares`,

  sections: {
    alerts: {
      index: '03',
      title: 'Price alerts',
      desc: 'One message by Telegram and in the bell when the pool moves this far from its reference. Then it stops.',
    },
    multiplier: {
      index: '04',
      title: 'The multiplier',
      desc: 'Dividends are not paid in cash. They raise the multiplier, so one token becomes a little more than one share.',
      now: (m: string) => `One token is ${m} shares now.`,
      change: (pct: string, kind: string) => `${pct} · ${kind}`,
      kinds: { dividend: 'a dividend', split: 'a split', other: 'a change' } as Record<string, string>,
      none: 'The multiplier has not changed since the token launched.',
      pending: (to: string, when: string) => `It changes to ${to} shares on ${when}.`,
    },
    decisions: {
      index: '01',
      title: 'What agents decided',
      desc: 'From desks whose owners share them, newest first. Each opens its reason.',
      none: 'No shared desk has acted or waited on it yet.',
    },
    events: {
      index: '02',
      title: 'Company events',
      desc: 'Report dates from Finnhub’s calendar. Prices can jump around them, and trading can pause.',
      none: 'No report is scheduled.',
      fund: 'A fund has no reports of its own.',
      earnings: (quarter: number, year: number) => `Results for fiscal quarter ${quarter} of ${year}`,
      earningsPlain: 'Results',
      timing: { bmo: 'before the open', amc: 'after the close', dmh: 'during hours' } as Record<
        string,
        string
      >,
    },
  },
} as const

/** Price alerts: set on a stock's page or in the chat, sent once by Telegram and the bell. */
export const alertsCopy = {
  directions: { above: 'above', below: 'below', either: 'either way from' } as const,
  form: {
    lead: (name: string) => `Tell me when ${name} is`,
    tail: 'its reference',
    percentLabel: 'Distance in percent',
    directionLabel: 'Direction',
    submit: 'Set alert',
    saving: 'Saving…',
  },
  card: (name: string, pct: string, direction: 'above' | 'below' | 'either') =>
    direction === 'either'
      ? `Tell you when ${name} is ${pct} from its reference, either way`
      : `Tell you when ${name} is ${pct} ${direction} its reference`,
  cardNote: 'One message by Telegram and in the bell, then the alert is done.',
  alreadyThere: (gap: string) =>
    `It is already ${gap} away, so this fires with the next price, within five minutes.`,
  saved: 'Alert set. You will hear once.',
  signedOut: 'Sign in to set an alert. It arrives by Telegram and in the bell.',
  noDesk: 'Alerts arrive through your desk’s Telegram and bell, so start a desk first.',
  waiting: (pct: string, direction: string) => `Waiting: ${pct} ${direction}`,
  fired: (when: string, gap: string) => `Sent ${when}, at ${gap}`,
  cancelled: 'Cancelled',
  cancel: 'Cancel',
  none: 'No alerts on this one yet.',
  refused: {
    token: 'That is not one of the ten Stock Tokens.',
    range: 'Pick a distance between 0.25% and 50%.',
    tooMany: (max: number) => `You have ${max} alerts waiting, the most at once. Cancel one first.`,
    notYours: 'That alert is not yours.',
  },
  /** The message itself. Plain, with the numbers, and it says it will not repeat. */
  message: (name: string, gap: string, price: string, reference: string, threshold: string) =>
    `${name} is ${gap} its reference now: the pool at ${price}, against ${reference}. You asked to hear at ${threshold}, so this alert is done.`,
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
  settingsLink: 'Settings',
  tabs: { chat: 'Agent', desk: 'Portfolio', record: 'Activity' },
  ownBasket: 'Your own basket',
  sections: {
    portfolio: 'Portfolio',
    activity: 'Activity',
    settings: 'Settings',
    aria: 'Your desk, in detail',
  },

  /** The AI agent's own card on the desk page: who it is, what it is doing right now, and when it looks next. */
  agent: {
    name: 'Shijima',
    role: 'Your AI agent',
    roleVisitor: 'This desk’s AI agent',
    doing: 'Right now',
    status: {
      paused: 'Paused by you. I am not acting until you resume.',
      stopped: 'Stopped by your loss limit. Nothing moves until you restart me.',
      attention: 'I need your attention before I can carry on.',
      removed: 'You removed me from this desk. Your money stays where it is.',
      closed: 'This desk is closed. Its record stays readable.',
      asking: (n: number) => `Waiting for your answer on ${n === 1 ? 'one request' : `${n} requests`}.`,
      wouldHave: (what: string) =>
        `Practice: I would already have chosen to ${what}. Nothing has changed since, so I am holding that call.`,
      waiting: (what: string, when: string) =>
        `Waiting to ${what}. I look again ${when}, or sooner if something changes.`,
      watching: (n: number) =>
        n === 0
          ? 'Nothing to hold yet. Add money and I start on your plan.'
          : `Watching ${n === 1 ? 'your one stock' : `your ${n} stocks`}. Everything is inside its range.`,
      notStarted: 'I have not made my first check yet.',
    },
    buy: (amount: string, name: string) =>
      `buy ${amount} of ${name.startsWith('S&P') || name.startsWith('Nasdaq') ? `the ${name}` : name}`,
    sell: (name: string) => `sell some ${name}`,
    afterReopen: 'after the market reopens',
    lastCheck: 'Last look',
    nextCheck: 'Next look',
    decisions: 'Decisions',
    acted: 'Acted',
    waited: 'Waited',
    telegramOn: 'Telegram on',
    telegramOff: 'Telegram off',
    latest: 'Latest decision',
    practiceNote: 'Practice: I decide for real and spend nothing.',
    liveNote: 'Live: I act inside the limits your account enforces.',
  },

  chat: {
    title: 'Your desk',
    eyebrow: 'Talk to Shijima',
    intro:
      'Ask what I hold and why I waited, or tell me what to change. I show you a card, and nothing changes until you confirm.',
    placeholder: 'Ask Shijima, or tell it what to change…',
    send: 'Send',
    starters: ['How am I doing?', 'Why did you wait?', 'Move me into The 7 giants', 'Check now'],
    thinking: 'Thinking…',
    slow: 'Still thinking. Shijima answers in about ten seconds.',
    failed: 'I could not answer just now. Nothing was changed.',
    signedOut: 'Sign in to talk to your desk. Signing costs nothing and moves nothing.',
    notAdvice: 'The desk explains and proposes. Nothing it says is advice, and it never forecasts a price.',
    /** The desk's side of an exchange started from a button: the card is the answer. */
    fromButton: 'Here it is. Check the card, and nothing happens until you confirm.',
    fromButtonLabel: 'from a button',
    relies: 'Based on',
    cite: {
      record: (n: string) => `decision #${n}`,
      approval: 'a waiting request',
      wait: 'a standing wait',
      note: (n: string) => `your note ${n}`,
      price: (symbol: string) => `the ${symbol} price`,
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
    again: 'Check again',
  },

  needsYou: {
    title: 'Needs you',
    nothing: 'Nothing needs you.',
    asking: {
      ask_first: 'Asking because you asked to be asked first.',
      large_action: 'Asking because this one is large.',
      owner_override: 'Your own call.',
    },
    /** "Buy $120 of Nvidia" or "Sell 0.02 Nvidia for about $4.90": amounts are decimal strings from the preview. */
    trade: (side: string, amountIn: string, expectedOut: string, name: string) =>
      side === 'sell'
        ? `Sell ${amountIn} ${name} for about $${expectedOut}`
        : `Buy $${amountIn} of ${name} (about ${expectedOut} tokens)`,
    approve: 'Approve',
    reject: 'Reject',
    expires: (when: string) => `expires ${when}`,
  },

  plate: {
    title: 'What it holds',
    total: 'Total value',
    sinceStart: 'Since your money went in',
    sinceReopen: 'Since the market reopened',
    cash: 'Cash',
    vault: 'earning in the vault',
    vaultRate: (rate: string) => `${rate} a year, variable`,
    vaultNote: 'Taking cash out of the savings vault depends on how much it has available at that moment.',
    valued: (age: string) =>
      `Valued ${age} on the trading pools’ half-hour average, never on the frozen official price.`,
    notYet: 'Not valued yet. The desk values itself at its first check.',
    valuedShort: (age: string) => `valued ${age}`,
    nextCheckIn: (when: string) => (when === 'now' ? 'looking now' : `watching · next look in ${when}`),
    sinceStartShort: 'since your money went in',
    timing: 'Timing',
    timingNote:
      'What the desk’s timing calls earned or cost against acting at once, graded after the market reopened. It can be negative.',
    timingNone: 'Nothing graded yet. Grading happens after the US market reopens.',
    practice: (amount: string, n: number) => `In practice: ${amount} over ${n} graded decisions.`,
  },

  holdings: {
    title: 'Holdings',
    target: (pct: string) => `target ${pct}`,
    /** "$203.10 now (pool, 4 minutes ago)": the price with its source and age, never without [section 10]. */
    priceNow: (value: string, age: string) => `${value} now (pool, ${age})`,
    referenceIs: (value: string, kind: string) => `reference ${value} (${kind})`,
    referenceKinds: {
      last_regular_close: 'the pool at the last close',
      last_official_update: 'the last official update',
    } as Record<string, string>,
    gap: (compared: string) => `${compared} the reference`,
    noPrice: 'No price logged yet.',
    priceDetail: 'Price detail',
    inLine: 'in line',
    over: (pct: string) => `${pct} over`,
    under: (pct: string) => `${pct} under`,
    flags: {
      halted: 'Trading is paused in this token. The desk will not touch it until it resumes.',
      haltUnknown: 'Its trading status cannot be read right now, so the desk will not touch it.',
      band: (pct: string) =>
        `${pct} from its last official update. The assistant cannot trade it right now; only you can sell.`,
      feed: 'No price feed right now. The assistant cannot trade it; only you can sell.',
      report: (when: string) =>
        `Reports ${when}. The price can move sharply around then, and a weekend price even more.`,
      timing: { bmo: 'before the open', amc: 'after the close', dmh: 'during the day' } as Record<
        string,
        string
      >,
      sellYourself: 'Sell it yourself from Controls',
    },
  },

  nextCheck: {
    title: 'Watching',
    lead: 'Watching every five minutes. It wakes when something moves;',
    at: (when: string) => `Watching every five minutes. Its next look is at ${when} New York.`,
    stopped: 'The desk is not acting until you resume it.',
    late: (ago: string) =>
      `Has not checked in. Last check was ${ago}. Your money is safe in your account and cannot move without the assistant.`,
    first: 'No check yet. The first one happens at the top of the next hour.',
    paused: 'Paused by you. Nothing will happen until you resume.',
    lossStop:
      'It stopped itself because of your loss limit. To restart, press Resume in Controls; the limit then counts from what the desk is worth at that moment.',
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
    spentToday: 'Spent in the last 24 hours',
    spentOf: (spent: string, cap: string) => `${spent} of ${cap}`,
    lossRoom: 'Room before the loss stop',
    lossRoomValue: (amount: string, pct: string) => `${amount} (${pct})`,
    lossUnset: 'set at the first valuation',
    drift: 'May wander before it acts',
    position: 'Largest share of one stock',
    loss: 'Stops after a fall of',
    perAction: 'Most in one action',
    daily: 'Most in a day',
    large: 'Asks first at',
    largestNow: 'Largest single holding',
    largestOf: (now: string, max: string) => `${now} of at most ${max}`,
    all: 'All limits',
  },

  allocation: {
    title: 'Now against the plan',
    now: 'Now',
    caption: 'what it holds',
    target: (pct: string) => `plan ${pct}`,
    over: (pct: string) => `${pct} over plan`,
    under: (pct: string) => `${pct} under plan`,
    sentence: (name: string, pct: string, under: boolean) =>
      `${name} is ${pct} ${under ? 'under' : 'over'} plan, past what it may wander. The desk weighs moving it back at each check.`,
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

  telegramOff:
    'Telegram is not connected, so the desk can only ask you here and cannot tell you when something happens. Connect it in Settings.',

  /** Protective rules [8.6]: carried out by arithmetic, never by reading prose. */
  rules: {
    title: 'Standing rules',
    hint: 'A rule the desk carries out itself, by arithmetic: if a stock you hold falls this far below its reference, it sells this much of it. The assistant still picks the moment and can only wait with a reason.',
    none: 'No standing rules.',
    stock: 'Stock',
    fall: 'Falls by',
    cut: 'Sell',
    sentence: (name: string, fall: string, cut: string) =>
      `If ${name} falls more than ${fall}% below its reference, sell ${cut}% of it.`,
    add: 'Add a rule',
    remove: 'Remove this rule',
    bounds: 'A fall of 1% to 20%, selling 10% to all of it.',
  },
  fee: (amount: string) => `Fee so far: ${amount}, waived.`,
  feeNote: '0.5% a year of what the desk holds, nothing in practice. Waived during the beta.',

  record: {
    title: 'The record',
    empty: 'The desk has not checked yet.',
    quiet: (n: number) => `${n} quiet checks`,
    today: 'Today',
    yesterday: 'Yesterday',
    practice: 'practice',
    earlier: (n: number) => `${n} decisions on the desk’s earlier contract`,
    earlierExplorer: 'Every one is on the earlier contract’s page on the explorer',
    notes: {
      outside: (what: string) =>
        `Your balance is different from what the desk expected: ${what}. It has updated its picture, and your loss limit counts from the new amount.`,
      owner: (what: string) => `You ${what} yourself, from your wallet.`,
      ownerLabel: 'Your own call',
      outsideLabel: 'Changed outside the desk',
      multiplierLabel: 'Value changed with no trade',
      multiplier: (name: string, pct: string) =>
        `${name}’s multiplier rose ${pct}: a dividend paid as more token, not as cash. The holding is worth more with no trade.`,
      added: (amount: string) => `${amount} came in`,
      removed: (amount: string) => `${amount} went out`,
      calls: {
        Sold: 'sold',
        Bought: 'bought',
        Swept: 'moved cash to savings',
        Redeemed: 'took cash out of savings',
        Checkpoint: 'sealed the record',
      } as Record<string, string>,
      call: 'made a recorded call',
    },
    whole: 'The whole record',
    report: 'How it did',
  },

  chart: {
    title: 'Value',
    empty: 'The chart starts at the desk’s second check.',
    emptyTitle: 'Nothing to draw yet',
    acted: 'acted',
    waited: 'waited',
    earlier: 'on the earlier contract',
    earlierBand: 'Earlier contract',
    belowHigh: 'Below its high',
    worst: 'Worst dip',
    ranges: 'Time range',
    all: 'All',
    ddLabel: 'Dips',
    legendStart: 'Where it started',
    legend: { acted: 'Traded', would: 'Would have traded', waited: 'Chose to wait' },
    aria: (value: string, pct: string | null) =>
      `Desk value ${value}${pct === null ? '' : `, ${pct}% against where it started`}.`,
  },
} as const

/** The browser's session key, from Masayume's tap-to-act key: one key, at most seven days, revocable. */
export const sessionCopy = {
  title: 'This browser’s key',
  unsupported: 'This desk’s contract came before session keys, so your wallet signs its chain actions.',
  none: 'Give this browser a key and chat actions like a withdrawal run in one click, with no wallet pop-up.',
  live: (left: string) => `Active. It ends ${left}.`,
  expired: 'This browser’s key has ended. Give it a new one to keep one-click actions.',
  elsewhere: 'Another browser holds this desk’s key. Give this one its own, and the other stops working.',
  give: 'Give this browser a key',
  giving: 'Check your wallet…',
  revoke: 'Revoke the key',
  revoking: 'Revoking…',
  days: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
  lasts: 'Lasts',
  receipt: {
    title: 'What you are signing',
    can: 'It can',
    canValue:
      'withdraw to your own wallet only, pause the desk, remove the assistant, lower your limits, and sell inside the assistant’s own caps',
    cannot: 'It can never',
    cannotValue: 'buy, raise a limit, restart the desk, or send money anywhere but your wallet',
    ends: 'It ends',
    gas: 'Fees',
    gasValue: (eth: string) => `your wallet sends the key ${eth} ETH to pay its own fees`,
    signatures: 'Signatures',
    signaturesValue: 'two: the grant, then the fee top-up',
  },
  wrongWallet: 'Connect the wallet that owns this desk.',
  failed: 'The key was not granted. Nothing changed.',
  signWithKey: 'Your session key signs this. No wallet pop-up.',
  signWithWallet: 'Your wallet signs this.',
  sign: 'Sign and send',
  sending: 'Sending…',
  cancelled: 'You cancelled in your wallet. Nothing moved.',
  refusedByChain: 'The chain refused it. Nothing moved.',
  checking: 'Working out what this does and what it costs…',
  fee: (usd: string) => `Network fee: about ${usd}.`,
  feeTiny: 'Network fee: under a cent.',
  whoPays: { key: 'Your key pays it.', wallet: 'Your wallet pays it.' },
} as const

/**
 * The buttons beside the chat. Each opens one small form and makes the same card the chat would, so the checks and
 * the confirmation are the same whichever way the owner asks.
 */
export const controlsCopy = {
  title: 'Controls',
  intro: 'Each one shows you a card first. Nothing happens until you confirm it.',
  close: 'Close',
  review: 'Show me the card',
  reviewing: 'Checking…',
  closed: 'This desk is closed. Its record stays readable.',
  actions: {
    addMoney: 'Add money',
    withdraw: 'Withdraw',
    sellAll: 'Sell everything',
    pause: 'Pause',
    resume: 'Resume',
    mode: 'Mode',
    limits: 'Limits on the chain',
    checkNow: 'Check now',
    removeAssistant: 'Remove the assistant',
    restart: 'Restart the desk',
    closeDesk: 'Close the desk',
    editMandate: 'Edit what you told it',
  },
  words: {
    switchStrategy: (name: string) => `Move me into ${name}`,
    setWeights: 'Change my targets',
    setLimits: 'Change my settings',
    setNotes: 'Change my notes',
    setRules: 'Change my standing rules',
    addMoney: (amount: string) => `Add $${amount}`,
    withdraw: (amount: string) => `Withdraw $${amount}`,
    withdrawAll: (asStocks: boolean) =>
      asStocks ? 'Withdraw everything, as it is' : 'Withdraw everything, as cash',
    sellAll: 'Sell everything to cash',
    pause: 'Pause the desk',
    resume: 'Resume the desk',
    mode: (name: string) => `Switch to ${name}`,
    limits: 'Change the limits on the chain',
    checkNow: 'Check now',
    removeAssistant: 'Remove the assistant',
    restart: 'Restart the desk',
    closeDesk: (asStocks: boolean) =>
      asStocks ? 'Close the desk, sending the holdings as they are' : 'Close the desk, selling to cash',
  },
  addMoney: {
    eyebrow: 'Add money',
    title: 'Put money in your desk',
    body: 'Money goes into your own account. Only you can take it out.',
    here: 'I have USDG on Robinhood Chain',
    hereNote: 'Enter an amount and confirm in your wallet.',
    elsewhere: 'Bring dollars from another network',
    elsewhereNote:
      'From Base, Arbitrum, Ethereum or BNB Chain. It arrives in seconds, and sends a little ETH with it for fees.',
    amount: 'Amount in dollars',
    minimum: 'At least $20 is sensible: below that, the fixed fees of each trade take too large a share.',
    from: 'From',
    usdcAmount: 'USDC to send',
    quote: 'Get a quote',
    quoting: 'Asking Relay…',
    youSend: 'You send',
    youReceive: 'Your desk receives about',
    cost: 'Cost',
    takes: 'Takes',
    seconds: (n: number) => (n <= 60 ? 'usually seconds' : `about ${Math.ceil(n / 60)} minutes`),
    gas: 'Also send about $1 of ETH to my own wallet on Robinhood Chain, for my network fees',
    send: (chain: string) => `Send from ${chain}`,
    held: (amount: string, chain: string) => `Your wallet holds ${amount} USDC on ${chain}.`,
    progress: {
      switching: (chain: string) => `Switching your wallet to ${chain}…`,
      signing: (n: number, of: number) => `Confirm in your wallet (${n} of ${of})…`,
      waiting: 'Sent. Waiting for it to arrive on Robinhood Chain…',
      back: 'Arrived. Switching your wallet back to Robinhood Chain…',
      done: (amount: string) =>
        `Arrived: about ${amount} is in your desk. Your agent notices it within five minutes.`,
      failed:
        'It did not go through. If anything left your wallet, Relay returns it. Nothing reached the desk.',
      cancelled: 'You cancelled in your wallet. Nothing was sent.',
    },
  },
  withdraw: {
    eyebrow: 'Withdraw',
    title: 'Take money out',
    body: 'It goes to your own wallet, and nowhere else. That address is fixed by your account and cannot be changed here.',
    to: 'To',
    some: 'Some',
    all: 'Everything',
    amount: 'Amount in dollars',
    cashNow: (amount: string) => `${amount} is in cash now.`,
    asCash: 'Sell the holdings to cash first',
    asStocks: 'Send the holdings as they are',
  },
  sellAll: {
    eyebrow: 'Sell everything',
    title: 'Turn every holding into cash',
    body: 'Every Stock Token the desk holds is sold to USDG inside the desk. Nothing leaves your account. You see what each sells for before you sign.',
  },
  pause: {
    eyebrow: 'Pause',
    title: 'Stop the desk acting',
    body: 'Nothing is sold. It stops acting until you resume it, and waiting requests are cancelled.',
    resumeTitle: 'Let the desk carry on',
    resumeBody: 'It carries on from its next look.',
  },
  mode: {
    eyebrow: 'Mode',
    title: 'How much the desk does on its own',
    locked: (done: number, needed: number, read: boolean) =>
      `Going live needs ${needed} practice checks and the practice report read. This desk has done ${done}${read ? ', and you have read the report' : ', and the report is not read yet'}.`,
    onItsOwn: 'On its own means it acts inside your limits without asking, and still asks for large actions.',
    current: 'Now',
  },
  limits: {
    eyebrow: 'Limits on the chain',
    title: 'The most the assistant may spend',
    body: 'Your account itself holds the assistant to these, whatever it decides. Lowering them runs on your session key; raising them needs your wallet.',
    perAction: 'Most per action, in dollars',
    daily: 'Most per day, in dollars',
    settings: (perAction: string, daily: string) =>
      `Your settings also say ${perAction} per action and ${daily} a day. The desk keeps to whichever is lower.`,
  },
  editMandate: {
    eyebrow: 'What you told it',
    title: 'Change your instructions',
    body: 'Pick what to change. The card shows before and after, and the change applies from the next look. No model is asked.',
    parts: {
      strategy: 'Strategy',
      weights: 'Targets',
      limits: 'Settings',
      notes: 'Notes',
      rules: 'Rules',
    },
    strategy: 'Move to a ready-made basket. Only the mix changes; your limits and notes stay.',
    cash: 'Cash kept aside',
    total: (pct: string) => `Total ${pct}. It must be 100%.`,
    drift: 'May wander before it acts',
    position: 'Largest share of one stock',
    loss: 'Stops after a fall of',
    notes: 'Your notes, in your own words',
    notesHint:
      'They reach the assistant as context for when to act, never as an instruction to size or hold.',
  },
  check: {
    eyebrow: 'Check now',
    title: 'Look at everything now',
    body: 'The desk checks now and decides as it always does. It may still choose to wait.',
  },
  remove: {
    eyebrow: 'Remove the assistant',
    title: 'Take away all its access',
    body: 'It loses all access at once and the desk stops. Your money stays in your account. You can bring it back later with your wallet.',
  },
  restart: {
    eyebrow: 'Restart',
    title: 'Restart the desk on-chain',
    body: 'If you removed the assistant, this brings it back too. Only your wallet can do this.',
  },
  closeDesk: {
    eyebrow: 'Close the desk',
    title: 'Close this desk for good',
    body: 'One signature sells or sends everything to your own wallet, removes the assistant and stops all checks. The record stays readable afterwards.',
    asCash: 'Sell everything to cash, then send it',
    asStocks: 'Send the holdings as they are',
  },
} as const

/** Settings: Telegram, the share link, the disclosure, and how it looks. */
export const settingsCopy = {
  title: 'Settings',
  back: 'Back to your desk',
  telegram: {
    bot: 'ShijimaBot',
    title: 'Telegram',
    body: 'Approvals, what the desk did, and alerts, in a chat with @ShijimaBot. You can answer requests there too.',
    connected: (name: string | null) => (name ? `Connected as @${name}.` : 'Connected.'),
    connect: 'Connect Telegram',
    making: 'Making a code…',
    scan: 'Scan with your phone, or open the link. The code works once, for ten minutes.',
    open: 'Open in Telegram',
    orSend: (code: string) => `Or send the bot this code: ${code}`,
    waiting: 'Waiting for you to press Start in Telegram…',
    waitingPress: 'Press Start in Telegram. This page turns green as soon as it does.',
    openAgain: 'Open Telegram again',
    qr: 'QR code',
    disconnect: 'Disconnect',
    disconnected: 'Disconnected. The bot no longer answers for this desk.',
    without: 'Without Telegram, requests that need your answer only reach you here on the website.',
  },
  connections: {
    title: 'Connections',
    body: 'What this desk is linked to. Telegram is yours to connect or disconnect; the other two are fixed.',
    wallet: 'Wallet',
    walletBody: 'The only address that can withdraw, change limits or close this desk.',
    owner: 'Your wallet',
    desk: 'This desk',
    view: 'View on Blockscout',
    agent: 'OpenServ agent',
    agentBody:
      'The agent that watches this desk around the clock. It can trade only inside the limits the desk contract enforces, and never withdraw.',
    agentId: (id: number) => `Agent ${id}`,
    openAgent: 'Open on OpenServ',
    openIdentity: 'See the identity',
    /** Linking an OpenServ workspace, so its chat and tasks reach this desk's agent. */
    workspace: {
      intro:
        'Talk to this agent from your own OpenServ workspace: add Shijima there, then send it a code from here.',
      make: 'Make a link code',
      making: 'Making a code…',
      send: 'In your OpenServ workspace, send Shijima:',
      expires: 'The code works once, for 30 minutes.',
      linked: (n: number) => `Linked to ${n === 1 ? 'one OpenServ workspace' : `${n} OpenServ workspaces`}.`,
      unlink: 'Unlink',
      copied: 'Copied',
      copy: 'Copy',
    },
  },
  share: {
    title: 'Share a read-only link',
    body: 'Anyone with the link sees this desk’s holdings and record, never your chat or your notes. Turn it off at any time.',
    on: 'Sharing is on',
    off: 'Sharing is off',
    turnOn: 'Turn sharing on',
    turnOff: 'Turn sharing off',
    copy: 'Copy link',
    copied: 'Copied',
  },
  disclosure: {
    title: 'What you agreed to',
    accepted: (when: string) => `You accepted this on ${when}.`,
    notAccepted: 'Not accepted yet. Read it, and accept it before any money moves.',
    declare: 'I am not in a place where Stock Tokens are restricted.',
    accept: 'I have read this and accept it',
    read: 'Read it again',
    signIn: 'Sign in first. Accepting is tied to your wallet.',
    failed: 'Your acceptance could not be saved. Nothing else changed; try again in a moment.',
  },
  appearance: { title: 'Appearance', body: 'Dark or light. It is remembered in this browser.' },
  close: {
    title: 'Close the desk',
    body: 'Sells or sends everything to your own wallet, removes the assistant and stops the checks, in one signature. The record stays readable.',
  },
  withdrawAnywhere: 'Take your money out without this website',
} as const

/** The bell: what the desk told you, the same messages Telegram carries. */
export const inboxCopy = {
  title: 'Messages',
  aria: (n: number) => (n > 0 ? `${n} unread messages` : 'Messages'),
  empty: 'Nothing yet. What the desk does and asks appears here, and in Telegram if you connect it.',
  markRead: 'Mark all as read',
  kinds: {
    approval_request: 'Asking you',
    large_action_request: 'Asking you, large',
    acted: 'Acted',
    would_have: 'Would have acted',
    not_acted: 'Chose not to act',
    alert: 'Alert',
    monday_report: 'After the reopen',
    price_alert: 'Price alert',
  },
} as const

/**
 * The disclosure, design brief 8.3. Versioned: a change to the words asks every owner to accept again.
 * Plain words, short sections, one acceptance at the end.
 */
export const DISCLOSURE_VERSION = 'disclosure.v1'
export const disclosureCopy = {
  title: 'Before any money moves',
  sections: [
    {
      heading: 'A Stock Token is not a share',
      body: 'It is a debt note from a company in Jersey that follows a stock’s price. It gives you no voting rights and no ownership of the company. If the issuer fails, you could lose everything.',
    },
    {
      heading: 'Who may not hold them',
      body: 'People in the US, the UK, Canada, Switzerland and some other places may not hold Stock Tokens. By accepting, you confirm you are not in one of those places.',
    },
    {
      heading: 'Nights and weekends',
      body: 'Prices at night and on weekends can differ from the next official opening price. There are fewer buyers and sellers, so prices are worse and large orders cost more. Trading in a token can be paused without warning, for example around a company event.',
    },
    {
      heading: 'Dividends and the multiplier',
      body: 'Dividends are not paid in cash. They raise the token’s multiplier, so after one, a token is no longer exactly one share.',
    },
    {
      heading: 'What the assistant can and cannot do',
      body: 'It can trade inside your account, inside your limits. It cannot send your money anywhere else; only you can take money out. It uses an AI model to judge timing, and it can be wrong. Your limits apply whatever it decides.',
    },
    {
      heading: 'The honest worst case',
      body: 'The assistant cannot send your funds to anyone. If its key were ever stolen, the thief could only make bad trades, costing at most 8% of your daily limit in each 24-hour spending window (so at most twice that across a window boundary), until you remove the assistant. You are told about every trade.',
    },
    {
      heading: 'When prices move far',
      body: 'If a price moves more than 8% away from its last official update, your account refuses the assistant’s trades in that token. You can still sell yourself.',
    },
    {
      heading: 'What no product can change',
      body: 'The company that issues Stock Tokens can pause a token, block an address or cancel tokens.',
    },
  ],
} as const

/**
 * Link previews (FIDELITY L-23): the words on the images a link shows in X, Telegram or a chat. The face is Sora
 * SemiBold, which has the middle dot and the dash but no kanji and no arrows, so none reach a card.
 */
export const ogCopy = {
  site: {
    alt: 'Shijima: an AI desk for your Stock Tokens. You choose what to hold; it decides only when, inside hard limits.',
    eyebrow: 'Stock Tokens on Robinhood Chain',
    lead: 'You choose what to hold.',
    em: 'It decides only when.',
    line: 'Inside limits the network enforces. Every decision on the record.',
  },
  honesty: 'Stock Tokens are not shares · nothing here is advice',
  desk: {
    alt: 'A shared Shijima desk: its name, its mode and its last check.',
    eyebrow: 'A shared desk',
    checks: (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'check' : 'checks'} on the record`,
    lastCheck: (ago: string) => `Last check ${ago}`,
    noCheck: 'No check yet',
  },
  stock: {
    alt: 'A Stock Token on Shijima: its pool price against its reference, and how old that is.',
    eyebrow: 'Stock Token',
    gap: (pct: string, side: 'above' | 'below') => `${pct} ${side} its reference`,
    inLine: 'In line with its reference',
    priced: (ago: string) => `Pool price, logged ${ago}`,
    noPrice: 'No price logged yet',
  },
} as const

/**
 * The share card for one decision (FIDELITY L-22), drawn in the browser on Agari's ticket. Every word is built
 * from the record. No headline text ever reaches a card: the news licence forbids passing it on.
 */
export const shareCopy = {
  brand: 'SHIJIMA',
  recordType: 'DECISION RECORD · ROBINHOOD CHAIN',
  scan: 'SCAN TO CHECK THE RECORD',
  handle: 'TELEGRAM @SHIJIMABOT',
  verifyOn: 'CHECK IT ON ROBINHOOD CHAIN',
  shareCard: 'Share card',
  rendering: 'Drawing…',
  savedAttach: 'Card saved. Attach it to your post on X.',
  renderFailed: 'The share card could not be drawn.',
  vault: 'THE SAVINGS VAULT',
  hero: {
    acted: { buy: 'Bought.', sell: 'Sold.', sweep: 'Parked cash.', redeem: 'Took cash back.' },
    acted_in_part: 'Acted in part.',
    acted_by_override: 'Acted on your call.',
    would_have_acted: { buy: 'Would have bought.', sell: 'Would have sold.' },
    waited: 'Waited.',
    declined: 'Declined.',
    asked: 'Asked first.',
    blocked_by_limit: 'Blocked by a limit.',
    nothing_to_do: 'Nothing to do.',
    failed: 'No decision.',
    not_executed: 'Not carried out.',
  },
  size: (amount: string, side: string) => `${amount} ${side.toUpperCase()}`,
  intoVault: (amount: string, rate: string | null) =>
    `${amount} INTO THE SAVINGS VAULT${rate ? ` AT ${rate} A YEAR` : ''}`,
  outOfVault: (amount: string) => `${amount} BACK OUT OF THE SAVINGS VAULT`,
  gap: (compared: string) =>
    compared === 'in line' ? 'IN LINE WITH ITS REFERENCE' : `${compared.toUpperCase()} ITS REFERENCE`,
  sure: (pct: number) => `${pct}% SURE`,
  graded: {
    better: (pct: string) => `GRADED AT THE REOPEN: ${pct} BETTER THAN ACTING AT ONCE`,
    worse: (pct: string) => `GRADED AT THE REOPEN: ${pct} WORSE THAN ACTING AT ONCE`,
    no_real_difference: 'GRADED AT THE REOPEN: NO REAL DIFFERENCE EITHER WAY',
    ungradable: 'THIS ONE CANNOT BE GRADED',
    pending: 'NOT GRADED YET · GRADED AFTER THE US MARKET REOPENS',
    never: 'NOT A TIMING CALL, SO NEVER GRADED',
  },
  proof: {
    record: (hash: string) => `RECORD ${hash}`,
    tx: (hash: string) => `TX ${hash}`,
    sealedLater: 'SEALED BY THE NEXT ACTION OR THE DAILY SEAL',
  },
  mode: { shadow: 'PRACTICE', ask_first: 'ASKS FIRST', on_its_own: 'ON ITS OWN' },
  withinRange: 'EVERY HOLDING WITHIN ITS ALLOWED RANGE',
  /** The pre-filled post: real fields only, never a claim of an edge. */
  tweet: (parts: string[], grade: string | null, url: string) =>
    `${parts.join(' · ')}.${grade ? ` ${grade}.` : ''} Every decision is fingerprinted on Robinhood Chain. ${url}`,
  tweetGrade: {
    better: (pct: string) => `Graded at the reopen: ${pct} better than acting at once`,
    worse: (pct: string) => `Graded at the reopen: ${pct} worse than acting at once`,
    no_real_difference: 'Graded at the reopen: no real difference either way',
  },
} as const

/**
 * A Stock Token's Room, from Masayume and Agari (`features/room/copy.ts`), for desk owners instead of bettors. The
 * onboarding states each say what this is, why you cannot speak yet, and what would change that.
 */
export const roomCopy = {
  open: (symbol: string) => `${symbol} Room`,
  qualifier: 'desk owners only',
  title: (name: string) => `${name} · the Room`,
  close: 'Close',
  compose: 'Say something',
  send: 'Send',
  sending: 'Sending…',
  holds: (symbol: string) => `Show that my desk holds ${symbol}`,
  holdsBadge: 'holds it',
  you: 'you',
  empty: 'No one has said anything yet. Go first.',
  where: 'Plain text, kept by Shijima, shown with your wallet. Your desk’s assistant never reads the Room.',
  start: 'Start a desk',
  states: {
    unavailable: {
      title: 'The Room is not reachable right now.',
      body: 'Its store did not answer. Everything else on this stock works.',
    },
    connect: {
      title: 'The Room is for people with a desk.',
      body: 'Connect your wallet and sign in, and the Room checks whether you own one.',
    },
    locked: {
      title: 'You need a desk to join.',
      body: 'The Room is for desk owners, so everyone here has put money behind their own mix. Start a desk, even in practice, and it opens.',
    },
  },
  errors: {
    badRequest: 'That did not make sense. Nothing was posted.',
    notMember: 'The Room is for desk owners. Sign in with the wallet that owns your desk.',
    rateLimited: 'That is a lot at once. Give it a few seconds and try again.',
    postFailed: 'That did not post. Try again.',
  },
} as const

/** Takes, from Agari (`features/takes/copy.ts`): one short post about a Stock Token. No calls, no sides, no bets. */
export const takesCopy = {
  pill: 'Take',
  postAria: 'Post a take',
  holdsBadge: '✓ desk holds it',
  noBadge: 'desk owner',
  seeStock: (name: string) => `See ${name} →`,
  room: 'the Room ↗',
  startDesk: 'Start a desk',
  composer: {
    title: 'Post a take',
    close: 'Close',
    where:
      'Your words are kept by Shijima and shown with your wallet. Your desk’s assistant never reads them.',
    stock: 'About',
    placeholder: 'What do you make of it? Name another with $TICKER.',
    holds: (symbol: string) => `Show that my desk holds ${symbol}`,
    post: 'Post take',
    posting: 'Posting…',
    posted: 'Take posted',
    permanence: 'A take is public and stays up.',
    connect: 'Sign in with the wallet that owns your desk to post.',
    noDesk: 'Takes are for desk owners. Start a desk, even in practice, and you can post.',
  },
  errors: {
    badRequest: 'That did not make sense. Nothing was posted.',
    notMember: 'Takes are for desk owners. Sign in with the wallet that owns your desk.',
    rateLimited: 'That is a lot of takes at once. Give it a minute.',
    postFailed: 'That did not post. Try again.',
  },
} as const

/**
 * Reels, from Agari (`app/reels`): a vertical feed of the Stock Tokens, what shared desks decided, and takes.
 * There is nothing to bet on. Every card leads to a page where its numbers come from.
 */
export const reelsCopy = {
  title: 'Reels',
  stockMeta: (name: string) => `${name} · Stock Token`,
  poolPrice: 'pool price',
  priced: (ago: string) => `logged ${ago}`,
  versusReference: 'vs its reference',
  gapHead: (name: string, compared: string) =>
    compared === 'in line' ? `${name} is in line with its reference` : `${name} is ${compared} its reference`,
  noPrice: 'No price logged yet',
  referenceRule:
    'The reference is the pool at the last regular close, or the price feed while the market is open.',
  seeStock: 'See the stock →',
  cost: (amount: string, bps: string) => `$1,000 in costs about ${amount} (${bps})`,
  decisionMeta: (desk: string) => `${desk} · a shared desk`,
  readDecision: 'Read why →',
  sure: (pct: number) => `${pct}% sure`,
  swipeHint: 'Swipe up for the next card',
  reading: 'Reading the market…',
  nothing: 'Nothing to show yet.',
  take: 'Take',
  postTake: 'Post a take',
} as const
