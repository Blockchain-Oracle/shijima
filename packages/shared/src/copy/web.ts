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
  watch: 'Desks you can watch',
  noneShared: 'No desk has been shared yet.',
  running: (age: string) => `running since ${age}`,
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
  settingsLink: 'Settings',
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
    /** The desk's side of an exchange started from a button: the card is the answer. */
    fromButton: 'Here it is. Check the card, and nothing happens until you confirm.',
    fromButtonLabel: 'from a button',
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
  },
  words: {
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
        `Arrived: about ${amount} is in your desk. It is put to work at the next check.`,
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
    resumeBody: 'It carries on from its next check.',
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
    disconnect: 'Disconnect',
    disconnected: 'Disconnected. The bot no longer answers for this desk.',
    without: 'Without Telegram, requests that need your answer only reach you here on the website.',
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
      body: 'The assistant cannot send your funds to anyone. If its key were ever stolen, the thief could only make bad trades, costing at most 8% of your daily limit per day, until you remove the assistant. You are told about every trade.',
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
