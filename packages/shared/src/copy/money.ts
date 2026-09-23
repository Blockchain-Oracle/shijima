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
} as const
