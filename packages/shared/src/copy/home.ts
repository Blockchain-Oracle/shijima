/**
 * `/` for a visitor: what Shijima is, in the order a stranger needs it. Put in USDG, pick a basket, your AI agent
 * keeps it on plan while New York is shut, you see every decision, Telegram tells you. The add-ons come after.
 * Written in dollars, never in basis points, because that is how a person thinks about their own money.
 */
export const homeCopy = {
  meta: {
    title: 'Shijima · an AI agent for your Stock Tokens',
    description:
      'Put in USDG, pick a basket of US stocks, and your own AI agent keeps it on plan around the clock, inside limits your account enforces.',
  },
  hero: {
    eyebrow: 'しじま · An AI agent for your Stock Tokens · Robinhood Chain',
    titleLead: 'Your money keeps its plan.',
    titleEm: 'Even while Wall Street sleeps.',
    line: 'Put in USDG, pick a basket of US stocks, and your own AI agent keeps it on plan around the clock, inside limits your account enforces on the chain. It writes down every decision and tells you on Telegram.',
    primary: 'Start with $20 of USDG',
    secondary: 'Watch a live agent',
    practice: 'Try it in practice first: it decides for real and spends nothing.',
  },
  live: {
    eyebrow: 'A live agent, right now',
    open: 'Open this desk',
    latest: 'Its latest decision',
    value: 'Worth',
    none: 'The live desk is not shared right now.',
    check: 'Every decision is fingerprinted on the chain',
  },
  steps: {
    index: '01',
    title: 'How it works',
    desc: 'Five steps, and you only do the first two.',
    items: [
      {
        kicker: 'You',
        title: 'Put in USDG',
        body: 'USDG is a digital dollar. Bring it on Robinhood Chain, or from Base, Arbitrum, Ethereum or BNB Chain in one step. $20 is enough to start.',
        art: ['USDG', 'from Base', '$20 and up'],
      },
      {
        kicker: 'You',
        title: 'Pick a strategy',
        body: 'A basket of US stocks at target weights: the giants, the whole US market, the companies building AI, or your own mix. Some stays as cash.',
        art: ['The giants', 'S&P 500', 'your own'],
      },
      {
        kicker: 'Your agent',
        title: 'It keeps watch',
        body: 'Stock Tokens trade all 168 hours of the week. New York is open for about 32 of them. Your agent watches the other 136 too.',
        art: ['nights', 'weekends', 'holidays'],
      },
      {
        kicker: 'Your agent',
        title: 'It decides when, and writes it down',
        body: 'When a holding drifts from your plan, it decides: act now, act in part, wait for New York to reopen, or not at all. Every decision, even “nothing to do”, is fingerprinted on the chain.',
        art: ['act', 'wait', 'decline'],
      },
      {
        kicker: 'You',
        title: 'You are told',
        body: 'Telegram tells you when it acts or needs you. Approve, pause, or ask it anything, in the chat or the bot.',
        art: ['Telegram', 'approve', 'pause'],
      },
    ],
  },
  dollars: {
    index: '02',
    title: 'Your $100, on duty',
    desc: 'What happens to your money, in dollars.',
    lead: (basket: string) => `You put in $100 of USDG and pick ${basket}.`,
    each: (amount: string, n: number) =>
      `Your agent buys about ${amount} of each of the ${n} stocks, and keeps the rest as cash.`,
    cash: (amount: string) => `${amount} stays as cash, so there is always money for the next move.`,
    earns: (rate: string) => `While it waits, idle cash earns about ${rate} a year in the savings vault.`,
    earnsUnknown: 'While it waits, idle cash can earn interest in the savings vault.',
    drift:
      'If Nvidia jumps and your 12% becomes 16%, your agent notices, decides when to sell some back to plan, and tells you why.',
  },
  weekend: {
    index: '03',
    title: 'Why nights and weekends',
    desc: 'The hours nobody is watching your stocks.',
    open: 'New York open',
    shut: 'Stock Tokens still trading',
    hours: (n: number) => `${n} hours`,
    fact: (name: string, move: string, day: string) =>
      `On the weekend of ${day}, ${name} moved ${move} from where New York closed, while New York was shut.`,
    noFact:
      'On weekends, Stock Token prices keep moving while New York is shut, sometimes by 2 or 3 percent.',
    never:
      'Your agent never predicts a price and never promises gain. It keeps your plan, carefully, and shows its work.',
  },
  strategies: {
    index: '04',
    title: 'Pick a strategy',
    desc: 'Each one is a basket of US stocks. What it did over the last 30 days is shown, not promised.',
    start: 'Start with this',
    all: 'See every strategy, or build your own',
  },
  promises: {
    index: '05',
    title: 'What your agent can and cannot do',
    desc: 'Five promises, each one checkable.',
    items: [
      'It is your account. Your agent can trade inside it, but only you can take money out, and only to your own wallet.',
      'It stays inside your limits. The most per trade, the most per day and the loss that stops everything are enforced by the chain itself.',
      'It always explains itself: its reason, the options it turned down and how sure it was, even when it does nothing.',
      'The record cannot be quietly changed. A fingerprint of every decision is written on the public network.',
      'You can stop it at any moment: pause, take everything out, or remove it, each in one step.',
    ],
    worstCase:
      'The honest worst case: your agent can never send your money anywhere. If its key were ever stolen, the thief could only make bad trades, costing at most 8% of your daily limit in a day, until you remove it.',
    withdraw: 'Take your money out without this website',
  },
  proof: {
    index: '06',
    title: 'Proof you can open',
    desc: 'The contracts, the agent on OpenServ, and the live record.',
    desk: 'The live desk contract',
    factory: 'The desk factory',
    agent: 'The agent on OpenServ',
    identity: 'Its on-chain identity (ERC-8004, Base)',
    reasoning: 'Its reasoning',
    reasoningValue: 'SERV Reasoning, on every timing decision',
    recent: 'Latest decisions on the live desk',
    status: 'Is it awake right now?',
  },
  install: {
    title: 'On your phone',
    line: 'No app store. Open Shijima in your phone’s browser and add it to your home screen, and connect Telegram so your agent can reach you.',
  },
  who: 'Stock Tokens are not available to people in the US, the UK, Canada or Switzerland. Nothing here is advice.',
} as const
