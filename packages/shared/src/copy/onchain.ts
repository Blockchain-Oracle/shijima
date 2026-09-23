/**
 * What is live on chain, said as a product fact (DECISIONS F1): the contracts on Robinhood Chain mainnet, the
 * OpenServ agent and its identity on Base, each with what it is for. Shown under the landing hero and on the
 * Overview. The dates are the deploys in `packages/chain/deployments.json`.
 */
export const onchainCopy = {
  eyebrow: 'Live on Robinhood Chain mainnet',
  title: 'On chain now',
  desc: 'Not a demo network. Every piece below is public, and each one opens.',
  factory: {
    label: 'Agent factory',
    what: 'Makes one agent account for each person who signs up.',
    when: 'Deployed 20 Sep 2026, upgraded 22 Sep',
  },
  account: {
    label: 'Agent account',
    what: 'Holds one person’s money. Their agent trades inside the limits they set. Only the owner can withdraw, not Shijima and not the agent. Every trade writes the decision’s fingerprint on chain.',
    example: 'The live agent’s account',
    yours: 'Your agent’s account',
  },
  agent: {
    label: 'OpenServ agent',
    what: 'The agent itself, listed on OpenServ, reasoning with SERV on every timing decision.',
  },
  identity: {
    label: 'OpenServ ID',
    what: 'The agent’s identity, an ERC-8004 token on Base.',
  },
  open: 'Open',
  compactTitle: 'On chain',
} as const
