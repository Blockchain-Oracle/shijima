/**
 * How it works: the brief's "How the desk decides" [8.21] and "Withdraw without our website" [8.22], laid out in
 * Masayume's page, section for section. Every number that the code decides is passed in by the page, never typed
 * here, so the published rules cannot drift from the rules the desk runs.
 */

export const howCopy = {
  title: 'How it works',
  lead: 'You choose what to hold. The desk decides only when to move, inside limits the network itself enforces, and it writes down every decision, including the hours it did nothing.',
  back: 'Back to Markets',

  sections: {
    steps: 'Getting started',
    example: 'A worked example',
    clock: 'The market clock',
    split: 'What you decide, and what it decides',
    modes: 'Three modes',
    order: 'How the desk decides',
    judgment: 'Where AI is used, and where it is not',
    refuses: 'When the desk will not act',
    chain: 'What the network enforces',
    withdraw: 'Withdraw without our website',
    fee: 'The fee',
    faq: 'Questions',
  },

  steps: {
    basket: {
      title: 'Pick a basket',
      body: (tokens: number) =>
        `Choose a ready-made mix, such as The Mag Seven, or set your own weights across ${tokens} Stock Tokens and cash. The weights must add up to 100%.`,
    },
    limits: {
      title: 'Set two hard limits',
      body: (perAction: string, perDay: string) =>
        `The most the desk may spend in one action, and in one day. Both are written into your desk contract, so the network refuses anything larger. They start at ${perAction} and ${perDay}.`,
    },
    create: {
      title: 'Create your desk',
      body: 'One signature from your wallet creates a desk contract that you own, on Robinhood Chain. Only you can take money out. The network fee is about $0.30.',
    },
    talk: {
      title: 'Talk to it',
      body: 'Ask why it waited, pause it, or change your mix. It proposes; you confirm on a card. It checks your desk every hour, and it starts in practice, where it spends nothing.',
    },
  },

  example: {
    tag: 'Worked example, not a live quote',
    figures: [
      { value: '$4,000', label: 'Nvidia, 40%' },
      { value: '$3,000', label: 'S&P 500 fund, 30%' },
      { value: '$3,000', label: 'Cash, 30%' },
    ],
    start: 'On Saturday Nvidia rises to',
    startChip: '$4,800',
    middle: '44% of $10,800, past your 3% tolerance',
    end: 'To return to 40%, sell',
    endChip: '$480',
    foot: 'That much is arithmetic. What is left is when: all of it now, part now, wait for Monday’s open, or not at all. If $480 is more than your per-action limit, the sale is cut to the limit.',
  },

  clock: {
    lead: 'Stock Tokens trade on Robinhood Chain at every hour. The US market does not. What a token’s price means depends on the hour, so the desk reads the clock before anything else.',
    lanes: {
      open: {
        name: 'Market open',
        clock: '9:30 to 16:00 New York · Mon to Fri',
        body: 'The exchange is trading, and so is the price feed. Each token’s pool is measured against the feed’s last official update.',
      },
      edges: {
        name: 'Before and after hours',
        clock: '7:00 to 9:30 · 16:00 to 20:00 · overnight',
        body: 'The exchange is quiet, but from Sunday 20:00 to Friday 20:00 approved firms can still create and redeem Stock Tokens, which keeps each pool near the real price. The reference is each pool’s price at the last regular close.',
      },
      shut: {
        name: 'Weekends and holidays',
        clock: 'Fri 20:00 to Sun 20:00 New York',
        body: 'No one can create or redeem Stock Tokens, so nothing ties a pool to the real market. The pools keep trading, and prices drift from the reference. This is the window the desk was built for.',
      },
    },
    wordsTitle: 'What the clock says',
    wordsBody:
      'The session chip, the ticker and every chart use the same five words, with a countdown to the next change. A price always says where it came from and how old it is.',
    words: {
      regular: 'the exchange is trading, 9:30 to 16:00 New York, or to 13:00 on a half day',
      extended: '7:00 to 9:30 and 16:00 to 20:00',
      overnight: '20:00 to 7:00, from Sunday evening on',
      weekend: 'Friday 20:00 to Sunday 20:00',
      holiday: 'the exchange is shut, from 20:00 the evening before',
    },
    shutTitle: 'While the market is shut',
    shutBody: 'Most of the week falls outside regular hours. This is what that means for your desk.',
    shutPoints: {
      noEdge:
        'A weekend price does not reliably say where Monday will open, and the desk never claims otherwise. Each wait is graded after the reopen against acting at once, and the grade can go either way.',
      band: 'Your desk contract refuses the assistant’s trades when a price is more than 8% from the last official update. Only you can sell then.',
      hourly:
        'The desk still checks every hour. The record shows every check, including the ones where it did nothing.',
    },
  },

  split: {
    basket: {
      title: 'Your basket',
      body: 'What to hold, and in what proportions. The desk never adds a holding and never changes your proportions.',
    },
    limits: {
      title: 'Your limits',
      body: 'Per action and per day, held by your desk contract. A drift tolerance, a largest single holding and a loss limit, held by the desk.',
    },
    timing: {
      title: 'Its one call: when',
      body: 'When a holding drifts past your tolerance, it chooses: all now, part now, wait for the reopen, or not at all. Nothing else is left to AI.',
    },
    record: {
      title: 'The record',
      body: 'Every check is written down with its reasons and the options it turned down, and fingerprinted on the public network. Anyone with the link can check it in their own browser.',
    },
  },

  modes: {
    shadow: {
      title: 'Practice',
      body: (checks: number) =>
        `It decides every hour and records what it would have done, but spends nothing. Every desk starts here. It can go live after ${checks} practice checks and once you have read its report.`,
    },
    askFirst: {
      title: 'Ask first',
      body: 'It asks you before each action, on the website or in Telegram. A request you do not answer expires at the next check, and nothing happens.',
    },
    onItsOwn: {
      title: 'On its own',
      body: 'It acts inside your limits and tells you what it did. It still asks first when an action is unusually large, at a size you set.',
    },
  },

  order: {
    kinds: {
      arithmetic: 'Arithmetic',
      rule: 'Fixed rule',
      judgment: 'AI judgment',
      mode: 'Your mode',
      record: 'The record',
    },
    steps: {
      read: {
        label: 'Read your account',
        desc: 'Balances, limits, and whether the assistant still has access. Money you added or took out is recognised as such, never as a gain or a loss.',
      },
      value: {
        label: 'Value what you hold',
        desc: 'On each pool’s average price over the last 30 minutes, never on a frozen feed. A price it cannot read means that holding is not valued and not traded.',
      },
      drift: {
        label: 'Find what drifted',
        desc: (multiple: number, minimum: string) =>
          `A holding must be further from its target than your tolerance, and the drift must be worth at least ${multiple} times what the trade costs. Nothing under ${minimum} is worth the network fee.`,
      },
      refuse: {
        label: 'Refuse what a rule forbids',
        desc: 'A token whose trading is paused, whose price feed is missing, whose price is more than 8% from the last official update or moving fast right now, or that you have not allowed. With no news to go on, it will not make an ordinary rebalance.',
      },
      ask: {
        label: 'Ask one question: when?',
        desc: 'The reasoning engine sees the hour, the price against its reference, the cost, the token’s status, recent headlines naming the company, and your notes. It answers with one of four options, its confidence, its reasons, and every option it turned down.',
      },
      recheck: {
        label: 'Check the limits again',
        desc: 'The same sums your desk contract will do, rounding included. This step can refuse what the engine chose, and the engine can never get past it.',
      },
      act: {
        label: 'Act, ask, or record',
        desc: 'In practice it records what it would have done. In ask first it asks you. On its own it acts.',
      },
      write: {
        label: 'Write it down',
        desc: 'Every check goes into the record, including the ones that did nothing. Each entry carries the fingerprint of the one before it, and a fingerprint goes on the public network with every action and once a day.',
      },
    },
  },

  judgment: {
    body: 'Seven of the eight steps are arithmetic or fixed rules, and they run the same way every time. One is AI judgment, and it is asked only about timing. The rules run before it and again after it.',
    formula: [
      'what needs doing    ← arithmetic',
      'what is forbidden   ← fixed rules',
      'when to do it       ← AI judgment, then the limits again',
    ],
    params: {
      sees: [
        'Sees',
        'the hour, each price against its reference and how old that is, what the trade costs, whether trading is paused, headlines naming the company, your notes',
      ],
      answers: ['Answers', 'act now, act in part, wait for the reopen, or decline'],
      gives: ['Also gives', 'its confidence, its reasons, and why it turned down each other option'],
      never: ['Never decides', 'what to hold, how much of it, or whether a limit applies'],
    } satisfies Record<string, [string, string]>,
    foot: 'The engine is SERV Reasoning, from OpenServ. Its answer must fit a strict format, and our own checks reject an answer that cites a rule or a fact it was not given. A rejected answer means the desk does nothing that hour, and the record says so.',
  },

  refuses: {
    halted: {
      title: 'Trading paused in a token',
      body: 'If Robinhood’s status for a token says trading is paused, or the status cannot be read, the desk will not touch that token. The record names the reason.',
    },
    band: {
      title: 'A price beyond 8%, or no price feed',
      body: 'Your desk contract refuses the assistant’s trades when a price is more than 8% from the last official update, or when the feed is missing or paused. Only you can sell then, and you are told.',
    },
    data: {
      title: 'Data it cannot verify',
      body: 'If a price, a feed or the news cannot be read, the desk does not guess. It waits, and the record says which source did not answer. Status shows every source, live.',
    },
    statusLink: 'See every source on Status',
    never: {
      title: 'What it never does',
      body: 'It does not pick stocks, predict prices, or chase or fade a weekend move. It cannot send your money anywhere but your own wallet.',
    },
  },

  chain: {
    own: {
      title: 'A desk contract of your own',
      body: 'Your money sits in a contract you own on Robinhood Chain, not with us. Only you can withdraw, and a withdrawal can only go to your wallet.',
    },
    limits: {
      title: 'Limits the network holds',
      body: 'The per-action and daily limits, the tokens you allowed and the pool each one trades in are set in your contract. The assistant’s key cannot change them, and a trade past them is rejected by the network.',
    },
    fingerprint: {
      title: 'A fingerprint for every decision',
      body: 'Each action carries the fingerprint of its record, and a daily fingerprint seals the checks that did nothing. “Check it” recomputes a fingerprint in your browser and compares it with the chain.',
    },
  },

  withdraw: {
    body: 'If this website ever disappears, your money is still in your desk contract on the public network. You can take it out with the block explorer alone.',
    steps: {
      open: {
        label: 'Open your desk on the explorer',
        desc: (explorer: string) =>
          `Go to ${explorer}/address/ followed by your desk’s address. The address is on your desk page and in its settings.`,
      },
      write: {
        label: 'Open Contract, then Write proxy',
        desc: 'Connect the wallet that owns the desk. The assistant’s key cannot do what follows.',
      },
      call: {
        label: 'Call withdraw',
        desc: 'Enter the token’s address from the list below, and an amount in the token’s smallest unit. USDG has 6 decimals, so $25 is 25000000. Stock Tokens have 18.',
      },
      confirm: {
        label: 'Confirm in your wallet',
        desc: 'The tokens go to your wallet, the only place they can go. Repeat for each token you hold. Stock Tokens arrive as they are, to sell wherever you like.',
      },
    },
    foot: 'To stop the assistant first, call revokeOperator in the same place. It needs no amount.',
    yourDesk: 'Your desk on the explorer',
    tokensTitle: 'Token addresses',
    usdg: 'USDG · the desk’s cash',
  },

  fee: {
    yearly: {
      title: '0.5% a year, waived during the beta',
      body: 'A small yearly share of what the desk holds, counted as it goes, for example “Fee so far: $0.03, waived.” Practice mode is always free.',
    },
    perTrade: { title: 'No fee per trade', body: 'A desk that is paid per trade is paid to trade too much.' },
    network: {
      title: 'Network fees',
      body: 'Paid in ETH on Robinhood Chain. Creating a desk costs about $0.30, and a trade about $0.04. Every card shows the fee before you sign.',
    },
  },

  faq: {
    predict: {
      q: 'Does the desk predict prices?',
      a: 'No. It does not pick stocks, forecast prices, or claim to do better than acting at once. It decides when to make the moves your own proportions call for, and after the reopen it grades its own waits against acting at once, whichever way that went.',
    },
    custody: {
      q: 'Can Shijima take my money?',
      a: 'No. Your money is in a desk contract you own. Only your wallet can withdraw, and a withdrawal can only pay your wallet. The assistant can trade inside your limits, and nothing else.',
    },
    gone: {
      q: 'What if this website disappears?',
      a: 'Your money stays in your desk contract. You can withdraw with the block explorer alone; the steps are above.',
    },
    token: {
      q: 'What is a Stock Token?',
      a: 'A token on Robinhood Chain that follows the price of a US stock or fund. It is not a share: it gives you no ownership of the company and no shareholder rights. People in the US, the UK, Canada, Switzerland and some other places may not hold them.',
    },
    sees: {
      q: 'What does the AI see?',
      a: 'Only facts about the hour: the session, each price against its reference and how old that is, the cost of the trade, the token’s status, headlines that name the company, and your notes. Your notes stay private; the public record shows only that a note applied.',
    },
    awake: {
      q: 'How do I know it is awake?',
      a: 'Status shows the last check of every shared desk, the worker’s heartbeat, the hourly trigger from OpenServ, and every data source, live. In Telegram, one pinned message is updated at every check.',
    },
    practice: {
      q: 'Why does it start in practice?',
      a: (checks: number) =>
        `So you can see how it decides before it spends anything. After ${checks} practice checks, and once you have read its report, you can let it ask first or act on its own.`,
    },
    override: {
      q: 'Can I make it trade now?',
      a: 'Chat can start a check now, and the desk still decides. “Do it anyway” makes a trade the desk would not, on a second confirmation. It is recorded and graded as your call, not the desk’s, and it is not available in practice.',
    },
  },

  cta: {
    title: 'Start in practice',
    body: 'Pick a basket and create your desk. It checks every hour and spends nothing until you let it.',
    action: 'Start a desk',
  },
} as const
