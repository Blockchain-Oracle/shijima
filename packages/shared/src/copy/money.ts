/**
 * Money moving: into an agent, out of it, from your wallet to anyone, across chains, and a dollar of gas. Every
 * ending the owner can meet has its own honest line, in dollars: done, nothing sent, approval given but nothing
 * moved, on its way, and may have been sent.
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
    networkFee: (amount: string) => `Network fee: about ${amount}`,
    takes: (seconds: number) =>
      `Takes about ${seconds < 60 ? `${seconds} second${seconds === 1 ? '' : 's'}` : `${Math.round(seconds / 60)} minutes`}`,
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
} as const
