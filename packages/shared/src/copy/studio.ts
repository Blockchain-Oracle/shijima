/**
 * The strategies studio and the first-run tutorial (design brief 8.1 to 8.8), in Masayume's four steps: identity,
 * behaviour and limits, test read, publish. A strategy here is a basket of Stock Tokens with target weights and
 * some cash, never an AI agent or a trading rule. The AI is the desk itself.
 */

export const studioCopy = {
  kicker: 'Strategies · Robinhood Chain',
  title: 'Give your money an AI agent.',
  lede: 'Pick a strategy, put in USDG, and your agent keeps it on plan around the clock. It decides only when to move, and your own account enforces the limits whatever it decides.',
  tabs: { create: 'New agent', from: 'Start from a strategy', yours: 'Your agents' },
  aria: 'Strategies workspace',

  steps: ['Pick a strategy', 'Add USDG', 'Your agent’s limits', 'Meet your agent'] as const,
  stepsAria: 'Creation progress',
  counter: (n: number, total: number) => `Step ${n} of ${total}`,
  studioKicker: 'Your AI agent',
  studioTitle: 'Give your money an agent.',
  studioBody:
    'Pick what to hold, put in USDG, and your agent keeps it on plan. Your draft stays in this browser; you sign only at the last step.',
  back: '← Back',
  next: 'Continue →',
  nextWithoutRead: 'Continue without a test read →',

  identity: {
    name: 'Name your agent',
    namePlaceholder: 'Weekend agent',
    nameHint: 'Only you see it, unless you share the agent.',
    mix: 'Start from a mix',
    own: 'Set weights yourself',
    ownBody: 'Keep the mix you have and change it, or tap Stock Tokens to build one.',
    basket: 'The basket',
    total: (pct: string) => `${pct} of 100%`,
    cash: 'Kept as cash',
    cashNote:
      'Cash waits in your agent’s account in USDG, a digital US dollar, and is what the agent buys with.',
    mustAddUp: 'The shares and cash must add up to 100%.',
    monthShort: '30 days',
    pick: 'Tap the Stock Tokens you want',
    pickFirst: 'Tap a Stock Token above to add it.',
    even: 'Even split',
    adjust: 'Adjust the weights',
    ofHundred: 'of 100%',
    cashRest: 'Cash is whatever the stocks leave. The agent buys with it.',
  },

  behaviour: {
    title: 'How strict',
    drift: 'How far a holding may wander before the agent considers acting',
    driftHint: 'Smaller means more trades; each one costs a little.',
    position: 'The largest share any one stock may take',
    loss: 'Stop everything after a fall of',
    lossHint: 'Measured from what you put in. The agent stops acting and tells you.',
    rulesTitle: 'Standing rules',
    limitsTitle: 'Held by your account itself',
    limitsBody:
      'These two are written into the agent’s contract. The assistant cannot go past them whatever it decides, and changing them later needs your wallet.',
    perAction: 'Most it may spend in one action',
    daily: 'Most it may spend in a day',
    large: 'Ask me first at or above',
    largeHint: 'Even when it runs on its own. Saved instantly, no wallet needed.',
    notes: 'Notes in your own words',
    notesHint:
      'They shape when the agent acts, never how much and never what it holds. Kept private: a shared agent never shows them.',
    notesPlaceholder:
      'Prefer waiting for Monday unless something is clearly wrong.\nDo not add to Tesla in the week before its earnings.',
    count: (n: number, max: number) => `${n} / ${max}`,
    dailyBelow: 'The daily limit must be at least the per-action limit.',
  },

  read: {
    body: 'The agent reads your settings back in its own words and says what is unclear. It is one model call; nothing is signed or saved.',
    run: 'Hear it read back',
    again: 'Read it again',
    reading: 'The agent is reading your settings…',
    heard: 'How the agent understood you',
    unclear: 'What it found unclear',
    edited: 'You changed the settings after this read. Read it again so it matches.',
    signIn: 'Sign in to hear the read-back. It costs nothing.',
    failed:
      'The agent could not read it back just now. You can continue without it and read it back later from the chat.',
    skipped:
      'Without a read-back, the agent starts on your settings as written. Ask it in the chat at any time: “read my settings back”.',
  },

  /** Step 4 opens with the agent introducing itself, in its own voice, before anything is signed. */
  meet: {
    kicker: 'Your AI agent',
    name: 'Shijima',
    look: (amount: string, basket: string) => `I will look after ${amount} in ${basket}.`,
    lookPractice: (basket: string) => `I will run ${basket} in practice, with no money, until you add some.`,
    when: 'I decide only when to move toward your plan: now, in part, after New York reopens, or not at all.',
    limits: (perAction: string, daily: string) =>
      `I never spend more than ${perAction} in one trade or ${daily} in a day. Your account itself refuses anything more.`,
    practice: 'I start in practice: I decide for real and spend nothing until you let me go live.',
    tell: 'I write down every decision, and tell you on Telegram when I act or need you.',
  },

  /** Step 2: the money first, in dollars, as Glider's onboarding does. */
  money: {
    lead: 'How much USDG do you want your agent to look after?',
    balance: (amount: string) => `Your wallet holds ${amount} of USDG on Robinhood Chain.`,
    balanceNone:
      'Your wallet holds no USDG on Robinhood Chain yet. You can bring it from Base, Arbitrum, Ethereum or BNB Chain at the last step.',
    balanceSignedOut: 'Sign in at the last step and we will read your wallet’s USDG.',
    custom: 'Another amount',
    min: 'At least $1 from this wallet. Bringing it from another network works best from $20, because the crossing has a fixed fee.',
    split: 'What that buys, at your strategy’s weights',
    cash: 'Cash, kept aside',
    practice: 'Start in practice with no money',
    practiceNote: 'Your agent decides for real and spends nothing. Add money whenever you like.',
    practiceOn: 'Practice with no money. You can add USDG later.',
    tooLow: 'Put in at least $1, or start in practice with no money.',
    tooMuch: (amount: string) => `That is more than your wallet holds (${amount}).`,
    side: (amount: string) => `Putting in ${amount}`,
    sideNone: 'Practice, no money yet',
  },

  create: {
    title: 'Create your agent',
    body: 'This creates an account on Robinhood Chain that belongs to you. Only you can take money out. The assistant may trade inside it, within the limits above, and you can remove it at any time.',
    starts:
      'It starts in practice: it decides for real and spends nothing. It can go live after a day of practice, once you have read its report.',
    address: 'Your agent’s address',
    addressNote: 'Known before it exists, so money can be sent to it first.',
    fee: 'Network fee',
    feeValue: (usd: string) => `about ${usd}, paid by your wallet`,
    feeUnknown: 'under a dollar, paid by your wallet',
    confirmations: 'Wallet confirmations',
    confirmationsValue: 'One',
    confirmationsFunded: 'Two: create your account, then put in your USDG',
    button: 'Create my agent',
    buttonFunded: (amount: string) => `Create and put in ${amount}`,
    funding: (amount: string) => `Putting in ${amount}. Confirm in your wallet…`,
    fundingNetwork: 'Waiting for the money to arrive…',
    fundSkipped: 'Your account exists. The money was not sent: you can add it on the next screen.',
    wallet: 'Confirm in your wallet…',
    network: 'Waiting for the network…',
    recording: 'Recording it…',
    cancelled: 'You cancelled in your wallet. Nothing was created.',
    failed: 'It did not go through. Nothing was created, and your draft is still here.',
    wrongNetwork: 'Switch your wallet to Robinhood Chain',
    wrongWallet:
      'Your wallet has switched to a different address. Switch back to the one you signed in with.',
    connect: 'Connect your wallet and sign in to create the agent.',
    connectWallet: 'Connect your wallet',
    disclosureFirst: 'Read this once before any money moves.',
    noEth: {
      title: 'Your wallet needs a little ETH on Robinhood Chain',
      body: 'Creating the agent is paid in ETH, well under a dollar. Bring money in first: it goes straight to your agent’s address, and about $1 of ETH comes to your wallet with it. Then create the agent.',
      after: 'When the ETH has arrived, create the agent.',
      check: 'Check again',
    },
  },

  done: {
    kicker: 'You are all set',
    title: (name: string) => `${name} is on duty.`,
    body: 'Shijima, your AI agent, starts in practice: it decides for real and spends nothing until you let it go live. The account belongs to your wallet, and only you can take money out.',
    funded: (amount: string) => `${amount} of USDG is in your account.`,
    tx: 'See the transaction ↗',
    firstSteps: 'First steps',
    money: {
      title: 'Put money in',
      body: 'USDG you already hold on Robinhood Chain, or dollars from another network.',
      open: 'Add money',
      funded: (amount: string) => `The agent holds ${amount}.`,
    },
    telegram: {
      title: 'Connect Telegram',
      body: 'The agent tells you what it did, and asks you there when it needs an answer.',
      skip: 'Skip for now',
      skipped:
        'Skipped. Without Telegram, requests that need your answer only reach you here on the website.',
    },
    open: 'Meet your agent →',
    another: 'Start another agent',
  },

  side: {
    kicker: 'Your agent',
    unnamed: 'Unnamed agent',
    onlyCash: 'Only cash so far',
    split: (stocks: number, cashPct: number) =>
      `${stocks} Stock Token${stocks === 1 ? '' : 's'}, ${cashPct}% kept as cash`,
    sentence: (perAction: string, daily: string) =>
      `It may spend at most ${perAction} in one trade and ${daily} in a day. Your account itself refuses anything more.`,
    own: 'Your own basket',
    cash: 'Cash',
    perAction: 'Most in one action',
    daily: 'Most in a day',
    mode: 'Starts in',
    modeValue: 'Practice',
    read: 'Read-back',
    readDone: 'Heard, matches the draft',
    readStale: 'Settings changed since',
    readNone: 'Not yet',
    approach:
      'One approach: the agent’s own. AI judges only timing; arithmetic decides everything else, and your account holds the limits.',
  },

  from: {
    title: 'Start from a strategy',
    body: 'Take a basket as your starting point. Only the mix is copied: never anyone’s trades, notes or limits.',
    presets: 'Baskets',
    shared: 'What shared agents hold',
    sharedEmpty: 'No agent is shared yet.',
    use: 'Start with this →',
    /** "+2.4% over 30 days": the basket's return from the price log, never a forecast. */
    past: (days: number) => `over ${days} days`,
    pastNone: 'Too little history yet',
    pastNote: 'Past returns, from our price log. Not a forecast.',
    suits: 'Suits',
    watch: 'Watch this agent',
    sharedMode: (mode: string) => `A shared agent, running in ${mode.toLowerCase()}. Only its mix is copied.`,
    cash: (pct: string) => `${pct} cash`,
    more: (n: number) => `+${n} more`,
  },

  yours: {
    title: 'Your agents',
    signIn: 'Connect the wallet that owns them.',
    empty: 'This wallet has no agent yet.',
    create: 'Create your first agent →',
    draft: 'Not created yet',
    draftBody: (address: string) =>
      `Its address is ${address}. Money sent there is safe and waits for it. Finish creating it in the studio.`,
    finish: 'Finish creating it →',
    open: 'Open →',
    lifecycle: { onboarding: 'Setting up', running: 'Running', closed: 'Closed' } as Record<string, string>,
    checks: (n: number) => `${n} checks`,
  },

  refused: {
    signIn: 'Sign in first.',
    disclosure: 'Accept the disclosure first. It is one reading, before any money moves.',
    notOurs: 'There is no agent of ours at that address yet.',
    wrongOwner: 'That agent belongs to a different wallet.',
    wrongOperator: 'That agent does not have our assistant set as its operator.',
    notYours: 'That is not your agent.',
  },

  notAdvice:
    'Not investment advice. Stock Tokens are not shares and are not available in the US, the UK, Canada or Switzerland. The agent makes no prediction and claims no edge.',
} as const

