/**
 * The website's landing page (`/` for a visitor, `/home` for everyone): the motto, the hero, the three screens,
 * how the money moves, what is live, the strategies, how to check it, and where to get it. Written in dollars,
 * never in basis points, because that is how a person thinks about their own money.
 */
const MOTTO = 'Shijima · AI agents that trade Stock Tokens 24/7 on Robinhood Chain'
const HERO_LINE = 'An AI agent that trades your Robinhood Stock Tokens 24/7, inside limits only you set.'

export const homeCopy = {
  motto: MOTTO,
  /** The motto without the name, for places that already show the name beside it. */
  mottoLine: 'AI agents that trade Stock Tokens 24/7 on Robinhood Chain',
  meta: {
    title: MOTTO,
    description: `Wall Street closes. Your agent doesn't. ${HERO_LINE}`,
  },

  nav: {
    home: 'Shijima home',
    primary: 'Website',
    how: 'How it works',
    live: 'Live',
    docs: 'Docs',
    open: 'Open the app',
  },

  hero: {
    aria: MOTTO,
    titleLead: 'Wall Street closes.',
    titleEm: 'Your agent doesn’t.',
    line: HERO_LINE,
    primary: 'Create your agent',
    secondary: 'Watch a live agent',
    live: 'Live on Robinhood Chain mainnet',
    shot: 'A live Shijima agent: its money, and its latest decision, bought $0.94 of Nvidia',
  },

  /** The three screens under the hero. Each front is the real page, live; the back says what it is for. */
  showcase: {
    aria: 'Shijima on the web, on a phone and in Telegram',
    show: (title: string) => `${title}, show actions`,
    back: 'tap to flip back',
    web: {
      title: 'Web app',
      meta: 'live agent · desktop',
      back: 'Your agents, their money and every decision they made, in the browser. This is the live showcase agent, right now.',
      cta: 'Open the app',
    },
    phone: {
      title: 'Phone',
      meta: 'same app · any phone',
      back: 'The same app at phone width. Open it in your phone’s browser and add it to your home screen. No app store.',
      cta: 'Watch it on your phone',
    },
    telegram: {
      title: 'Telegram',
      meta: 'approvals · alerts',
      back: 'Your agent messages you when it acts or needs you. Approve, pause or ask it anything from the chat.',
      cta: (bot: string) => `Open @${bot}`,
    },
  },

  /** The static chat on the Telegram card: the bot's own first words, then the live agent's latest decision. */
  chat: {
    bot: 'bot',
    hello: 'This is Shijima.',
    first:
      'I watch every five minutes and wake when something moves. I will message you when something needs you, or when I have done something. Nothing else.',
    latest: 'Latest decision',
    none: 'The live agent’s first decision is on the way.',
    scan: 'Scan to open the bot',
  },

  builtOn: {
    label: 'Built on',
    names: ['Robinhood Chain', 'Uniswap', 'Chainlink', 'Morpho', 'SERV Reasoning', 'Coinbase AgentKit'],
    trades: 'trades on mainnet',
    moved: 'moved by agents',
    rate: 'on idle cash now',
    prices: 'Live prices',
  },

  platforms: {
    label: 'One agent · everywhere',
    title: 'The same agent, on every screen.',
    sub: 'The web app, your phone and Telegram all show the same agent, the same money and the same record. Only the shape changes.',
    cards: [
      {
        title: 'Web app',
        meta: 'desktop',
        body: 'Everything: create an agent, fund it, watch every decision, copy another agent, take money out.',
        spec: 'YOUR BROWSER WALLET · MAINNET',
      },
      {
        title: 'Phone',
        meta: 'any phone browser',
        body: 'The same app, thumb-first. Add it to your home screen and it opens full screen, like an app.',
        spec: 'ONE APP · ADD TO HOME SCREEN',
      },
      {
        title: 'Telegram',
        meta: 'in your chats',
        body: 'Approvals, trades and alerts for all your agents in one chat. Answer an approval and it acts, or does not.',
        spec: 'ONE CHAT · EVERY AGENT',
      },
    ],
  },

  /** How the money moves. The reference's "privacy model", as who holds the money. */
  model: {
    label: 'Your money, your keys',
    title: 'Money in. Agent trades. Only you take it out.',
    link: 'Take your money out without this website',
    steps: [
      {
        tone: 'in',
        tag: 'Money in',
        title: '1 · Money in',
        body: 'Put in USDG on Robinhood Chain, or bring money from Base, Arbitrum, Ethereum or BNB in one step. It lands as USDG in your agent’s own account, from $1.',
      },
      {
        tone: 'agent',
        tag: 'Agent trades',
        title: '2 · Agent trades',
        body: 'Stock Tokens trade all 168 hours of the week; New York is open for about 32. Your agent keeps your basket on plan through the other 136, only inside the limits you set, and writes each decision’s fingerprint on chain.',
      },
      {
        tone: 'out',
        tag: 'Only you',
        title: '3 · Only you take it out',
        body: 'Money leaves only to your own wallet, and the contract enforces it: not Shijima, not the agent. Pause, take everything out or remove the agent, each in one step.',
      },
    ],
    weekendNone:
      'On weekends, Stock Token prices keep moving while New York is shut, sometimes by 2 or 3 percent.',
    promisesTitle: 'What your agent can and cannot do',
    promises: [
      'It is your account. Your agent can trade inside it, but only you can take money out, and only to your own wallet.',
      'It stays inside your limits. The most per trade, the most per day and the loss that stops everything are enforced by the chain itself.',
      'It always explains itself: its reason, the options it turned down and how sure it was, even when it does nothing.',
      'The record cannot be quietly changed. A fingerprint of every decision is written on the public network.',
      'Trading is free. Shijima takes nothing from your trades or from what your agent holds.',
    ],
    worstTitle: 'If something goes wrong',
    worstCase:
      'The honest worst case: your agent can never send your money anywhere. If its key were ever stolen, the thief could only make bad trades, costing at most 8% of your daily limit in a day, until you remove it.',
    never:
      'Your agent never predicts a price and never promises gain. It keeps your plan, carefully, and shows its work.',
  },

  live: {
    label: 'Live',
    all: 'Every agent',
    worth: 'Worth',
  },

  strategies: {
    label: 'Strategies',
    title: 'Pick a strategy',
    sub: 'Each one is a basket of US stocks. What it did over the last 30 days is shown, not promised.',
    start: 'Start with this',
    all: 'See all twenty, or build your own',
    days: (n: number) => `last ${n} days`,
    noChange: 'too new to show',
    dollars: {
      title: (basket: string) => `Your $100 in ${basket}`,
      each: (amount: string, n: number) =>
        `Your agent buys about ${amount} of each of the ${n} stocks, and keeps the rest as cash.`,
      cash: (amount: string) => `${amount} stays as cash, so there is always money for the next move.`,
      earns: (rate: string) => `While it waits, idle cash earns about ${rate} a year in the savings vault.`,
      earnsUnknown: 'While it waits, idle cash can earn interest in the savings vault.',
      drift:
        'If Nvidia jumps and your 12% becomes 16%, your agent notices, decides when to sell some back to plan, and tells you why.',
      cashName: 'Cash',
    },
  },

  proof: {
    label: 'Check it yourself',
    title: 'You do not have to trust this page.',
    sub: 'Every decision leaves a fingerprint on chain, and your own browser can check it.',
    how: [
      {
        title: '1 · Open a decision',
        body: 'Each one says what the agent chose, the options it turned down and how sure it was.',
      },
      {
        title: '2 · Find its fingerprint',
        body: 'The same transaction as the trade carries the decision’s hash, on the agent’s own account.',
      },
      {
        title: '3 · Check it',
        body: 'Your browser reads the transaction from the network and recomputes the hash. They match, or they do not.',
      },
    ],
    recent: 'The live agent’s latest decisions',
    none: 'The live agent has no decisions to show yet.',
    runs: 'Runs on OpenServ',
    status: 'Is it awake right now?',
  },

  get: {
    label: 'Get Shijima',
    title: 'Open it once. Same agent everywhere.',
    web: {
      title: 'On the web',
      body: 'No app store. Open Shijima in any browser, on your computer or your phone, and add it to your home screen.',
      open: 'Open the app',
      watch: 'Watch a live agent',
      small:
        'Sign in with MetaMask, Rabby or Robinhood Wallet. Scan to open it on your phone. Stock Tokens are not available to people in the US, the UK, Canada or Switzerland.',
      qr: 'QR code that opens Shijima',
    },
    telegram: {
      title: 'On Telegram',
      body: 'Approvals, trades and alerts for all your agents, in one chat.',
      open: (bot: string) => `Open @${bot}`,
      small:
        'After you sign in, connect it from Settings: the app shows a one-time code, and the bot links to your agents.',
      qr: 'QR code that opens the Telegram bot',
    },
  },

  footerCta: {
    title: 'Your stocks. Your agent. Your keys.',
    body: 'An AI agent for Robinhood Chain Stock Tokens. It trades inside limits you set, and only you can take money out.',
    primary: 'Open the app',
    secondary: 'Watch a live agent',
    flag: 'Real money · Robinhood Chain mainnet · not advice',
  },

  who: 'Stock Tokens are not available to people in the US, the UK, Canada or Switzerland. Nothing here is advice.',
} as const
