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

  steps: ['Strategy', 'Amount', 'Limits', 'Review'] as const,
  newTitle: 'New agent',
  newSub: 'Pick a strategy, choose how much, set its limits. You confirm in your wallet only at the end.',

  /** The create flow, step by step: short, one decision per screen. */
  flow: {
    pickTitle: 'Pick a strategy',
    search: 'Search strategies or stocks',
    sort: 'Sort',
    sorts: { popular: 'Popular', best: 'Best 30 days', calm: 'Most cash', name: 'A to Z' } as Record<
      string,
      string
    >,
    all: 'All',
    noMatch: 'No strategy matches. Try another word, or build your own.',
    ownTitle: 'Build your own',
    ownBody: 'Pick the stocks and the share of each.',
    amountTitle: 'How much should it look after?',
    inWallet: 'In your wallet',
    max: 'Max',
    notEnough: (have: string) => `Your wallet holds ${have} of USDG on Robinhood Chain.`,
    addUsdg: 'Bring USDG to your wallet',
    practice: 'Practice with no money',
    practiceNote: 'It decides for real and spends nothing. Add money any time.',
    practiceOn: 'Practice, no money',
    buys: 'What it buys',
    limitsTitle: 'The most it may spend',
    limitsBody: 'Written into your agent’s account. It cannot go past these, whatever it decides.',
    limitsSized: (amount: string) => `Sized to your ${amount}, so its first buys are never held back.`,
    limitsOwn: 'Set by you.',
    perTrade: 'Per trade',
    perDay: 'Per day',
    more: 'More options',
    reviewTitle: 'Review and create',
    name: 'Name',
    strategy: 'Strategy',
    amount: 'Amount',
    limits: 'Limits',
    limitsValue: (trade: string, day: string) => `${trade} a trade · ${day} a day`,
    from: 'Your wallet',
    to: 'Your new agent',
    toNote: 'An account that belongs to you. Only you can take money out.',
    fee: 'Network fee',
    feeValue: (usd: string) => `about ${usd} in ETH, from your wallet`,
    feeOk: (have: string) => `You have ${have} ✓`,
    feeShort: (need: string, have: string) =>
      `Your wallet needs about ${need} of ETH on Robinhood Chain for the fee, and has ${have}.`,
    getEth: 'Get ETH for fees',
    signs: 'You confirm in your wallet',
    signCreate: 'Create your agent account',
    signFund: (amount: string) => `Move ${amount} of USDG into it`,
    agree: 'I have read what I agree to',
    readTerms: 'Read it',
    edit: 'Edit',
    starts: 'It starts',
    startLive: 'Live',
    startLiveNote: 'Trades on its own, inside your limits',
    startPractice: 'Practice',
    startPracticeNote: 'Decides for real, spends nothing',
    broadcasting: 'Sent. Waiting for the network to pick it up…',
    confirming: 'In the network. Confirming…',
    txSent: 'Transaction',
    notSeenYet:
      'Your wallet says it sent this, but the network has not seen it yet. If it stays like this, open your wallet: cancel the pending transaction, then press Create again.',
    unseen:
      'The network never received this transaction, so nothing was spent and nothing was created. Open your wallet and cancel the pending one, then try again.',
    walletSaid: (reason: string) => `Your wallet said: ${reason}`,
  },
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
    drift: 'Rebalance when a holding drifts by',
    driftHint: 'Smaller means more trades; each one costs a little.',
    position: 'Most in any one stock',
    loss: 'Stop everything after a loss of',
    lossHint: 'Measured from what you put in. The agent stops acting and tells you.',
    rulesTitle: 'Standing rules',
    limitsTitle: 'Held by your account itself',
    limitsBody:
      'These two are written into the agent’s contract. The assistant cannot go past them whatever it decides, and changing them later needs your wallet.',
    perAction: 'Most it may spend in one action',
    daily: 'Most it may spend in a day',
    large: 'Ask me first above',
    largeHint: 'Even when it runs on its own. Saved instantly, no wallet needed.',
    notes: 'Notes for your agent',
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
    cannotTradeTitle: 'Too small to trade yet.',
    cannotTradeBody: (amount: string, least: string) =>
      `${amount} split across this strategy makes each buy under 20¢, the smallest trade, so your agent would only hold cash. It needs ${least}, or a strategy with fewer stocks.`,
    putIn: (least: string) => `Put in ${least}`,
    switchTo: (name: string) => `Switch to ${name}`,
    tooSmallToTrade: (least: string) =>
      `Too little to split across this strategy: each buy would be under 20¢, the smallest trade, so it would only hold cash. Put in at least ${least}, or pick a strategy with fewer stocks.`,
    side: (amount: string) => `Putting in ${amount}`,
    sideNone: 'Practice, no money yet',
  },

  create: {
    title: 'Create your agent',
    body: 'This creates an account on Robinhood Chain that belongs to you. Only you can take money out. The assistant may trade inside it, within the limits above, and you can remove it at any time.',
    starts:
      'It starts live unless you pick practice, and you can switch either way at any time from its settings.',
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
    titleLive: (name: string) => `${name} is live`,
    titlePractice: (name: string) => `${name} is practising`,
    bodyLive:
      'It trades on its own from now on, only inside your limits. Only your wallet can take money out.',
    bodyPractice:
      'It decides for real and spends nothing. Switch it to live on its page whenever you are ready.',
    holds: 'It holds',
    account: 'Its account',
    copy: 'Copy the address',
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
    open: 'Open your agent →',
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

/** The weekend fact the landing page and How it works show, filled in from the price log so the number is real. */
export const weekendFactCopy = (who: string, pct: string, direction: 'above' | 'below', saturday: string) =>
  `On the weekend of ${saturday}, ${who} moved as far as ${pct} ${direction} its Friday reference.`