/**
 * The five screens a first visit sees over the markets (design brief 8.1 to 8.3), ending on Connect. The weekend
 * fact is filled in from the price log, so the number is real.
 */
export const tutorialCopy = {
  steps: {
    what: {
      title: 'Welcome to Shijima',
      body: 'An AI agent for your Stock Tokens. You choose what it holds; it decides only when to move, inside limits your own account enforces, and it writes down every decision.',
    },
    weekend: {
      title: 'The market sleeps. The tokens do not.',
      body: (fact: string | null) =>
        `The US market is shut most of the week. Stock Tokens on Robinhood Chain trade every hour of it. ${
          fact ?? 'Their prices drift from the last official update while it is shut.'
        } Whether to act before the reopen, or wait for it, is the only thing the agent decides.`,
      fact: (who: string, pct: string, direction: 'above' | 'below', saturday: string) =>
        `On the weekend of ${saturday}, ${who} moved as far as ${pct} ${direction} its Friday reference.`,
    },
    promises: {
      title: 'Five promises',
      items: [
        'Your money sits in an account only you can withdraw from.',
        'The assistant can trade inside it, never send it anywhere.',
        'Your limits are held by the account itself, whatever the AI decides.',
        'Every decision is written down, including the choice to wait, and fingerprinted on the chain.',
        'You can remove the assistant at any time, in one confirmation.',
      ],
    },
    region: {
      title: 'Who may not hold Stock Tokens',
      body: 'People in the US, the UK, Canada, Switzerland and some other places may not hold them. A Stock Token follows a stock’s price; it is not the share. Reading this site stays open to everyone.',
    },
    connect: {
      title: 'Connect to begin',
      kicker: 'Last step',
      heading: 'Connect and sign one message',
      note: 'It costs nothing and moves nothing. Then start an agent from a basket.',
      fineprint:
        'You can see a real agent without connecting: the markets page marks what shared agents did.',
    },
  },
  close: 'Close',
  skip: 'Skip',
  next: 'Next',
  done: 'Start',
  progress: (step: number, total: number) => `Step ${step} of ${total}`,
} as const
