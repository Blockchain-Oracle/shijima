/**
 * Money moving: into an agent, out of it, from your wallet to anyone, across chains, and a dollar of gas. Every
 * ending the owner can meet has its own honest line, in dollars: done, nothing sent, approval given but nothing
 * moved, on its way, and may have been sent.
 *
 * Also the words of the money screens: Wallet, Receive and Evidence, and the access card.
 */
export const moneyCopy = {
  kinds: {
    fund: 'Add money',
    withdraw: 'Withdraw',
    sell_some: 'Sell one stock',
    send: 'Send',
    bridge_in: 'Add money from another chain',
    bridge_out: 'Bridge out',
    get_gas: 'Get gas',
  },
  endings: {
    signing: 'Waiting for your wallet.',
    done: (amount: string) => `Done: ${amount} moved.`,
    nothing_sent: 'Nothing was sent. Your money has not moved.',
    approved_only:
      'The approval went through, but nothing moved. You can try again; the approval is for this amount only.',
    on_its_way: (amount: string) => `On its way: ${amount}. Relay usually delivers in under a minute.`,
    may_have_been_sent:
      'It may have been sent. We could not read the result in time. Check the explorer link before trying again.',
  },
  steps: {
    approve: (symbol: string, amount: string) => `Approve exactly ${amount} of ${symbol}`,
    transferIn: (amount: string) => `Move ${amount} into the agent`,
    swapIn: (from: string, to: string) => `Swap ${from} to ${to} into the agent`,
    send: (amount: string) => `Send ${amount}`,
    relay: (step: string) => `Relay: ${step}`,
    gas: (amount: string) => `Swap ${amount} of USDG to ETH for gas`,
  },
  lines: {
    youSend: (amount: string) => `You send ${amount}`,
    agentGets: (amount: string) => `About ${amount} of USDG lands in the agent`,
    agentGetsAsIs: (amount: string) => `It goes in as it is, worth about ${amount}`,
    atLeast: (amount: string) => `At least ${amount}, or nothing moves`,
    youGet: (amount: string) => `You receive about ${amount}`,
    cost: (amount: string) => `Cost, network and Relay together: about ${amount}`,
    takes: (seconds: number) =>
      `Takes about ${seconds < 60 ? `${seconds} seconds` : `${Math.round(seconds / 60)} minutes`}`,
    quoteFresh: 'The price holds for 60 seconds; after that it is checked again.',
  },
  refusals: {
    signIn: 'Sign in with your wallet first.',
    notYourAgent: 'That is not your agent.',
    minimum: 'The smallest amount is $1.',
    amount: 'Enter an amount.',
    notEnough: (held: string) => `Your wallet holds ${held}, less than that.`,
    noGas:
      'Your wallet has no ETH on Robinhood Chain for the network fee. Bring a little from another chain, or claim the free $1, which includes some.',
    unknownToken: 'That token is not one this app moves.',
    unknownChain: 'That chain is not one Relay can bring money from.',
    noEthToAgent: 'An agent cannot hold ETH. It arrives as USDG instead.',
    badAddress: 'That is not a valid address.',
    tokenContract: 'That address is a token contract, not a wallet. Money sent there is lost.',
    toYourAgent: 'That is one of your agents. Use Add money instead, so it is recorded as money in.',
    refusedByChain: 'The chain would refuse this right now. Nothing was sent.',
    quote: (why: string) => `No price for that right now: ${why}`,
    expired: 'That price has expired. Here is a fresh one.',
    needOrigin:
      'You have no ETH on Robinhood Chain to pay for a swap. Bring gas from another chain instead: pick where it comes from.',
  },
  chart: {
    tookOut: (amount: string) => `You took out ${amount}`,
    added: (amount: string) => `You added ${amount}`,
    addedFrom: (amount: string, chain: string) => `You added ${amount} from ${chain}`,
    netOfMoney: 'Change after money in and out',
  },
  checked: {
    justNow: 'checked just now',
    ago: (when: string) => `checked ${when}`,
  },

  signedOut: {
    title: 'Shijima',
    welcome: 'Your wallet, and your agents',
    body: 'Connect the wallet you hold money in. Signing in costs nothing and moves nothing.',
    note: 'Only your wallet can take money out of your agents. Not us, and not the agent.',
  },

  receive: {
    meta: 'Receive',
    title: 'Receive',
    sub: 'Share your wallet’s address, or one of your agents’, to be paid on Robinhood Chain.',
    tabWallet: 'Your wallet',
    walletLabel: 'YOUR WALLET ON ROBINHOOD CHAIN',
    agentLabel: (name: string) => `${name.toUpperCase()} · AGENT ACCOUNT`,
    walletCaption: 'Scan to pay your wallet on Robinhood Chain',
    agentCaption: 'Scan to pay this agent on Robinhood Chain',
    copy: 'Copy address',
    copied: 'Copied',
    explorer: 'View on Blockscout',
    walletCalloutTitle: 'Robinhood Chain only.',
    walletCallout:
      'USDG, ETH and Stock Tokens sent here land in your own wallet. From there, Fund puts them into an agent.',
    agentCalloutTitle: 'Robinhood Chain only.',
    agentCallout:
      'Send USDG, or a Stock Token this agent trades. It lands in the agent’s account, and only your wallet can take it out. Never send ETH to an agent: it cannot hold it.',
    elsewhere: 'Coming from Base, Arbitrum, Ethereum or BNB?',
    elsewhereLink: 'Bridge it in',
  },

  evidence: {
    meta: 'Evidence',
    title: 'Evidence',
    sub: 'Every decision your agents made, its fingerprint, and the transaction that put that fingerprint on chain. Check any of them yourself.',
    facts: 'ON CHAIN',
    network: 'Network',
    networkValue: 'Robinhood Chain mainnet · 4663',
    factory: 'Agent factory',
    operator: 'Shijima’s operator',
    agent: 'Agent account',
    openserv: 'OpenServ agent',
    identity: 'OpenServ ID (Base)',
    copyAll: 'Copy every hash',
    copied: 'Copied',
    step: 'Decision',
    fingerprint: 'Fingerprint',
    explorer: 'On chain',
    open: 'Open ↗',
    check: 'Check it',
    unsealed: 'sealed with the next trade',
    none: 'No decisions yet. The first one appears here with its fingerprint.',
    howTitle: 'How to check one yourself',
    how: [
      'Open a decision: its record is the whole reasoning, in plain words and exact numbers.',
      'Press Check it: your browser rebuilds the fingerprint from that record.',
      'It asks Robinhood Chain for the fingerprint the agent wrote there. They match, or the page says so.',
    ],
  },
} as const
