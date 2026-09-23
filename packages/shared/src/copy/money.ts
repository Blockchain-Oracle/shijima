/**
 * The words of the money screens: Wallet, Receive, Fund, Withdraw, Send, Bridge and Evidence. In dollars, with
 * where the money goes said every time, as the reference wallet names each boundary.
 */
export const moneyCopy = {
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
