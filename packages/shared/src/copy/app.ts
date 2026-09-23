/**
 * The signed-in app's own words: the sidebar, the phone bar, and the pages the sidebar opens (Overview, Activity,
 * Settings). An agent is what the owner sees; "desk" is only the contract's name in code.
 */
export const appCopy = {
  sidebar: {
    aria: 'Shijima',
    home: 'Overview',
    groups: { you: 'You', agents: 'Your agents', discover: 'Discover' },
    overview: 'Overview',
    needsYou: 'Needs you',
    activity: 'Activity',
    newAgent: 'New agent',
    markets: 'Markets',
    liveAgents: 'Live agents',
    strategies: 'Strategies',
    reels: 'Reels',
    settings: 'Settings',
    landing: 'Shijima home',
    toggle: 'Toggle sidebar',
    close: 'Close sidebar',
    copying: (leader: string) => `copying ${leader}`,
    noValue: 'not valued yet',
    status: {
      running: 'Running',
      needsYou: 'Needs you',
      paused: 'Paused',
      practice: 'Practice',
      closed: 'Closed',
    },
    signedOut: {
      title: 'Your agents live here',
      body: 'Connect a wallet to start an agent, or copy one that is already running.',
    },
    runsOn: 'Runs on OpenServ',
    reasoning: 'decisions by SERV Reasoning',
  },

  wallet: {
    aria: 'Your wallet',
    usdg: 'USDG',
    gas: 'Gas',
    /** Signatures, not trades: the agent's trades are paid by Shijima. */
    gasLeft: (n: number) => (n >= 100 ? '100+ signatures' : `~${n} signature${n === 1 ? '' : 's'}`),
    gasNone: 'no gas: you cannot sign yet',
    gasTitle:
      'The ETH in your wallet pays for what you sign yourself: creating an agent, adding money, withdrawing. ' +
      "Your agent's trades are paid by Shijima, about 5¢ each.",
    getGas: 'Get gas',
    reading: 'reading…',
  },

  live: {
    badge: 'Live on Robinhood Chain mainnet',
    short: 'Live on mainnet',
    block: (n: string) => `block ${n}`,
    title: 'The network Shijima trades on, read from your browser right now.',
  },

  bottomBar: {
    aria: 'App navigation',
    overview: 'Overview',
    agents: 'Agents',
    markets: 'Markets',
    activity: 'Activity',
    menu: 'Menu',
  },

  topBar: {
    ask: 'Ask Shijima',
  },

  overview: {
    meta: 'Overview',
    kicker: 'Your agents, together',
    title: 'Overview',
    stats: {
      total: 'All your agents hold',
      totalNone: 'Not valued yet',
      day: 'In the last day',
      dayNone: 'A day of history is needed',
      agents: 'Agents',
      agentsNote: (running: number, practice: number) => `${running} trading · ${practice} in practice`,
      needs: 'Needs you',
      needsNone: 'Nothing waits on you',
      needsSome: (n: number) => `${n} request${n === 1 ? '' : 's'} to answer`,
    },
    chart: 'What they hold together',
    chartNote: 'Every agent added up, hour by hour. Money you add counts; it is not gain.',
    agentsTitle: 'Your agents',
    open: 'Open',
    noDecision: 'No decision yet. Its first look is on the next five-minute mark.',
    needsTitle: 'Waiting for your answer',
    needsEmpty: 'Nothing is waiting. Your agents act inside your limits and ask for anything larger.',
    answer: 'Answer',
    connectTitle: 'Connections',
    telegram: 'Telegram',
    openserv: 'OpenServ',
    connected: 'connected',
    notConnected: 'connect',
    connectBody: 'Approvals, trades and alerts in Telegram. Your agent in your own OpenServ workspace.',
    empty: {
      title: 'Start your first agent',
      body: 'An agent is an account on Robinhood Chain that only you can withdraw from, and an AI that trades it inside limits you set. Make one, or copy one that is already running.',
      create: 'Create an agent',
      copy: 'Copy an agent',
    },
  },

  activity: {
    meta: 'Activity',
    kicker: 'Every agent, every decision',
    title: 'Activity',
    tabs: { all: 'All', needs: 'Needs you', trades: 'Trades' },
    quiet: 'Hide quiet checks',
    noneAll: 'No decisions yet. Your agents look every five minutes and write down each decision here.',
    noneNeeds: 'Nothing waits on you. Your agents act inside your limits and ask for anything larger.',
    noneTrades: 'No trades yet. Practice decisions show under All.',
    practice: 'practice',
    open: 'Open',
    signIn: 'Sign in to see what your agents did.',
  },

  settings: {
    meta: 'Settings',
    kicker: 'Your account',
    title: 'Settings',
    nav: {
      connections: 'Connections',
      wallet: 'Wallet & gas',
      agents: 'Agents',
      disclosure: 'What you agreed to',
      appearance: 'Appearance',
    },
    connectionsBody:
      'Telegram brings approvals, trades and alerts to your phone. OpenServ lets your own workspace, and the agents in it, talk to your agent. Each agent is connected on its own.',
    noAgents: 'Connections belong to an agent. Start one, and connect it here.',
    wallet: {
      body: 'Your wallet signs what only you can do: create an agent, add money, change its limits, withdraw. Each signature costs a few cents of ETH. Your agent’s trades are paid by Shijima, about 5¢ each, never from your wallet.',
      getGas:
        'No ETH on Robinhood Chain? When you add money from Base, Arbitrum, Ethereum or BNB Chain, tick “also send me gas” and about $1 of it arrives as ETH.',
    },
    agentsBody: 'Limits, mode, sharing, copying and closing live on each agent.',
    agentSettings: 'Agent settings',
    appearanceBody: 'Dark or light. It is remembered in this browser.',
  },

  notFound: {
    meta: 'Not found',
    code: '404',
    title: 'Nothing here but the quiet',
    body: 'This address leads nowhere. It may have been mistyped, or the agent behind it may no longer be shared.',
    didYouMean: 'Did you mean',
    home: 'Back to the start',
    markets: 'Markets',
    agents: 'Live agents',
  },

  error: {
    title: 'Something broke on our side',
    body: 'This page failed to load. Your money is not affected: it sits in your agent’s account on the chain, and only you can withdraw it.',
    retry: 'Try again',
    home: 'Back to the start',
  },
} as const
